// Job comparison (spec 004), run on demand after the main analysis.
// The measured part (exact keywords) always runs; with an on-device engine the
// model extracts and classifies the requirements and drafts phrasings, and the
// page measures everything else: knock-outs, the summary, the phrasing guard.

import { entry } from "@domain/findings/catalogue";
import type { Finding, Lang } from "@domain/findings/types";
import { checkKeywords } from "@domain/job/keywords";
import { evaluateKnockouts } from "@domain/job/knockouts";
import type { JobMatch, KnockoutKind, KnockoutResult, Requirement, RequirementMatch, Suggestion, SuggestionTarget } from "@domain/job/model";
import { guardPhrasing } from "@domain/job/phrasing";
import { trimPosting } from "@domain/job/posting";
import { summarise } from "@domain/job/summary";
import { verifyEvidence } from "@domain/profile/verify";
import { withJob, type Report } from "@domain/report/report";
import { runTask } from "../agent/orchestrator";
import { compactProfile } from "../agent/profile";
import type { AiEngine } from "../ports/AiEngine";
import { SYSTEM_PROMPT } from "../prompts/system";
import type { TaskContext } from "../prompts/tasks";
import { layoutFactsForModel } from "../tools/tools";
import { engineLangs } from "./engine";
import type { Measured } from "./measureLayout";

export interface CompareJobInput {
	measured: Measured;
	report: Report;
	engine: AiEngine | null;
	jobText: string;
	jobTitle?: string;
	lang: Lang;
	signal?: AbortSignal;
	onProgress?: (step: "extract_job" | "match_job") => void;
	now?: () => number;
	today?: Date;
}

type RawRequirement = { text: string; kind: Requirement["kind"]; importance: Requirement["importance"]; knockout: KnockoutKind | "none"; years: number; level: string };
type RawMatch = { requirement: string; status: RequirementMatch["status"]; evidence: { ref: string; quote?: string }[]; target: SuggestionTarget | "none"; phrasing: string; source_ref: string };

/** Without an engine: the exact-keyword check for the terms the page recognises on its own. */
export function measureJob(jobText: string, measured: Measured): JobMatch {
	const { text, trimmed } = trimPosting(jobText);
	return { title: null, titleInCv: null, trimmed, aiRan: false, keywords: checkKeywords(text, measured.index), requirements: [], knockouts: [], summary: null };
}

const toRequirement = (r: RawRequirement): Requirement => ({
	text: r.text,
	kind: r.kind,
	importance: r.importance,
	knockout: r.knockout === "none" ? null : r.knockout,
	years: r.years > 0 ? r.years : null,
	level: r.level || null,
});

function suggestionFor(m: RawMatch, requirement: Requirement, measured: Measured): Suggestion | null {
	if (m.status === "matched") return null;
	const target = m.target === "none" ? null : m.target;
	const line = m.source_ref ? measured.index.byRef.get(m.source_ref) : undefined;
	if (!m.phrasing) return { target, phrasing: null, sourceRef: null, sourceLine: null, rejected: [], provenance: "ai-verified" };
	// The guard decides whether the model's phrasing may be shown (research R5).
	const guard = guardPhrasing(m.phrasing, line?.text ?? "", requirement.text);
	if (!line || !guard.ok) {
		return { target, phrasing: null, sourceRef: line?.ref ?? null, sourceLine: line?.text ?? null, rejected: line ? guard.added : ["source"], provenance: "ai-unverified" };
	}
	return { target, phrasing: m.phrasing, sourceRef: line.ref, sourceLine: line.text, rejected: [], provenance: "ai-verified" };
}

function jobFindings(job: JobMatch, lang: Lang): Finding[] {
	const out: Finding[] = [];
	const make = (type: string, title: string, fix?: string, evidence: Finding["evidence"] = []): Finding => {
		const c = entry(type);
		return { type, category: c.category, severity: c.severity, title, why: c.why[lang], fix: fix || c.fix[lang], evidence, provenance: c.source === "measured" ? "measured" : "ai-verified" };
	};
	for (const m of job.requirements) {
		if (m.status !== "missing" || m.requirement.importance !== "required" || m.requirement.knockout) continue;
		out.push(make("missing_requirement", `${entry("missing_requirement").title[lang]}: ${m.requirement.text}`, m.suggestion?.phrasing ?? undefined));
	}
	for (const k of job.knockouts) {
		if (k.outcome === "fails") out.push(make("knockout_failed", `${entry("knockout_failed").title[lang]}: ${k.requirement.text}`, undefined, k.evidence));
		if (k.outcome === "not-stated") out.push(make("knockout_not_stated", `${entry("knockout_not_stated").title[lang]}: ${k.requirement.text}`));
	}
	if (job.title && job.titleInCv === false) out.push(make("title_mismatch", entry("title_mismatch").title[lang]));
	return out;
}

export async function compareJob(input: CompareJobInput): Promise<Report> {
	const { measured, report, engine, lang, signal, onProgress } = input;
	if (!engine || !report.profile) return withJob(report, measureJob(input.jobText, measured), []);

	const { text, trimmed } = trimPosting(input.jobText);
	const ctx: TaskContext = {
		lang,
		docInfo: measured.info,
		outline: measured.outline,
		layoutFacts: layoutFactsForModel(measured.facts, measured.index.doc.format),
		measured: [],
		jobText: text,
		jobTitle: input.jobTitle,
		compactProfile: compactProfile(report.profile),
	};
	const base = await engine.createSession({ system: SYSTEM_PROMPT, langs: engineLangs(lang), signal });
	try {
		const run = { base, index: measured.index, ctx, log: report.log, signal, now: input.now };
		onProgress?.("extract_job");
		const extracted = (await runTask("extract_job", run)) as { title: string; requirements: RawRequirement[] };
		const requirements = extracted.requirements.map(toRequirement);
		ctx.requirements = requirements.map((r) => ({ text: r.text, importance: r.importance }));
		if (!ctx.jobTitle && extracted.title) ctx.jobTitle = extracted.title;

		onProgress?.("match_job");
		const matched = (await runTask("match_job", run)) as { title_in_cv: boolean; matches: RawMatch[] };
		const byText = new Map(matched.matches.map((m) => [m.requirement.trim().toLowerCase(), m]));
		const matches: RequirementMatch[] = requirements.map((requirement, i) => {
			const m = byText.get(requirement.text.trim().toLowerCase()) ?? matched.matches[i];
			if (!m) return { requirement, status: "missing", evidence: [], suggestion: null };
			return { requirement, status: m.status, evidence: verifyEvidence(m.evidence, measured.index), suggestion: suggestionFor(m, requirement, measured) };
		});

		const knockouts: KnockoutResult[] = evaluateKnockouts(requirements, report.profile, measured.index, input.today);
		const job: JobMatch = {
			title: ctx.jobTitle || null,
			titleInCv: ctx.jobTitle ? matched.title_in_cv : null,
			trimmed,
			aiRan: true,
			keywords: checkKeywords(text, measured.index, requirements),
			requirements: matches,
			knockouts,
			summary: summarise(matches, knockouts),
		};
		return withJob(report, job, jobFindings(job, lang));
	} finally {
		base.destroy();
	}
}
