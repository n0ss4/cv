// The registered file formats. Everything the UI says about accepted files
// ("We read: PDF · up to 10 MB", the <input accept>) comes from here, so a new
// reader shows up everywhere without touching a component.

import type { DocumentReader } from "../ports/DocumentReader";

const extension = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot < 0 ? "" : name.slice(dot).toLowerCase();
};

export class FormatRegistry {
	readonly #readers: DocumentReader[] = [];

	register(reader: DocumentReader): this {
		if (this.#readers.some((r) => r.format === reader.format)) throw new Error(`format ${reader.format} is already registered`);
		this.#readers.push(reader);
		return this;
	}

	readers(): readonly DocumentReader[] {
		return this.#readers;
	}

	/** By extension or MIME type first, then confirmed by the reader's own sniff. */
	match(file: { name: string; type: string; head: Uint8Array }): DocumentReader | null {
		const ext = extension(file.name);
		const candidates = this.#readers.filter((r) => r.accept.extensions.includes(ext) || (file.type && r.accept.mime.includes(file.type)));
		return candidates.find((r) => r.sniff(file.head)) ?? null;
	}

	acceptAttribute(): string {
		return this.#readers.flatMap((r) => [...r.accept.extensions, ...r.accept.mime]).join(",");
	}

	labels(): string[] {
		return this.#readers.map((r) => r.label);
	}

	maxBytes(): number {
		return Math.max(0, ...this.#readers.map((r) => r.maxBytes));
	}
}
