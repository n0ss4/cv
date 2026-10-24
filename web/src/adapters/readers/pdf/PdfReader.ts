// DocumentReader for PDF, with pdf.js.
//
// The pdf.js module is injected, so the browser (module worker, lazy import)
// and the Node tests (no worker) run exactly the same reading code. pdf.js is
// configured never to fetch anything -- no worker fetch, no CMaps, no standard
// fonts, no eval -- and the page's CSP forbids network access anyway.

import type { DocumentReader } from "@app/ports/DocumentReader";
import { ReadError } from "@app/ports/DocumentReader";
import type { Document, PageGraphics, PositionedItem } from "@domain/document/types";

// The subset of pdfjs-dist this reader uses, so tests can inject the Node build.
export interface PdfJs {
	getDocument(src: Record<string, unknown>): { promise: Promise<PdfDocumentProxy>; destroy(): Promise<void> };
	OPS: Record<string, number>;
}
interface PdfDocumentProxy {
	numPages: number;
	getPage(n: number): Promise<PdfPageProxy>;
}
interface PdfPageProxy {
	getViewport(o: { scale: number }): { width: number; height: number };
	getTextContent(o: Record<string, unknown>): Promise<{ items: unknown[]; styles?: Record<string, { fontFamily?: string }> }>;
	getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
	cleanup(): void;
}
interface TextItem {
	str: string;
	transform: number[];
	width: number;
	height: number;
	fontName?: string;
	hasEOL?: boolean;
}

export const PDF_MAX_BYTES = 10 * 1024 * 1024;
const BOLD = /bold|black|heavy|semibold|demi/i;
// A "small shape" for skill-rating detection: dots, stars, bar segments.
const SMALL_SHAPE = 24;
const ROW_BUCKET = 4;

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
	m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
	m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
	m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Image and vector-path counts, with small shapes grouped by baseline band in page space. */
export function graphicsFromOperators(ops: Record<string, number>, fnArray: number[], argsArray: unknown[]): PageGraphics {
	const images = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject]);
	let ctm: Matrix = [1, 0, 0, 1, 0, 0];
	const stack: Matrix[] = [];
	let imageCount = 0;
	let paths = 0;
	const rows = new Map<number, number>();
	fnArray.forEach((fn, i) => {
		const args = argsArray[i] as unknown[] | null;
		if (fn === ops.save) stack.push(ctm);
		else if (fn === ops.restore) ctm = stack.pop() ?? ctm;
		else if (fn === ops.transform && args && args.length === 6) ctm = multiply(ctm, args as Matrix);
		else if (images.has(fn)) imageCount++;
		else if (fn === ops.constructPath) {
			paths++;
			const minMax = args?.[2] as ArrayLike<number> | undefined;
			if (!minMax || minMax.length !== 4) return;
			const [x0, y0] = apply(ctm, minMax[0]!, minMax[1]!);
			const [x1, y1] = apply(ctm, minMax[2]!, minMax[3]!);
			const w = Math.abs(x1 - x0);
			const h = Math.abs(y1 - y0);
			if (w > 0 && h > 0 && w <= SMALL_SHAPE && h <= SMALL_SHAPE) {
				const band = Math.round((y0 + y1) / 2 / ROW_BUCKET) * ROW_BUCKET;
				rows.set(band, (rows.get(band) ?? 0) + 1);
			}
		}
	});
	return { images: imageCount, paths, pathRows: [...rows].map(([y, count]) => ({ y, count })) };
}

export class PdfReader implements DocumentReader {
	readonly format = "pdf";
	readonly label = "PDF";
	readonly accept = { mime: ["application/pdf"], extensions: [".pdf"] };
	readonly maxBytes = PDF_MAX_BYTES;
	readonly capabilities = { positions: true, pages: true, graphics: true, structure: false };

	constructor(private readonly load: () => Promise<PdfJs>) {}

	sniff(head: Uint8Array): boolean {
		return new TextDecoder("latin1").decode(head.subarray(0, 1024)).includes("%PDF-");
	}

	async read(input: { bytes: Uint8Array; fileName: string }, opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<Document> {
		if (input.bytes.byteLength > this.maxBytes) throw new ReadError("too-large");
		if (!this.sniff(input.bytes)) throw new ReadError("unsupported");
		const pdfjs = await this.load();

		// pdf.js 6 tears a document down through its loading task.
		const task = pdfjs.getDocument({
			// pdf.js transfers the buffer to its worker; keep the caller's copy intact.
			data: input.bytes.slice(),
			isEvalSupported: false,
			useWorkerFetch: false,
			disableFontFace: true,
			stopAtErrors: false,
			verbosity: 0,
		});
		let pdf: PdfDocumentProxy;
		try {
			pdf = await task.promise;
		} catch (err) {
			await task.destroy();
			if ((err as { name?: string })?.name === "PasswordException") throw new ReadError("encrypted", { cause: err });
			throw new ReadError("corrupt", { cause: err });
		}

		const pages: Document["pages"] = [];
		try {
			for (let n = 1; n <= pdf.numPages; n++) {
				if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException("aborted", "AbortError");
				opts.onProgress?.(n, pdf.numPages);
				const page = await pdf.getPage(n);
				const { width, height } = page.getViewport({ scale: 1 });
				// Unnormalised: pdf.js would otherwise turn a ligature glyph back into
				// "fi", hiding exactly what a less forgiving parser trips over.
				const content = await page.getTextContent({ disableNormalization: true });
				const items: PositionedItem[] = (content.items as TextItem[])
					.filter((it) => typeof it.str === "string")
					.map((it) => ({
						bold: BOLD.test(`${content.styles?.[it.fontName ?? ""]?.fontFamily ?? ""} ${it.fontName ?? ""}`),
						str: it.str,
						x: it.transform[4]!,
						y: it.transform[5]!,
						w: it.width,
						h: it.height || Math.hypot(it.transform[2]!, it.transform[3]!),
						eol: Boolean(it.hasEOL),
					}));
				const ops = await page.getOperatorList();
				pages.push({ number: n, width, height, items, graphics: graphicsFromOperators(pdfjs.OPS, ops.fnArray, ops.argsArray) });
				page.cleanup();
			}
		} catch (err) {
			if ((err as { name?: string })?.name === "AbortError") throw err;
			throw new ReadError("corrupt", { cause: err });
		} finally {
			await task.destroy();
		}

		return { format: this.format, fileName: input.fileName, fileSize: input.bytes.byteLength, capabilities: this.capabilities, pages };
	}
}
