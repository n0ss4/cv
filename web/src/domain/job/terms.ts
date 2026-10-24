// Word-bounded literal term search, the way a recruiter's ATS search behaves.

import type { LineIndex, LineRef } from "../document/lineIndex";
import { fold } from "../document/text";
import { EQUIVALENCES, type EquivalenceGroup } from "./equivalences";

/** Lower-case, no accents, punctuation as spaces except + # . / inside words; trailing dots dropped. */
export function normaliseForTerms(text: string): string {
	return ` ${fold(text)
		.replace(/[^a-z0-9+#./\s]/g, " ")
		.replace(/\//g, " ")
		.split(/\s+/)
		.map((t) => t.replace(/\.+$/, ""))
		.filter(Boolean)
		.join(" ")} `;
}

const strict = (form: string) => form.startsWith("=");
const bare = (form: string) => (strict(form) ? form.slice(1) : form);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Is this form in the text? Strict forms match case-sensitively on the raw text. */
export function hasForm(text: string, form: string, normalised = normaliseForTerms(text)): boolean {
	if (strict(form)) return new RegExp(`(^|[^\\p{L}\\p{N}+#&])${escape(bare(form))}(?=$|[^\\p{L}\\p{N}+#&])`, "u").test(text);
	const needle = normaliseForTerms(form);
	return needle.trim().length > 0 && normalised.includes(needle);
}

export interface PostingTerm {
	group: EquivalenceGroup;
	/** The form the posting uses -- the one the CV should contain ("=" marks a case-sensitive form). */
	form: string;
	/** Every form of the group the posting contains: "Apache Kafka" also contains "Kafka". */
	forms: string[];
}

/** Equivalence groups the posting mentions, with the posting's own wording. */
export function postingTerms(posting: string): PostingTerm[] {
	const normalised = normaliseForTerms(posting);
	const out: PostingTerm[] = [];
	for (const group of EQUIVALENCES) {
		// Longest form first, so "machine learning" wins over "ML".
		const forms = [...group.forms].sort((a, b) => bare(b).length - bare(a).length);
		const present = forms.filter((f) => hasForm(posting, f, normalised));
		if (present.length) out.push({ group, form: present[0]!, forms: present });
	}
	return out;
}

/** First CV line containing the form, word-bounded. */
export function findInCv(index: LineIndex, form: string): { ref: LineRef; text: string } | null {
	for (const line of index.lines) if (hasForm(line.text, form)) return { ref: line.ref, text: line.text };
	return null;
}

export const displayForm = bare;
