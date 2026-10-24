// The full review of one document: measured findings always, AI extraction and
// review when an engine is ready. Produces the Report the results screen shows.

import type { Lang } from "@domain/findings/types";
import { entry } from "@domain/findings/catalogue";
import type { Finding } from "@domain/findings/types";
import { contradictsProfile, provenanceOf, verifyEvidence, verifyProfile } from "@domain/profile/verify";
import { buildReport, type Report, type ToolCall } from "@domain/report/report";
import { engineErrorText, runTask, TaskError, type StepEvent } from "../agent/orchestrator";
import { compactProfile, toProfile } from "../agent/profile";
import type { AiEngine, AiSession } from "../ports/AiEngine";
import { SYSTEM_PROMPT } from "../prompts/system";
import type { TaskContext, TaskName } from "../prompts/tasks";
import { PROMPT_VERSION } from "../prompts/version";
import { layoutFactsForModel } from "../tools/tools";
import { engineLangs } from "./engine";
import type { Measured } from "./measureLayout";

export const AI_STEPS = ["extract_contact", "extract_sections_experience", "extract_education_skills", "review"] as const satisfies readonly TaskName[];
export type AiStep = (typeof AI_STEPS)[number];

export type ProgressEvent =
	| { step: AiStep; status: "running" | "done" | "failed"; detail?: StepEvent }
	| { step: "engine"; status: "ready" };

export interface AnalyseInput {
	measured: Measured;
	engine: AiEngine | null;
	lang: Lang;
	signal?: AbortSignal;
	onProgress?: (e: ProgressEvent) => void;
	/** The log the UI shows live; the report keeps the same array. */
	log?: ToolCall[];
	now?: () => number;
	id?: string;
}

export function setupLog(measured: Measured, now: () => number): ToolCall[] {
	const at = now();
	// The facts the page computed before any model call, logged like tool calls
	// so the audit trail shows what the model was handed.
	return [
		{ task: "setup", step: 0, kind: "tool", tool: "doc_info", args: {}, result: measured.info, ms: 0, at },
		{ task: "setup", step: 0, kind: "tool", tool: "outline", args: {}, result: measured.outline, ms: 0, at },
		{ task: "setup", step: 0, kind: "tool", tool: "layout_facts", args: {}, result: layoutFactsForModel(measured.facts, measured.index.doc.format), ms: 0, at },
	];
}

export async function analyseCv(input: AnalyseInput): Promise<Report> {
	const { measured, engine, lang, signal, onProgress } = input;
	const now = input.now ?? Date.now;
	const log = input.log ?? [];
	if (!log.length) log.push(...setupLog(measured, now));
	const id = input.id ?? `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const common = { id, createdAt: now(), lang, docInfo: measured.info, facts: measured.facts, measured: measured.findings, log };

	if (measured.info.text_layer === "none" || !engine) return buildReport(common);

	const ctx: TaskContext = {
		lang,
		docInfo: measured.info,
		outline: measured.outline,
		layoutFacts: layoutFactsForModel(measured.facts, measured.index.doc.format),
		measured: measured.findings.map((f) => ({ type: f.type, title: f.title })),
	};
	// The base session holds only the system prompt; each task clones it. If
	// the engine ends it (Chrome does under memory pressure), a new one is
	// started and the task that hit it runs once more.
	const newBase = async (attempts: number): Promise<AiSession> => {
		for (let i = 1; ; i++) {
			try {
				return await engine.createSession({ system: SYSTEM_PROMPT, langs: engineLangs(lang), signal });
			} catch (err) {
				if (signal?.aborted || i >= attempts) {
					if (!signal?.aborted) log.push({ task: "setup", step: 0, kind: "failure", message: `the on-device model could not start (${engineErrorText(err)})`, ms: 0, at: now() });
					throw err;
				}
				log.push({ task: "setup", step: 0, kind: "retry", message: `the on-device model could not start (${engineErrorText(err)}); trying again`, ms: 0, at: now() });
			}
		}
	};
	let base = await newBase(2);
	onProgress?.({ step: "engine", status: "ready" });
	const failed: { task: string; message: string }[] = [];
	let engineGone = false;
	const run = async (name: AiStep) => {
		onProgress?.({ step: name, status: "running" });
		const fail = (message: string) => {
			failed.push({ task: name, message });
			log.push({ task: name, step: 0, kind: "failure", message, ms: 0, at: now() });
			onProgress?.({ step: name, status: "failed" });
			return null;
		};
		if (engineGone) return fail("skipped: the on-device model stopped responding");
		for (let attempt = 0; ; attempt++) {
			try {
				const out = await runTask(name, {
					base, index: measured.index, ctx, log, signal, now,
					onStep: (detail) => onProgress?.({ step: name, status: "running", detail }),
				});
				onProgress?.({ step: name, status: "done" });
				return out;
			} catch (err) {
				if (signal?.aborted) throw err;
				// A reply that failed validation twice is the task's answer; a
				// thrown engine error means the session died and is worth one more go.
				if (err instanceof TaskError) return fail(err.message);
				if (attempt > 0) return fail(`the on-device model stopped (${engineErrorText(err)})`);
				log.push({ task: name, step: 0, kind: "retry", message: `the on-device model stopped (${engineErrorText(err)}); starting a new session`, ms: 0, at: now() });
				base.destroy();
				try {
					base = await newBase(1);
				} catch (startErr) {
					if (signal?.aborted) throw startErr;
					engineGone = true;
					return fail(`the on-device model stopped (${engineErrorText(err)})`);
				}
			}
		}
	};

	try {
		const profile = toProfile([await run("extract_contact"), await run("extract_sections_experience"), await run("extract_education_skills")]);
		const verifiedShare = verifyProfile(profile, measured.index);
		ctx.compactProfile = compactProfile(profile);

		const review = (await run("review")) as { findings?: { type: string; title: string; why: string; fix: string; evidence: { ref: string; quote?: string }[] }[]; strengths?: string[] } | null;
		const findings: Finding[] = [];
		const seen = new Set<string>();
		for (const f of review?.findings ?? []) {
			const c = entry(f.type);
			// The review is told which types are measured; if it repeats one anyway
			// the measured finding wins. Duplicates and contradictions are dropped.
			if (c.source !== "ai" || seen.has(f.type) || contradictsProfile(f.type, profile)) continue;
			seen.add(f.type);
			const evidence = verifyEvidence(f.evidence, measured.index);
			findings.push({
				type: f.type, category: c.category, severity: c.severity,
				title: f.title || c.title[lang], why: f.why || c.why[lang], fix: f.fix || c.fix[lang],
				evidence, provenance: provenanceOf({ type: f.type, evidence }),
			});
		}

		return buildReport({
			...common,
			ai: {
				engine: { id: engine.id, model: engine.facts.model },
				promptVersion: PROMPT_VERSION,
				findings,
				strengths: review?.strengths ?? [],
				profile,
				verifiedShare,
				failed,
			},
		});
	} finally {
		base.destroy();
	}
}
