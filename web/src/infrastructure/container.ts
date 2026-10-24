// Composition root: the only module that picks concrete adapters. Adding a
// file format or an engine is one line here (contracts/ports.md).

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChromeBuiltInEngine } from "@adapters/ai/chrome/ChromeBuiltInEngine";
import { PdfReader, type PdfJs } from "@adapters/readers/pdf/PdfReader";
import { FormatRegistry } from "@app/formats/registry";
import type { AiEngine } from "@app/ports/AiEngine";

export interface Container {
	formats: FormatRegistry;
	engines: readonly AiEngine[];
}

// pdf.js loads on the first file, not with the page.
const loadPdfJs = async (): Promise<PdfJs> => {
	const pdfjs = await import("pdfjs-dist");
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	return pdfjs as unknown as PdfJs;
};

export function createContainer(): Container {
	const formats = new FormatRegistry().register(new PdfReader(loadPdfJs));
	const engines: AiEngine[] = [new ChromeBuiltInEngine()];
	// Principle II: inference on user data happens on the device or not at all.
	for (const e of engines) if (e.facts.runsOn !== "device") throw new Error(`engine ${e.id} does not run on the device`);
	return { formats, engines };
}
