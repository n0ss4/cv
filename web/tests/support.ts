// Runs the real PdfReader under Node on the fixture PDFs built by
// `make web-fixtures` (build/web-fixtures/). pdf.js references DOMMatrix at
// import time for rendering, which these tests never do, so a stub is enough.

import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { PdfReader, type PdfJs } from "@adapters/readers/pdf/PdfReader";
import { indexDocument } from "@domain/document/lineIndex";
import type { Document } from "@domain/document/types";

(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= class {
	a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
};

// Vitest runs from web/; under jsdom import.meta.url is not a file: URL.
export const FIXTURES = `${resolve(process.cwd(), "../build/web-fixtures")}/`;
export const fixture = (name: string) => `${FIXTURES}${name}.pdf`;
export const EXAMPLE = `${FIXTURES}example/CV_Jane_Doe_EN.pdf`;
export const fixturesBuilt = () => existsSync(EXAMPLE);

export const nodePdfReader = () => new PdfReader(async () => (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJs);

export async function readPdf(path: string): Promise<Document> {
	const bytes = new Uint8Array(readFileSync(path));
	return nodePdfReader().read({ bytes, fileName: basename(path) });
}

export async function indexPdf(path: string) {
	return indexDocument(await readPdf(path));
}

/** A File-like object for use cases and UI tests. */
export function fileFrom(path: string, type = "application/pdf") {
	const bytes = readFileSync(path);
	return new File([bytes], basename(path), { type });
}
