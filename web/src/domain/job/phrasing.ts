// The guard on suggested phrasings (research R5 of spec 004): a suggestion
// may reword what the CV already says and name the requirement, nothing more.
// Every number, capitalised name and known technical term in it must appear on
// the cited CV line or in the requirement; otherwise it is rejected.

import { fold } from "../document/text";
import { EQUIVALENCES } from "./equivalences";
import { hasForm, normaliseForTerms } from "./terms";

const NUMBER = /\d+(?:[.,]\d+)?/g;
// A capitalised word that does not start a sentence: a name, employer, product.
const PROPER = /(?<![.!?:]\s|^)\b\p{Lu}[\p{L}\p{N}.+#-]*/gu;

export interface GuardResult {
	ok: boolean;
	/** What the phrasing added that its sources don't contain. */
	added: string[];
}

export function guardPhrasing(phrasing: string, sourceLine: string, requirement: string): GuardResult {
	const allowed = `${sourceLine}\n${requirement}`;
	const allowedFolded = fold(allowed);
	const allowedTerms = normaliseForTerms(allowed);
	const added = new Set<string>();

	for (const n of phrasing.match(NUMBER) ?? []) if (!allowed.includes(n)) added.add(n);
	for (const w of phrasing.match(PROPER) ?? []) {
		const word = w.replace(/[.,;:]+$/, "");
		if (word.length > 1 && !allowedFolded.includes(fold(word))) added.add(word);
	}
	for (const group of EQUIVALENCES) {
		const used = group.forms.find((f) => hasForm(phrasing, f));
		if (used && !group.forms.some((f) => hasForm(allowed, f, allowedTerms))) added.add(used.replace(/^=/, ""));
	}
	return { ok: added.size === 0, added: [...added] };
}
