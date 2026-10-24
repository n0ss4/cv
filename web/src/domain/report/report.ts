// The Report (data-model.md#report): everything the results screen shows,
// built from measured findings, AI findings, the verified profile and the
// audit log. Nothing here talks to a model.

import type { DocInfo } from "../document/lineIndex";
import type { Finding, Lang } from "../findings/types";
import type { LayoutFacts } from "../layout/facts";
import type { ExtractedProfile } from "../profile/types";
import type { JobMatch } from "../job/model";
import { capFor, fixFirst, scoreFindings, verdictFor, type Verdict } from "../scoring/score";
import { compareFindings } from "../scoring/score";

export interface ToolCall {
	task: string;
	step: number;
	kind: "tool" | "prompt" | "retry" | "failure";
	tool?: string;
	args?: Record<string, unknown>;
	result?: unknown;
	message?: string;
	ms: number;
	at: number;
}

export type { JobMatch } from "../job/model";

export interface Report {
	id: string;
	createdAt: number;
	lang: Lang;
	document: { fileName: string; format: string; pages: number; chars: number };
	docInfo: DocInfo;
	engine: { id: string; model: string } | null;
	promptVersion: string;
	verdict: Verdict;
	overall: number | null;
	categories: ReturnType<typeof scoreFindings>["categories"];
	fixFirst: Finding[];
	findings: Finding[];
	strengths: string[];
	profile: ExtractedProfile | null;
	verifiedShare: number;
	facts: LayoutFacts;
	log: ToolCall[];
	failed: { task: string; message: string }[];
	job?: JobMatch;
}

export interface ReportInput {
	id: string;
	createdAt: number;
	lang: Lang;
	docInfo: DocInfo;
	facts: LayoutFacts;
	measured: Finding[];
	ai?: {
		engine: { id: string; model: string };
		promptVersion: string;
		findings: Finding[];
		strengths: string[];
		profile: ExtractedProfile;
		verifiedShare: number;
		failed: { task: string; message: string }[];
	};
	log: ToolCall[];
}

export function buildReport(input: ReportInput): Report {
	const { docInfo, facts, measured, ai } = input;
	const findings = [...measured, ...(ai?.findings ?? [])].sort(compareFindings);
	const base = {
		id: input.id,
		createdAt: input.createdAt,
		lang: input.lang,
		document: { fileName: docInfo.file, format: docInfo.format, pages: docInfo.pages, chars: docInfo.chars },
		docInfo,
		engine: ai?.engine ?? null,
		promptVersion: ai?.promptVersion ?? "",
		findings,
		fixFirst: fixFirst(findings),
		strengths: ai?.strengths ?? [],
		profile: ai?.profile ?? null,
		verifiedShare: ai?.verifiedShare ?? 0,
		facts,
		log: input.log,
		failed: ai?.failed ?? [],
	};

	if (docInfo.text_layer === "none") return { ...base, verdict: "unreadable", overall: 0, categories: {} };
	// Without a model there is no content review, so a score would only cover
	// layout and read as a verdict on the whole CV. Measured findings only.
	if (!ai) return { ...base, verdict: "measured-only", overall: null, categories: {} };
	// Failed tasks leave too little evidence to score safely; without this an
	// empty findings list would become a misleading 100/ready.
	if (ai.failed.length) return { ...base, verdict: "incomplete", overall: null, categories: {} };

	const { categories, overall } = scoreFindings(findings);
	const verdict = verdictFor(findings);
	return { ...base, verdict, overall: capFor(verdict, overall), categories };
}

/** Re-scores after a job comparison: adds the keywords category and the job findings. */
export function withJob(report: Report, job: JobMatch, jobFindings: Finding[]): Report {
	const findings = [...report.findings.filter((f) => f.category !== "keywords"), ...jobFindings].sort(compareFindings);
	if (report.overall === null) return { ...report, job, findings, fixFirst: fixFirst(findings) };
	const { categories, overall } = scoreFindings(findings, job.summary ? { percent: job.summary.percent } : undefined);
	const verdict = verdictFor(findings);
	return { ...report, job, findings, fixFirst: fixFirst(findings), categories, verdict, overall: capFor(verdict, overall) };
}
