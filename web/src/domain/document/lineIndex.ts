// The line index every tool, fact and verification reads from. Line numbers
// follow the parser (ATS) order, 1-based per page: "p1:12".

import { atsLines, geometricLines, type GeoLine } from "./lines";
import { fold, nonSpace } from "./text";
import type { Document } from "./types";

export type LineRef = `p${number}:${number}`;

export interface IndexedLine {
	ref: LineRef;
	page: number;
	line: number;
	text: string;
	h: number;
	bold: boolean;
}

export interface IndexedPage {
	number: number;
	width: number | undefined;
	height: number | undefined;
	lines: IndexedLine[];
	/** Empty when the format has no positions. */
	geo: GeoLine[];
}

export interface LineIndex {
	doc: Document;
	pages: IndexedPage[];
	lines: IndexedLine[];
	byRef: ReadonlyMap<string, IndexedLine>;
	text: string;
}

export const lineRef = (page: number, line: number): LineRef => `p${page}:${line}`;

export function indexDocument(doc: Document): LineIndex {
	const pages = doc.pages.map((page) => ({
		number: page.number,
		width: page.width,
		height: page.height,
		lines: atsLines(page).map((l, i) => ({ ...l, ref: lineRef(page.number, i + 1), page: page.number, line: i + 1 })),
		geo: page.items ? geometricLines(page) : [],
	}));
	const lines = pages.flatMap((p) => p.lines);
	return {
		doc,
		pages,
		lines,
		byRef: new Map(lines.map((l) => [l.ref, l])),
		text: lines.map((l) => l.text).join("\n"),
	};
}

/** Maps a geometric (visual) line back to the parser-order line holding the same text. */
export function refForText(page: IndexedPage, text: string): LineRef | null {
	const target = fold(text).slice(0, 28);
	if (!target) return null;
	const folded = page.lines.map((l) => [l, fold(l.text)] as const);
	// Prefer the line that is, or starts with, this text: "Python" must map to
	// the skills line, not to a summary that mentions Python in passing.
	return (
		folded.find(([, f]) => f === fold(text))?.[0].ref ??
		folded.find(([, f]) => f.startsWith(target))?.[0].ref ??
		folded.find(([, f]) => f.includes(target))?.[0].ref ??
		null
	);
}

export interface DocInfo {
	file: string;
	format: string;
	pages: number;
	chars: number;
	words: number;
	text_layer: "ok" | "partial" | "none";
	empty_pages: number[];
}

export function docInfo(index: LineIndex): DocInfo {
	const empty = index.pages.filter((p) => nonSpace(p.lines.map((l) => l.text).join("")) < 20).map((p) => p.number);
	const chars = nonSpace(index.text);
	return {
		file: index.doc.fileName,
		format: index.doc.format,
		pages: index.pages.length,
		chars,
		words: index.text.split(/\s+/).filter(Boolean).length,
		text_layer: chars < 200 ? "none" : empty.length ? "partial" : "ok",
		empty_pages: empty,
	};
}

export interface OutlinePage {
	page: number;
	lines: number;
	headings: { ref: LineRef; text: string }[];
}

/** Lines that *look* like headings: short, and larger, bolder or upper-case than body text. */
export function outline(index: LineIndex): OutlinePage[] {
	const heights = index.lines.map((l) => l.h).filter((h) => h > 0).sort((a, b) => a - b);
	const body = heights[Math.floor(heights.length / 2)] || 10;
	return index.pages.map((p) => ({
		page: p.number,
		lines: p.lines.length,
		headings: p.lines
			.filter((l) => {
				const words = l.text.split(/\s+/).length;
				if (words > 6 || l.text.length < 3) return false;
				const upper = /\p{L}{3}/u.test(l.text) && l.text === l.text.toUpperCase();
				return (l.h > 0 && l.h >= body * 1.15) || l.bold || upper;
			})
			.map((l) => ({ ref: l.ref, text: l.text })),
	}));
}
