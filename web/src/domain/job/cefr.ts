// Language levels on the CEFR scale (research R4 of spec 004). Only explicit
// levels compare; "fluent" or "professional" are too vague to decide on.

import { fold } from "../document/text";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
const NATIVE = /\b(native|nativo|nativa|bilingual|bilingue|mother tongue|lengua materna|llengua materna|natiu|nativ|muttersprache|langue maternelle)\b/;

/** 0 (A1) … 5 (C2), or null when the text states no comparable level. */
export function parseLevel(text: string | null | undefined): number | null {
	if (!text) return null;
	const t = fold(text);
	const m = /\b([abc][12])\b/.exec(t);
	if (m) return LEVELS.indexOf(m[1] as (typeof LEVELS)[number]);
	return NATIVE.test(t) ? 5 : null;
}

export const levelName = (n: number) => LEVELS[n]!.toUpperCase();
