// Years of experience, computed from the dated roles -- never by the model
// (research R3 of spec 004): month precision when a month is given, a bare
// year covers January–December, overlapping roles count once, "present" is
// today.

import { fold } from "../document/text";
import type { ExperienceEntry } from "../profile/types";

// Month names and abbreviations in en, es, ca, fr, de, pt, folded (no accents).
const MONTHS: Record<string, number> = {};
const names: [number, string[]][] = [
	[1, ["jan", "january", "ene", "enero", "gen", "gener", "janv", "janvier", "januar", "janeiro"]],
	[2, ["feb", "february", "febrero", "febr", "febrer", "fev", "fevr", "fevrier", "februar", "fevereiro"]],
	[3, ["mar", "march", "marzo", "marc", "mars", "marz", "marco"]],
	[4, ["apr", "april", "abr", "abril", "avr", "avril"]],
	[5, ["may", "mayo", "maig", "mai", "maio"]],
	[6, ["jun", "june", "junio", "juny", "juin", "juni", "junho"]],
	[7, ["jul", "july", "julio", "juliol", "juil", "juillet", "juli", "julho"]],
	[8, ["aug", "august", "ago", "agosto", "ag", "agost", "aout"]],
	[9, ["sep", "sept", "september", "septiembre", "setiembre", "set", "setembre", "septembre", "setembro"]],
	[10, ["oct", "october", "octubre", "octobre", "okt", "oktober", "out", "outubro"]],
	[11, ["nov", "november", "noviembre", "novembre", "novembro"]],
	[12, ["dec", "december", "dic", "diciembre", "des", "desembre", "decembre", "dez", "dezember", "dezembro"]],
];
for (const [n, list] of names) for (const name of list) MONTHS[name] = n;

const PRESENT = /\b(present|current|now|today|actualidad|actual|presente|hoy|actualitat|avui|aujourd'?hui|heute|atual|oggi)\b/;

/** A month count (year × 12 + month − 1), "present", or null when the text has no usable date. */
export function parseDate(raw: string | null | undefined, edge: "start" | "end"): number | "present" | null {
	if (!raw) return null;
	const text = fold(raw).replace(/\./g, " ");
	if (PRESENT.test(text)) return "present";
	// YYYY-MM
	let m = /\b((?:19|20)\d{2})-(\d{1,2})\b/.exec(text);
	if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
	// MM/YYYY (also the end of DD/MM/YYYY)
	m = /\b(\d{1,2})[/-]((?:19|20)\d{2})\b/.exec(text);
	if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return Number(m[2]) * 12 + Number(m[1]) - 1;
	// Month name + year ("Mar 2021", "marzo de 2021")
	const year = /\b((?:19|20)\d{2})\b/.exec(text)?.[1];
	const word = text.split(/[^a-z]+/).find((w) => w in MONTHS);
	if (year && word) return Number(year) * 12 + MONTHS[word]! - 1;
	if (year) return Number(year) * 12 + (edge === "start" ? 0 : 11);
	// Two-digit year with apostrophe ("Jan '22")
	m = /['’‘](\d{2})\b/.exec(raw);
	if (m) {
		const y = 2000 + Number(m[1]);
		const yy = y > new Date().getFullYear() + 1 ? y - 100 : y;
		return yy * 12 + (word ? MONTHS[word]! - 1 : edge === "start" ? 0 : 11);
	}
	return null;
}

export interface YearsComputation {
	ranges: { from: string; to: string; ref: string | null }[];
	months: number;
	years: number;
	undated: number;
	dated: number;
}

const ym = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;

export function computeYears(experience: ExperienceEntry[], today: Date = new Date()): YearsComputation {
	const now = today.getFullYear() * 12 + today.getMonth();
	const spans: { from: number; to: number; ref: string | null }[] = [];
	let undated = 0;
	for (const e of experience) {
		const start = parseDate(e.start, "start");
		const endRaw = e.current ? "present" : parseDate(e.end, "end");
		const from = start === "present" ? null : start;
		const to = endRaw === "present" ? now : endRaw;
		if (from === null || to === null || to < from) {
			undated++;
			continue;
		}
		spans.push({ from, to, ref: e.refs?.[0] ?? null });
	}
	spans.sort((a, b) => a.from - b.from);
	const merged: typeof spans = [];
	for (const s of spans) {
		const last = merged[merged.length - 1];
		if (last && s.from <= last.to + 1) last.to = Math.max(last.to, s.to);
		else merged.push({ ...s });
	}
	const months = merged.reduce((n, s) => n + (s.to - s.from + 1), 0);
	return {
		ranges: merged.map((s) => ({ from: ym(s.from), to: ym(s.to), ref: s.ref })),
		months,
		years: Math.floor(months / 12),
		undated,
		dated: spans.length,
	};
}
