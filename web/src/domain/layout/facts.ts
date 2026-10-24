// Layout facts: what the file does that plain text hides (contracts/tools.md).
//
// Facts are observations, never judgements: "14 lines hold two side-by-side
// text blocks", not "this CV uses columns, which is bad". Turning a fact into
// a finding is rules.ts's job, and the model sees the same facts through the
// layout_facts tool. Every fact says whether it could be measured for this
// document's format; a fact that is not applicable must never read as "fine".

import { refForText, type LineIndex, type LineRef, type IndexedPage } from "../document/lineIndex";
import { nonSpace } from "../document/text";
import { ambiguousDate, DATE_ONLY } from "./dates";

export interface Fact<T> {
	applicable: boolean;
	value: T;
}

export interface ZoneLine {
	ref: LineRef | null;
	text: string;
}

export interface LayoutFacts {
	side_by_side_blocks: Fact<{ lines: number; of_total_lines: number; example_refs: (LineRef | null)[] }>;
	header_zone: Fact<ZoneLine[]>;
	footer_zone: Fact<ZoneLine[]>;
	bullet_only_lines: Fact<LineRef[]>;
	date_only_lines: Fact<LineRef[]>;
	right_edge_dates: Fact<LineRef[]>;
	hyphen_breaks: Fact<LineRef[]>;
	unusual_characters: Fact<{ count: number; ratio: number; examples: string[] }>;
	table_grid: Fact<{ rows: number; cols: number; first_ref: LineRef | null }[]>;
	graphics_pages: Fact<{ page: number; images: number; paths: number; chars: number }[]>;
	shape_rows: Fact<{ ref: LineRef | null; shapes: number }[]>;
	ambiguous_dates: Fact<{ ref: LineRef; text: string }[]>;
	unlabelled_contact: Fact<{ ref: LineRef; kind: "email" | "phone"; marker: string }[]>;
}

export type FactName = keyof LayoutFacts;

const BULLET_ONLY = /^[\s•▪●◦‣■–*·-]+$/u;
const UNUSUAL = /[\uE000-\uF8FF\uFFFD\uFB00-\uFB06]|\(cid:\d+\)/gu;
export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/u;
export const PHONE = /\+?\d[\d\s().-]{6,}\d/u;
const CONTACT_LABEL = /\b(?:e-?mail|mail|correo|phone|tel|tel[eé]fono|m[oó]vil|mobile|cell)\b/iu;
// Icon fonts put their glyphs in the private-use area; some CVs use emoji or dingbats instead.
const ICON = /[\uE000-\uF8FF\p{So}]/u;
// An icon font without a Unicode map extracts as an arbitrary character ("ć",
// "×"): a lone non-ASCII token right before the value. Ordinary separators
// between contact items are not markers.
const SEPARATOR = /[A-Za-z0-9|•·\-–—,:;/()[\]]/u;

const ZONE = 0.06; // top/bottom share of the page treated as header/footer zone
const SIDE_BY_SIDE_MIN_X = 0.25; // a later segment must start past this share of the page width
const GRID_TOLERANCE = 2; // points
const GRID_MIN_ROWS = 3;
const GRID_MIN_COLS = 3;
const SHAPES_PER_ROW = 3;

const limit = <T>(list: T[], n: number) => list.slice(0, n);
const fact = <T>(applicable: boolean, value: T): Fact<T> => ({ applicable, value });

function sideBySide(pages: IndexedPage[], width: (p: IndexedPage) => number) {
	const refs: (LineRef | null)[] = [];
	for (const p of pages) {
		for (const g of p.geo) {
			const later = g.segments.slice(1);
			if (later.some((s) => s.x0 > SIDE_BY_SIDE_MIN_X * width(p) && s.text.split(/\s+/).length >= 3 && !DATE_ONLY.test(s.text))) {
				refs.push(refForText(p, g.segments[0]!.text));
			}
		}
	}
	return {
		lines: refs.length,
		of_total_lines: pages.reduce((n, p) => n + p.geo.length, 0),
		example_refs: limit([...new Set(refs)], 6),
	};
}

function tableGrid(pages: IndexedPage[]) {
	const grids: { rows: number; cols: number; first_ref: LineRef | null }[] = [];
	for (const p of pages) {
		let run: number[] | null = null;
		let rows = 0;
		let first: LineRef | null = null;
		const close = () => {
			if (run && rows >= GRID_MIN_ROWS) grids.push({ rows, cols: run.length, first_ref: first });
			run = null;
			rows = 0;
		};
		for (const g of p.geo) {
			const starts = g.segments.map((s) => s.x0);
			const aligned = run !== null && starts.length === (run as number[]).length && starts.every((x, i) => Math.abs(x - (run as number[])[i]!) <= GRID_TOLERANCE);
			if (starts.length >= GRID_MIN_COLS && aligned) {
				rows++;
			} else {
				close();
				if (starts.length >= GRID_MIN_COLS) {
					run = starts;
					rows = 1;
					first = refForText(p, g.segments[0]!.text);
				}
			}
		}
		close();
	}
	return grids;
}

function contactMarkers(lines: { ref: LineRef; text: string }[]) {
	const found: { ref: LineRef; kind: "email" | "phone"; marker: string }[] = [];
	for (const l of lines) {
		if (CONTACT_LABEL.test(l.text)) continue;
		for (const [kind, re] of [["email", EMAIL], ["phone", PHONE]] as const) {
			const m = re.exec(l.text);
			if (!m) continue;
			const before = l.text.slice(0, m.index);
			const token = before.trimEnd().split(/\s+/).pop() ?? "";
			const marker = [...before.slice(-3)].find((c) => ICON.test(c)) ?? ([...token].length === 1 && !SEPARATOR.test(token) ? token : undefined);
			if (marker) found.push({ ref: l.ref, kind, marker });
		}
	}
	return found;
}

export function measureLayout(index: LineIndex, opts: { page?: number } = {}): LayoutFacts {
	const { capabilities, structure } = index.doc;
	const pages = opts.page ? index.pages.filter((p) => p.number === opts.page) : index.pages;
	const positions = capabilities.positions;
	const zones = (positions && capabilities.pages) || capabilities.structure;
	const width = (p: IndexedPage) => p.width ?? 1;
	const height = (p: IndexedPage) => p.height ?? 1;

	const header: ZoneLine[] = [];
	const footer: ZoneLine[] = [];
	const rightDates: LineRef[] = [];
	if (positions) {
		for (const p of pages) {
			for (const g of p.geo) {
				const rel = g.y / height(p);
				if (rel > 1 - ZONE) header.push({ ref: refForText(p, g.text), text: g.text });
				if (rel < ZONE) footer.push({ ref: refForText(p, g.text), text: g.text });
				const last = g.segments[g.segments.length - 1]!;
				if (g.segments.length > 1 && DATE_ONLY.test(last.text)) {
					const ref = refForText(p, g.segments[0]!.text);
					if (ref) rightDates.push(ref);
				}
			}
		}
	} else if (structure) {
		const anyPage = index.pages[0]!;
		header.push(...structure.headerText.map((text) => ({ ref: refForText(anyPage, text), text })));
		footer.push(...structure.footerText.map((text) => ({ ref: refForText(anyPage, text), text })));
	}

	const lines = pages.flatMap((p) => p.lines);
	const hyphen: LineRef[] = [];
	for (const p of pages) {
		p.lines.forEach((l, i) => {
			const next = p.lines[i + 1];
			if (next && /\p{L}-$/u.test(l.text) && /^\p{Ll}/u.test(next.text)) hyphen.push(l.ref);
		});
	}

	const markers = contactMarkers(lines);
	// An icon in front of an email is reported as unlabelled_contact; counting
	// it again as a broken character would double-report one cause.
	const markerChars = new Set(markers.map((m) => m.marker));
	const text = lines.map((l) => l.text).join("\n");
	const unusual = (text.match(UNUSUAL) ?? []).filter((c) => !markerChars.has(c));

	const graphics = capabilities.graphics
		? pages.flatMap((p) => {
			const g = index.doc.pages.find((d) => d.number === p.number)?.graphics;
			if (!g || (!g.images && !g.paths)) return [];
			return [{ page: p.number, images: g.images, paths: g.paths, chars: nonSpace(p.lines.map((l) => l.text).join("")) }];
		})
		: [];

	const shapeRows = capabilities.graphics && positions
		? pages.flatMap((p) => {
			const g = index.doc.pages.find((d) => d.number === p.number)?.graphics;
			return (g?.pathRows ?? [])
				.filter((r) => r.count >= SHAPES_PER_ROW)
				.map((r) => {
					const line = p.geo.find((l) => Math.abs(l.y - r.y) <= Math.max(l.h, 4));
					return { ref: line ? refForText(p, line.text) : null, shapes: r.count };
				});
		})
		: [];

	return {
		side_by_side_blocks: fact(positions, positions ? sideBySide(pages, width) : { lines: 0, of_total_lines: 0, example_refs: [] }),
		header_zone: fact(zones, limit(header, 6)),
		footer_zone: fact(zones, limit(footer, 6)),
		bullet_only_lines: fact(true, limit(lines.filter((l) => BULLET_ONLY.test(l.text) && l.text.trim().length <= 3).map((l) => l.ref), 10)),
		date_only_lines: fact(true, limit(lines.filter((l) => DATE_ONLY.test(l.text)).map((l) => l.ref), 10)),
		right_edge_dates: fact(positions, limit(rightDates, 10)),
		hyphen_breaks: fact(true, limit(hyphen, 10)),
		unusual_characters: fact(true, {
			count: unusual.length,
			ratio: Number((unusual.length / Math.max(1, nonSpace(text))).toFixed(4)),
			examples: limit([...new Set(unusual)], 5),
		}),
		table_grid: fact(
			positions || capabilities.structure,
			positions
				? tableGrid(pages)
				: (structure?.tables ?? []).map((t) => ({ rows: t.rows, cols: t.cols, first_ref: t.firstLineText ? refForText(index.pages[0]!, t.firstLineText) : null })),
		),
		graphics_pages: fact(capabilities.graphics, graphics),
		shape_rows: fact(capabilities.graphics && positions, limit(shapeRows, 10)),
		ambiguous_dates: fact(true, limit(lines.filter((l) => ambiguousDate(l.text)).map((l) => ({ ref: l.ref, text: l.text })), 10)),
		unlabelled_contact: fact(true, limit(markers, 4)),
	};
}
