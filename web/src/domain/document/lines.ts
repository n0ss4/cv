// Line reconstruction from positioned text items.
//
// Two views of the same page, because ATS parsers come in two kinds:
//
//   geometricLines  items grouped by baseline and sorted left to right, split
//                   into segments wherever a wide horizontal gap appears. This
//                   is what the page *looks* like, and is how the layout facts
//                   find columns, tables and right-aligned dates.
//
//   atsLines        items in the order the file stores them, broken where the
//                   file says a line ends. This is what a naive extractor reads,
//                   and is the "ATS view" the user sees. Orphaned bullets,
//                   detached dates and hyphenated words are found here.

import type { Page, PositionedItem } from "./types";

const SAME_LINE = 0.4; // baseline tolerance, as a fraction of font height
const SEGMENT_GAP = 2; // a gap wider than this many font heights starts a new segment
const WORD_GAP = 0.15; // a gap wider than this inserts a space between items

export interface Segment {
	x0: number;
	x1: number;
	text: string;
}

export interface GeoLine {
	page: number;
	index: number;
	y: number;
	h: number;
	text: string;
	segments: Segment[];
}

export interface AtsLine {
	text: string;
	/** Largest font height on the line; 0 when the format has no positions. */
	h: number;
	/** Most of the line's characters are set in a bold face. */
	bold: boolean;
}

function joinItems(items: PositionedItem[]): string {
	let text = "";
	let prev: PositionedItem | null = null;
	for (const it of items) {
		if (prev) {
			const gap = it.x - (prev.x + prev.w);
			const h = Math.max(prev.h, it.h, 1);
			if (gap > WORD_GAP * h && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
		}
		text += it.str;
		prev = it;
	}
	return text.replace(/\s+/g, " ").trim();
}

export function geometricLines(page: Page): GeoLine[] {
	const items = (page.items ?? [])
		.filter((it) => it.str && it.str.trim() && it.h > 0)
		.slice()
		.sort((a, b) => b.y - a.y || a.x - b.x);

	const rows: { y: number; h: number; items: PositionedItem[] }[] = [];
	for (const it of items) {
		const row = rows[rows.length - 1];
		if (row && Math.abs(row.y - it.y) <= SAME_LINE * Math.max(row.h, it.h)) {
			row.items.push(it);
			row.h = Math.max(row.h, it.h);
		} else {
			rows.push({ y: it.y, h: it.h, items: [it] });
		}
	}

	return rows.map((row, index) => {
		const sorted = row.items.sort((a, b) => a.x - b.x);
		const groups: PositionedItem[][] = [];
		let current: PositionedItem[] = [];
		for (const it of sorted) {
			const prev = current[current.length - 1];
			if (prev && it.x - (prev.x + prev.w) > SEGMENT_GAP * Math.max(prev.h, it.h)) {
				groups.push(current);
				current = [];
			}
			current.push(it);
		}
		groups.push(current);
		const segments = groups.map((g) => {
			const first = g[0]!;
			const last = g[g.length - 1]!;
			return { x0: first.x, x1: last.x + last.w, text: joinItems(g) };
		});
		return {
			page: page.number,
			index,
			y: row.y,
			h: row.h,
			text: segments.map((s) => s.text).join("   "),
			segments,
		};
	});
}

export function atsLines(page: Page): AtsLine[] {
	if (!page.items) return (page.lines ?? []).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean).map((text) => ({ text, h: 0, bold: false }));

	const lines: AtsLine[] = [];
	let current: PositionedItem[] = [];
	let prev: PositionedItem | null = null;
	const flush = () => {
		const text = joinItems(current);
		if (text) {
			const visible = current.filter((it) => it.str.trim());
			const boldChars = visible.filter((it) => it.bold).reduce((n, it) => n + it.str.length, 0);
			const allChars = visible.reduce((n, it) => n + it.str.length, 0) || 1;
			lines.push({ text, h: Math.max(0, ...visible.map((it) => it.h)), bold: boldChars / allChars > 0.5 });
		}
		current = [];
	};
	for (const it of page.items) {
		if (prev && current.length && Math.abs(prev.y - it.y) > SAME_LINE * Math.max(prev.h, it.h, 1) && it.str.trim()) flush();
		if (it.str) current.push(it);
		if (it.eol) flush();
		if (it.str.trim()) prev = it;
	}
	flush();
	return lines;
}
