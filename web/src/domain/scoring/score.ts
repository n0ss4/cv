// Verdict and scores, from the published formula in contracts/findings.md.
// The model is never asked for a number: a score it could not explain would be
// worthless, and the page shows this formula to the user.

import type { Category, Finding, Provenance, Severity } from "../findings/types";
import { SEVERITY_ORDER } from "../findings/types";
import { CATALOGUE_ENTRIES } from "../findings/catalogue";

export const WEIGHTS: Record<Exclude<Category, "keywords">, number> = {
	parsing: 30, contact: 15, sections: 15, content: 20, language: 5, dates: 10, length: 5,
};
export const KEYWORDS_WEIGHT = 20;
export const PENALTY: Record<Severity, number> = { critical: 45, major: 20, minor: 7 };
export const CAPS = { "not-ready": 59, "needs-work": 79 } as const;
export const FIX_FIRST_MAX = 5;

export type Verdict = "ready" | "needs-work" | "not-ready" | "unreadable" | "incomplete" | "measured-only";

/** The job match's published percentage (spec 004, research R7) becomes the keywords category. */
export interface JobMatchSummary {
	percent: number;
}

export function categoryScore(findings: Finding[]): number {
	return Math.max(0, 100 - findings.reduce((sum, f) => sum + PENALTY[f.severity], 0));
}

export function verdictFor(findings: Finding[]): "ready" | "needs-work" | "not-ready" {
	if (findings.some((f) => f.severity === "critical")) return "not-ready";
	if (findings.some((f) => f.severity === "major")) return "needs-work";
	return "ready";
}

/** A score must not contradict the verdict: "not ready" with 84/100 reads as "fine". */
export function capFor(verdict: Verdict, overall: number): number {
	if (verdict === "not-ready") return Math.min(overall, CAPS["not-ready"]);
	if (verdict === "needs-work") return Math.min(overall, CAPS["needs-work"]);
	return overall;
}

export function scoreFindings(findings: Finding[], job?: JobMatchSummary) {
	const categories: Partial<Record<Category, number>> = {};
	const weights: Partial<Record<Category, number>> = { ...WEIGHTS };
	for (const name of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
		categories[name] = categoryScore(findings.filter((f) => f.category === name));
	}
	if (job) {
		categories.keywords = job.percent;
		weights.keywords = KEYWORDS_WEIGHT;
	}
	const entries = Object.entries(weights) as [Category, number][];
	const total = entries.reduce((a, [, w]) => a + w, 0);
	const overall = Math.round(entries.reduce((sum, [k, w]) => sum + (categories[k] ?? 0) * w, 0) / total);
	return { categories, overall };
}

const CATEGORY_WEIGHT: Record<Category, number> = { ...WEIGHTS, keywords: KEYWORDS_WEIGHT };
const PROVENANCE_ORDER: Record<Provenance, number> = { measured: 0, "ai-verified": 1, "ai-unverified": 2 };
const CATALOGUE_ORDER = new Map(CATALOGUE_ENTRIES.map((c, i) => [c.type, i]));

function position(f: Finding): number {
	const m = /^p(\d+):(\d+)$/.exec(String(f.evidence[0]?.ref ?? ""));
	return m ? Number(m[1]) * 10_000 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

/** Severity, then category weight, then provenance, then position in the document, then catalogue order. */
export function compareFindings(a: Finding, b: Finding): number {
	return (
		SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
		CATEGORY_WEIGHT[b.category] - CATEGORY_WEIGHT[a.category] ||
		PROVENANCE_ORDER[a.provenance] - PROVENANCE_ORDER[b.provenance] ||
		position(a) - position(b) ||
		(CATALOGUE_ORDER.get(a.type) ?? 0) - (CATALOGUE_ORDER.get(b.type) ?? 0)
	);
}

export function fixFirst(findings: Finding[]): Finding[] {
	return [...findings].sort(compareFindings).slice(0, FIX_FIRST_MAX);
}
