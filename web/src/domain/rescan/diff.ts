// Before/after comparison of two analyses in the same session
// (contracts/findings.md#rescan-diff).

import { fold } from "../document/text";
import type { Finding } from "../findings/types";

// Types that can legitimately occur more than once are told apart by what they quote.
const BY_QUOTE = new Set(["unconventional_heading", "spelling_or_grammar", "first_person", "duty_style_bullets", "missing_requirement"]);

export function findingKey(f: Finding): string {
	return BY_QUOTE.has(f.type) ? `${f.type}:${fold(f.evidence[0]?.quote ?? f.title)}` : f.type;
}

export interface ReportSummary {
	verdict: string;
	overall: number | null;
	fileName: string;
	findings: Finding[];
}

export interface RescanDiff {
	previous: Omit<ReportSummary, "findings">;
	current: Omit<ReportSummary, "findings">;
	resolved: Finding[];
	added: Finding[];
	unchanged: Finding[];
}

export function diffReports(previous: ReportSummary, current: ReportSummary): RescanDiff {
	const before = new Map(previous.findings.map((f) => [findingKey(f), f]));
	const after = new Map(current.findings.map((f) => [findingKey(f), f]));
	const strip = ({ findings: _, ...rest }: ReportSummary) => rest;
	return {
		previous: strip(previous),
		current: strip(current),
		resolved: [...before].filter(([k]) => !after.has(k)).map(([, f]) => f),
		added: [...after].filter(([k]) => !before.has(k)).map(([, f]) => f),
		unchanged: [...after].filter(([k]) => before.has(k)).map(([, f]) => f),
	};
}
