// JobMatch → what the Job match tab renders, in the order of contracts/job-match.md:
// summary, then what to fix first for this job, then the details.

import type { JobMatch, KnockoutResult, RequirementMatch } from "@domain/job/model";

export type Priority =
	| { kind: "knockout"; key: string; result: KnockoutResult }
	| { kind: "requirement"; key: string; match: RequirementMatch };

export interface JobView {
	job: JobMatch;
	priorities: Priority[];
	/** Requirements, missing first, then partial, then matched; required before preferred. */
	requirements: RequirementMatch[];
}

const STATUS = { missing: 0, partial: 1, matched: 2 } as const;

export function presentJob(job: JobMatch): JobView {
	const priorities: Priority[] = [
		...job.knockouts.filter((k) => k.outcome === "fails").map((result, i) => ({ kind: "knockout" as const, key: `kf${i}`, result })),
		...job.requirements
			.filter((m) => m.requirement.importance === "required" && m.status === "missing" && !m.requirement.knockout)
			.map((match, i) => ({ kind: "requirement" as const, key: `rm${i}`, match })),
		...job.knockouts.filter((k) => k.outcome === "not-stated").map((result, i) => ({ kind: "knockout" as const, key: `kn${i}`, result })),
	];
	const requirements = [...job.requirements].sort(
		(a, b) => STATUS[a.status] - STATUS[b.status] || (a.requirement.importance === "required" ? 0 : 1) - (b.requirement.importance === "required" ? 0 : 1),
	);
	return { job, priorities, requirements };
}
