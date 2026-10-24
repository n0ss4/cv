// The document tools the model can call (contracts/tools.md).
//
// The model never sees the file; it sees it only through these functions. They
// return data and never judgements. Deciding what matters is the model's job,
// guided by the prompts -- or, for layout, the measured rules.

import { docInfo, outline, type LineIndex } from "@domain/document/lineIndex";
import { fold } from "@domain/document/text";
import { measureLayout, type LayoutFacts } from "@domain/layout/facts";

export const TOOL_NAMES = ["doc_info", "outline", "read_lines", "search", "layout_facts"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const MAX_READ = 40;
export const MAX_HITS = 20;

export interface ToolArgs {
	page?: number;
	from?: number;
	to?: number;
	query?: string;
}

export function readLines(index: LineIndex, { page, from = 1, to }: ToolArgs = {}) {
	const p = index.pages.find((x) => x.number === Number(page));
	if (!p) return { error: `page must be between 1 and ${index.pages.length}` };
	const start = Math.max(1, Number(from) || 1);
	if (start > p.lines.length) return { error: `page ${p.number} has ${p.lines.length} lines` };
	const end = Math.min(p.lines.length, Number(to) || start + MAX_READ - 1, start + MAX_READ - 1);
	return p.lines.slice(start - 1, end).map((l) => ({ ref: l.ref, text: l.text }));
}

export function search(index: LineIndex, { query = "" }: ToolArgs = {}) {
	const q = fold(String(query));
	if (q.length < 2) return { error: "query must have at least 2 characters" };
	return index.lines.filter((l) => fold(l.text).includes(q)).slice(0, MAX_HITS).map((l) => ({ ref: l.ref, text: l.text }));
}

/**
 * Layout facts as the model receives them: a fact the format cannot provide
 * is spelled out as not applicable, so an empty list never reads as "no issue".
 */
export function layoutFactsForModel(facts: LayoutFacts, format: string): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(facts).map(([name, f]) => [name, f.applicable ? f.value : `not applicable for ${format}`]),
	);
}

/** Runs a model's tool request. Unknown tools and bad arguments come back as { error } so it can correct itself. */
export function runTool(index: LineIndex, name: string, args: ToolArgs = {}): unknown {
	switch (name) {
		case "doc_info": return { ...docInfo(index), capabilities: index.doc.capabilities };
		case "outline": return outline(index);
		case "read_lines": return readLines(index, args);
		case "search": return search(index, args);
		case "layout_facts": {
			const page = args.page ? Number(args.page) : undefined;
			if (page !== undefined && !index.pages.some((p) => p.number === page)) return { error: `page must be between 1 and ${index.pages.length}` };
			return layoutFactsForModel(measureLayout(index, page ? { page } : {}), index.doc.format);
		}
		default: return { error: `unknown tool "${name}"; use one of ${TOOL_NAMES.join(", ")}` };
	}
}
