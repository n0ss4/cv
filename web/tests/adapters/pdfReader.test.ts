import { describe, expect, it } from "vitest";
import { ReadError } from "@app/ports/DocumentReader";
import { assertDocument } from "@domain/document/types";
import { EXAMPLE, fixture, fixturesBuilt, nodePdfReader, readPdf } from "../support";

describe("PdfReader", () => {
	it("needs the fixtures (run `make web-test`)", () => {
		expect(fixturesBuilt()).toBe(true);
	});

	it("reads the example CV into a positional document with graphics", async () => {
		const doc = await readPdf(EXAMPLE);
		assertDocument(doc);
		expect(doc.format).toBe("pdf");
		expect(doc.pages.length).toBeGreaterThanOrEqual(1);
		expect(doc.pages[0]!.items!.some((i) => i.str.includes("Jane Doe"))).toBe(true);
		// The example has a placeholder photo.
		expect(doc.pages[0]!.graphics!.images).toBeGreaterThanOrEqual(1);
	});

	it("sniffs by content, not by name", () => {
		const reader = nodePdfReader();
		expect(reader.sniff(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
		expect(reader.sniff(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
	});

	it("maps damaged and non-PDF input to ReadError codes", async () => {
		const reader = nodePdfReader();
		await expect(reader.read({ bytes: new TextEncoder().encode("hello"), fileName: "x.pdf" })).rejects.toMatchObject({ code: "unsupported" });
		const broken = new TextEncoder().encode("%PDF-1.7\nthis is not a pdf body");
		await expect(reader.read({ bytes: broken, fileName: "x.pdf" })).rejects.toBeInstanceOf(ReadError);
	});

	it("reads a scanned PDF as pages without text", async () => {
		const doc = await readPdf(fixture("scanned"));
		expect(doc.pages.every((p) => p.items!.every((i) => !i.str.trim()))).toBe(true);
	});
});
