// Exact keywords (US2 of spec 004): does the CV contain the posting's own
// words, another form of them, or neither? Measured: equivalence comes from
// the reviewed list, never from the model.

import type { LineIndex, LineRef } from "../document/lineIndex";
import { EQUIVALENCES } from "./equivalences";
import type { Importance, KeywordCheck, Requirement } from "./model";
import { displayForm, findInCv, hasForm, postingTerms } from "./terms";

const STATUS_ORDER = { missing: 0, variant: 1, exact: 2 } as const;

// Work arrangements are hard filters (knockouts.ts), not words a recruiter types
// into a skills search; listing "remote" as a missing keyword would mislead.
const NOT_SEARCH_TERMS = new Set(["remote", "hybrid", "work-permit", "eu-citizen", "driving-licence"]);

function importanceOf(form: string, requirements: Requirement[]): Importance | "unknown" {
	const hits = requirements.filter((r) => hasForm(r.text, form));
	if (!hits.length) return "unknown";
	return hits.some((r) => r.importance === "required") ? "required" : "preferred";
}

/**
 * Posting terms from the equivalence list are always checked. Short skill or
 * certification requirements the model extracted, that no group covers, are
 * checked literally too (exact or missing only).
 */
export function checkKeywords(posting: string, index: LineIndex, requirements: Requirement[] = []): KeywordCheck[] {
	const out: KeywordCheck[] = [];
	for (const { group, form, forms } of postingTerms(posting)) {
		if (NOT_SEARCH_TERMS.has(group.id)) continue;
		// Any wording the posting itself uses is an exact hit for a literal search.
		let exact: { ref: LineRef; text: string } | null = null;
		let exactForm = form;
		for (const f of forms) {
			exact = findInCv(index, f);
			if (exact) {
				exactForm = f;
				break;
			}
		}
		let variant: { form: string; hit: { ref: LineRef; text: string } } | null = null;
		if (!exact) {
			for (const other of group.forms) {
				if (forms.includes(other)) continue;
				const hit = findInCv(index, other);
				if (hit) {
					variant = { form: other, hit };
					break;
				}
			}
		}
		const hit = exact ?? variant?.hit ?? null;
		out.push({
			term: displayForm(form),
			group: group.id,
			status: exact ? "exact" : variant ? "variant" : "missing",
			cvTerm: exact ? displayForm(exactForm) : variant ? displayForm(variant.form) : null,
			ref: hit?.ref ?? null,
			line: hit?.text ?? null,
			importance: importanceOf(form, requirements),
			provenance: "measured",
		});
	}

	const covered = (text: string) => EQUIVALENCES.some((g) => g.forms.some((f) => hasForm(text, f)));
	for (const r of requirements) {
		if (r.kind !== "skill" && r.kind !== "certification") continue;
		const term = r.text.trim();
		if (term.split(/\s+/).length > 3 || covered(term) || out.some((k) => k.term.toLowerCase() === term.toLowerCase())) continue;
		const hit = findInCv(index, term);
		out.push({
			term, group: null, status: hit ? "exact" : "missing", cvTerm: hit ? term : null,
			ref: hit?.ref ?? null, line: hit?.text ?? null, importance: r.importance,
			// The model proposed the term; whether the CV contains it was checked literally.
			provenance: "ai-verified",
		});
	}

	const rank = (k: KeywordCheck) => (k.importance === "required" ? 0 : k.importance === "unknown" ? 1 : 2);
	return out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || rank(a) - rank(b));
}
