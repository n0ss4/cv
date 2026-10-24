// Layout facts and measured rules on real PDFs, through the reader the page ships.
import { describe, expect, it } from "vitest";
import { docInfo, indexDocument, outline } from "@domain/document/lineIndex";
import type { Document } from "@domain/document/types";
import { measureLayout } from "@domain/layout/facts";
import { measuredFindings } from "@domain/layout/rules";
import { EXAMPLE, FIXTURES, fixture, indexPdf } from "../support";

const types = async (path: string) => {
	const ix = await indexPdf(path);
	return measuredFindings(ix, measureLayout(ix), "en").map((f) => f.type);
};

describe("layout facts", () => {
	it("example CV: clean facts, text layer ok, headings in the outline", async () => {
		const ix = await indexPdf(EXAMPLE);
		expect(docInfo(ix).text_layer).toBe("ok");
		const f = measureLayout(ix);
		expect(f.side_by_side_blocks.value.lines).toBe(0);
		for (const k of ["header_zone", "bullet_only_lines", "date_only_lines", "right_edge_dates", "hyphen_breaks", "table_grid", "ambiguous_dates", "unlabelled_contact"] as const) {
			expect(f[k].value, k).toHaveLength(0);
		}
		const headings = outline(ix)[0]!.headings.map((h) => h.text);
		for (const h of ["SUMMARY", "PROFESSIONAL EXPERIENCE", "EDUCATION"]) expect(headings).toContain(h);
	});

	it.each([
		["two-column", (f: ReturnType<typeof measureLayout>) => f.side_by_side_blocks.value.lines >= 6],
		["orphan-bullets", (f: ReturnType<typeof measureLayout>) => f.bullet_only_lines.value.length >= 3],
		["detached-dates", (f: ReturnType<typeof measureLayout>) => f.date_only_lines.value.length >= 2],
		["right-dates", (f: ReturnType<typeof measureLayout>) => f.right_edge_dates.value.length >= 2],
		["hyphenated", (f: ReturnType<typeof measureLayout>) => f.hyphen_breaks.value.length >= 1],
		["header-contact", (f: ReturnType<typeof measureLayout>) => f.header_zone.value.some((z) => z.text.includes("@"))],
		["table-layout", (f: ReturnType<typeof measureLayout>) => f.table_grid.value.some((t) => t.rows >= 3 && t.cols >= 3)],
		["text-as-graphics", (f: ReturnType<typeof measureLayout>) => f.graphics_pages.value.some((p) => p.page === 2 && p.chars < 200)],
		["skill-rating", (f: ReturnType<typeof measureLayout>) => f.shape_rows.value.length >= 3],
		["ambiguous-dates", (f: ReturnType<typeof measureLayout>) => f.ambiguous_dates.value.length >= 2],
		["icon-contact", (f: ReturnType<typeof measureLayout>) => f.unlabelled_contact.value.some((c) => c.kind === "email")],
	])("reveals the defect in %s", async (name, check) => {
		const f = measureLayout(await indexPdf(fixture(name)));
		expect(check(f), JSON.stringify(f)).toBe(true);
	});

	it("a scanned PDF has no text layer", async () => {
		expect(docInfo(await indexPdf(fixture("scanned"))).text_layer).toBe("none");
	});

	it("facts a format cannot provide are not applicable, never 'clean'", () => {
		const doc: Document = {
			format: "txt", fileName: "cv.txt", fileSize: 10,
			capabilities: { positions: false, pages: false, graphics: false, structure: false },
			pages: [{ number: 1, lines: ["Taylor Example", "Experience", "Backend Engineer, Example Payments, 2020 - present"] }],
		};
		const f = measureLayout(indexDocument(doc));
		for (const k of ["side_by_side_blocks", "header_zone", "footer_zone", "right_edge_dates", "table_grid", "graphics_pages", "shape_rows"] as const) {
			expect(f[k].applicable, k).toBe(false);
		}
		for (const k of ["bullet_only_lines", "date_only_lines", "hyphen_breaks", "ambiguous_dates", "unusual_characters"] as const) {
			expect(f[k].applicable, k).toBe(true);
		}
	});
});

describe("measured rules", () => {
	it.each([
		["two-column", "multi_column_layout"],
		["orphan-bullets", "detached_bullets"],
		["detached-dates", "detached_dates"],
		["right-dates", "detached_dates"],
		["hyphenated", "hyphenated_words"],
		["header-contact", "contact_in_header_footer"],
		["table-layout", "table_layout"],
		["text-as-graphics", "text_as_graphics"],
		["skill-rating", "skill_rating_graphics"],
		["ambiguous-dates", "ambiguous_date_format"],
		["icon-contact", "icon_only_contact"],
		["scanned", "no_text_layer"],
	])("%s → %s", async (name, type) => {
		expect(await types(fixture(name))).toContain(type);
	});

	it.each(["EN", "ES", "CA"])("never fire on the example CV (%s)", async (lang) => {
		expect(await types(`${FIXTURES}example/CV_Jane_Doe_${lang}.pdf`)).toEqual([]);
	});

	it("fixtures without layout defects produce no measured finding", async () => {
		for (const name of ["no-email", "unusual-headings", "weak-bullets"]) expect(await types(fixture(name)), name).toEqual([]);
	});

	it("measured findings carry verified evidence and the catalogue's texts", async () => {
		const ix = await indexPdf(fixture("header-contact"));
		const [f] = measuredFindings(ix, measureLayout(ix), "es");
		expect(f!.provenance).toBe("measured");
		expect(f!.evidence[0]).toMatchObject({ ref: "p1:1", verified: true });
		expect(f!.title).toMatch(/encabezado/);
	});
});
