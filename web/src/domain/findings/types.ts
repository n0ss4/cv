import type { LineRef } from "../document/lineIndex";

export type Category = "parsing" | "contact" | "sections" | "content" | "language" | "dates" | "length" | "keywords";
export type Severity = "critical" | "major" | "minor";
export type Source = "measured" | "ai";
export type Provenance = "measured" | "ai-verified" | "ai-unverified";
export type Lang = "en" | "es";

export interface Evidence {
	ref: LineRef | string;
	quote?: string;
	verified: boolean;
}

export interface Finding {
	type: string;
	category: Category;
	severity: Severity;
	title: string;
	why: string;
	fix: string;
	evidence: Evidence[];
	provenance: Provenance;
}

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
