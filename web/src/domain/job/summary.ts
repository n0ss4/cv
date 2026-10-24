// Match summary (US1 of spec 004, research R7): a published formula, never
// the model. Required requirements weigh twice as much as preferred ones;
// matched = 1, partial = 0.5, missing = 0. A failed knock-out always means
// "gaps".

import type { JobSummary, KnockoutResult, RequirementMatch } from "./model";

export const WEIGHT = { required: 2, preferred: 1 } as const;
export const CREDIT = { matched: 1, partial: 0.5, missing: 0 } as const;

export function summarise(matches: RequirementMatch[], knockouts: KnockoutResult[]): JobSummary {
	const side = (importance: "required" | "preferred") => {
		const list = matches.filter((m) => m.requirement.importance === importance);
		return { covered: list.reduce((n, m) => n + CREDIT[m.status], 0), total: list.length };
	};
	const required = side("required");
	const preferred = side("preferred");
	const weight = required.total * WEIGHT.required + preferred.total * WEIGHT.preferred;
	const percent = weight ? Math.round((100 * (required.covered * WEIGHT.required + preferred.covered * WEIGHT.preferred)) / weight) : 100;

	const missingRequired = matches.filter((m) => m.requirement.importance === "required" && m.status === "missing").map((m) => m.requirement.text);
	const failed = knockouts.filter((k) => k.outcome === "fails").length;
	const unstated = knockouts.filter((k) => k.outcome === "not-stated").length;
	const verdict = failed > 0 || missingRequired.length + unstated > 1 ? "gaps" : missingRequired.length + unstated === 1 ? "close" : "strong";

	return { required, preferred, percent, verdict, missingRequired };
}
