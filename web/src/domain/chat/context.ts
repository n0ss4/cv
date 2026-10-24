// What the chat knows about the posting in context (spec 006): a compact form
// of the page's job match for the prompt (research R5), the posting terms a
// rewrite may use, and the cards an answer may show.

import { fold } from "../document/text";
import type { JobMatch } from "../job/model";
import { CARD_KINDS, type Card, type CardKind, type PageEvent } from "./model";

const cut = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function compactJob(job: JobMatch) {
	return {
		title: job.title,
		title_in_cv: job.titleInCv,
		match: job.summary
			? {
				percent: job.summary.percent,
				verdict: job.summary.verdict,
				required_covered: `${job.summary.required.covered}/${job.summary.required.total}`,
				preferred_covered: `${job.summary.preferred.covered}/${job.summary.preferred.total}`,
				missing_required: job.summary.missingRequired.slice(0, 6).map((t) => cut(t)),
			}
			: null,
		hard_filters: job.knockouts.slice(0, 6).map((k) => ({ requirement: cut(k.requirement.text), outcome: k.outcome })),
		keywords: job.keywords.slice(0, 15).map((k) => ({ term: k.term, status: k.status, ...(k.cvTerm && k.status === "variant" ? { cv_says: k.cvTerm } : {}) })),
		requirements: job.requirements.slice(0, 10).map((r) => ({ text: cut(r.requirement.text), importance: r.requirement.importance, status: r.status })),
	};
}

/**
 * The posting's terms the CV already contains, in its own form or the
 * posting's: a rewrite may use them ("Kubernetes" where the CV says "K8s").
 */
export function postingTermsInCv(job: JobMatch | undefined): string {
	if (!job) return "";
	return job.keywords.filter((k) => k.status !== "missing").flatMap((k) => [k.term, k.cvTerm ?? ""]).filter(Boolean).join("\n");
}

/** Of a rewrite's additions, the terms the posting asks for and the CV lacks. */
export function postingMissing(added: string[], job: JobMatch | undefined): string[] {
	if (!job) return [];
	const missing = new Set(job.keywords.filter((k) => k.status === "missing").map((k) => fold(k.term)));
	return added.filter((a) => missing.has(fold(a)));
}

const HAS_DATA: Record<CardKind, (job: JobMatch) => boolean> = {
	fit: (job) => job.summary !== null,
	knockouts: (job) => job.knockouts.length > 0,
	keywords: (job) => job.keywords.some((k) => k.status !== "exact"),
	gaps: (job) => job.requirements.some((r) => r.status !== "matched"),
};

/** The cards an answer asked for that the comparison can actually fill, at most 2. */
export function cardsFor(kinds: string[], job: JobMatch | undefined): Card[] {
	if (!job) return [];
	const wanted = [...new Set(kinds)].filter((k): k is CardKind => (CARD_KINDS as readonly string[]).includes(k));
	return wanted.filter((k) => HAS_DATA[k](job)).slice(0, 2).map((kind) => ({ kind, job }));
}

/** The page's one-line message about a comparison. */
export function jobEvent(job: JobMatch, before: number | null): PageEvent {
	return {
		kind: "job",
		title: job.title,
		percent: job.summary?.percent ?? null,
		before,
		required: job.summary ? job.summary.required : null,
		fails: job.knockouts.filter((k) => k.outcome === "fails").length,
		notStated: job.knockouts.filter((k) => k.outcome === "not-stated").length,
		missingKeywords: job.keywords.filter((k) => k.status === "missing").length,
		trimmed: job.trimmed,
	};
}
