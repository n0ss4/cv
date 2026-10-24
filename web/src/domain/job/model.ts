// The job-match entities (data-model.md of spec 004).

import type { LineRef } from "../document/lineIndex";
import type { Evidence, Provenance } from "../findings/types";
import type { YearsComputation } from "./years";

export type KnockoutKind = "years" | "degree" | "language" | "certification" | "location" | "authorisation";
export type RequirementKind = "skill" | "experience" | "education" | "language" | "certification" | "location" | "authorisation" | "other";
export type Importance = "required" | "preferred";

export interface Requirement {
	text: string;
	kind: RequirementKind;
	importance: Importance;
	knockout: KnockoutKind | null;
	years: number | null;
	level: string | null;
}

export interface KeywordCheck {
	term: string;
	group: string | null;
	status: "exact" | "variant" | "missing";
	cvTerm: string | null;
	ref: LineRef | null;
	line: string | null;
	importance: Importance | "unknown";
	provenance: Provenance;
}

export type SuggestionTarget = "skills" | "experience" | "summary" | "headline";

export interface Suggestion {
	target: SuggestionTarget | null;
	phrasing: string | null;
	sourceRef: string | null;
	sourceLine: string | null;
	/** Why a model phrasing was withheld: it added facts its sources don't contain. */
	rejected: string[];
	provenance: Provenance;
}

export interface RequirementMatch {
	requirement: Requirement;
	status: "matched" | "partial" | "missing";
	evidence: Evidence[];
	suggestion: Suggestion | null;
}

export type KnockoutOutcome = "meets" | "fails" | "not-stated" | "unknown";

export interface KnockoutResult {
	requirement: Requirement;
	kind: KnockoutKind;
	outcome: KnockoutOutcome;
	evidence: Evidence[];
	detail: { key: string; params?: Record<string, string | number> };
	years?: YearsComputation;
}

export interface JobSummary {
	required: { covered: number; total: number };
	preferred: { covered: number; total: number };
	percent: number;
	verdict: "strong" | "close" | "gaps";
	missingRequired: string[];
}

export interface JobMatch {
	title: string | null;
	titleInCv: boolean | null;
	trimmed: boolean;
	aiRan: boolean;
	keywords: KeywordCheck[];
	requirements: RequirementMatch[];
	knockouts: KnockoutResult[];
	summary: JobSummary | null;
}
