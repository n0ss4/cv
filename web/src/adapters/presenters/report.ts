// Report → what the results screen renders. Grouping and labelling only: no
// domain decisions are made here, and no user-facing strings are invented
// (labels are i18n keys the UI translates; finding texts come from the
// catalogue or the model, already in the user's language).

import { CATALOGUE_ENTRIES } from "@domain/findings/catalogue";
import type { Category, Finding, Provenance, Severity } from "@domain/findings/types";
import { ruleApplicable } from "@domain/layout/rules";
import type { Report } from "@domain/report/report";
import { WEIGHTS, KEYWORDS_WEIGHT } from "@domain/scoring/score";

export interface FindingView {
	key: string;
	type: string;
	category: Category;
	severity: Severity;
	title: string;
	why: string;
	fix: string;
	provenance: Provenance;
	evidence: { ref: string; quote?: string; verified: boolean }[];
	searchable: boolean;
}

export interface CheckLine {
	type: string;
	title: string;
	source: "measured" | "ai";
}

export interface CategoryGroup {
	category: Category;
	score: number | null;
	weight: number;
	attention: FindingView[];
	passed: CheckLine[];
	notApplicable: CheckLine[];
	/** AI checks that did not run (no engine, or a failed task). */
	notChecked: CheckLine[];
}

export interface ReportView {
	verdict: Report["verdict"];
	overall: number | null;
	capped: boolean;
	counts: Record<Severity, number>;
	fixFirst: FindingView[];
	groups: CategoryGroup[];
	strengths: string[];
	engine: Report["engine"];
	promptVersion: string;
	failedTasks: string[];
}

const ORDER: Category[] = ["parsing", "contact", "sections", "content", "language", "dates", "length", "keywords"];

export function findingView(f: Finding, i = 0): FindingView {
	const c = CATALOGUE_ENTRIES.find((x) => x.type === f.type);
	return {
		key: `${f.type}-${i}`,
		type: f.type,
		category: f.category,
		severity: f.severity,
		title: f.title,
		why: f.why,
		fix: f.fix,
		provenance: f.provenance,
		evidence: f.evidence.map((e) => ({ ref: String(e.ref), quote: e.quote, verified: e.verified })),
		searchable: Boolean(c?.searchable),
	};
}

export function presentReport(report: Report, lang: "en" | "es"): ReportView {
	const reported = new Set(report.findings.map((f) => f.type));
	const aiRan = report.profile !== null && report.failed.length === 0;
	const views = report.findings.map(findingView);
	const groups: CategoryGroup[] = ORDER.filter((c) => c !== "keywords" || report.job).map((category) => {
		const entries = CATALOGUE_ENTRIES.filter((c) => c.category === category && (!c.job || report.job) && c.type !== "no_text_layer");
		const line = (c: (typeof entries)[number]): CheckLine => ({ type: c.type, title: c.title[lang], source: c.source });
		const unreported = entries.filter((c) => !reported.has(c.type));
		return {
			category,
			score: report.categories[category] ?? null,
			weight: category === "keywords" ? KEYWORDS_WEIGHT : WEIGHTS[category],
			attention: views.filter((v) => v.category === category),
			passed: unreported.filter((c) => (c.source === "measured" ? ruleApplicable(c.type, report.facts) : aiRan)).map(line),
			notApplicable: unreported.filter((c) => c.source === "measured" && !ruleApplicable(c.type, report.facts)).map(line),
			notChecked: unreported.filter((c) => c.source === "ai" && !aiRan).map(line),
		};
	});
	const counts = { critical: 0, major: 0, minor: 0 };
	for (const f of report.findings) counts[f.severity]++;
	return {
		verdict: report.verdict,
		overall: report.overall,
		capped: report.overall !== null && (report.verdict === "not-ready" || report.verdict === "needs-work"),
		counts,
		fixFirst: report.fixFirst.map(findingView),
		groups,
		strengths: report.strengths,
		engine: report.engine,
		promptVersion: report.promptVersion,
		failedTasks: report.failed.map((f) => f.task),
	};
}
