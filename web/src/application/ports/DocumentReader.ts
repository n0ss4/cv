// Port: one implementation per file format (contracts/ports.md#documentreader).
// Adding Word later means one new class implementing this and one registry line.

import type { Document, FormatId, ReaderCapabilities } from "@domain/document/types";

export interface DocumentReader {
	readonly format: FormatId;
	/** Shown to users: "We read: PDF". */
	readonly label: string;
	readonly accept: { mime: string[]; extensions: string[] };
	readonly maxBytes: number;
	readonly capabilities: ReaderCapabilities;

	/** Cheap check on the first bytes, before the full read (e.g. "%PDF-"). */
	sniff(head: Uint8Array): boolean;

	/** Bytes → Document. Must never touch the network. */
	read(
		input: { bytes: Uint8Array; fileName: string },
		opts?: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void },
	): Promise<Document>;
}

export type ReadErrorCode = "unsupported" | "too-large" | "encrypted" | "corrupt" | "empty";

export class ReadError extends Error {
	constructor(readonly code: ReadErrorCode, options?: { cause?: unknown }) {
		super(code, options);
		this.name = "ReadError";
	}
}
