// A test-only second file format: plain text. It proves (SC-007) that a new
// format needs only its reader and a registry line -- no change to analysis,
// prompts, scoring or UI.
import type { DocumentReader } from "@app/ports/DocumentReader";
import { ReadError } from "@app/ports/DocumentReader";
import type { Document } from "@domain/document/types";

export class TextReader implements DocumentReader {
	readonly format = "txt";
	readonly label = "Plain text";
	readonly accept = { mime: ["text/plain"], extensions: [".txt"] };
	readonly maxBytes = 1024 * 1024;
	readonly capabilities = { positions: false, pages: false, graphics: false, structure: false };

	sniff(head: Uint8Array) {
		return !head.includes(0);
	}

	async read({ bytes, fileName }: { bytes: Uint8Array; fileName: string }): Promise<Document> {
		const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
		if (!text.trim()) throw new ReadError("empty");
		return { format: this.format, fileName, fileSize: bytes.byteLength, capabilities: this.capabilities, pages: [{ number: 1, lines: text.split(/\r?\n/) }] };
	}
}

export const SAMPLE_TXT = `Taylor Example
taylor.example@example.com | +1 555 0177
Summary
Backend engineer with seven years of experience building payment and logistics platforms in Go, Python and PostgreSQL, owning services end to end.
Experience
Senior Backend Engineer, Example Payments, Jan '20 - present
Built the settlement service that reconciles card payments for twelve markets, cutting manual reconciliation work by eighty percent.
Education
BSc Computer Science, Example University, 2012 - 2016
Skills
Go, Python, PostgreSQL, Kafka, Kubernetes, Terraform`;
