// File → Document, through whichever registered reader claims it.

import type { Document } from "@domain/document/types";
import type { FormatRegistry } from "../formats/registry";
import { ReadError, type DocumentReader } from "../ports/DocumentReader";

export interface FileLike {
	name: string;
	type: string;
	size: number;
	arrayBuffer(): Promise<ArrayBuffer>;
}

export async function readDocument(
	registry: FormatRegistry,
	file: FileLike,
	opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ reader: DocumentReader; doc: Document }> {
	if (file.size === 0) throw new ReadError("empty");
	if (file.size > registry.maxBytes()) throw new ReadError("too-large");
	const bytes = new Uint8Array(await file.arrayBuffer());
	const reader = registry.match({ name: file.name, type: file.type, head: bytes.subarray(0, 1024) });
	if (!reader) throw new ReadError("unsupported");
	if (file.size > reader.maxBytes) throw new ReadError("too-large");
	const doc = await reader.read({ bytes, fileName: file.name }, opts);
	return { reader, doc };
}
