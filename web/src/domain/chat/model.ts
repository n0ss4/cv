// The conversation of the chat panel (data-model.md of specs 005 and 006). In
// memory only. Three voices: the user, the on-device AI, and the page itself
// (computed messages, never from the model).

import type { JobMatch } from "../job/model";

export interface Citation {
	ref: string;
	quote?: string;
	verified: boolean;
}

export interface Rewrite {
	sourceRef: string | null;
	sourceLine: string | null;
	/** null when the guard withheld it. */
	text: string | null;
	/** What the rewrite added that its source line lacks ("source" when the line doesn't exist). */
	added: string[];
	/** Of `added`, the terms the posting asks for and the CV doesn't mention. */
	postingMissing: string[];
}

/** A card the page renders from its own job computation; the model only picks the kind. */
export type CardKind = "fit" | "knockouts" | "keywords" | "gaps";
export const CARD_KINDS: readonly CardKind[] = ["fit", "knockouts", "keywords", "gaps"];

export interface Card {
	kind: CardKind;
	/** The comparison it was drawn from, so a later re-comparison doesn't change old answers. */
	job: JobMatch;
}

export type PageEvent =
	| {
		kind: "job";
		title: string | null;
		percent: number | null;
		/** The match % of the same posting against the previous version, if any. */
		before: number | null;
		required: { covered: number; total: number } | null;
		fails: number;
		notStated: number;
		missingKeywords: number;
		trimmed: boolean;
	}
	| { kind: "jobFailed" }
	| { kind: "jobRemoved" }
	| { kind: "version"; scoreBefore: number | null; scoreAfter: number | null; resolved: number; added: number };

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "page";
	text: string;
	status: "pending" | "done" | "error" | "cancelled";
	citations: Citation[];
	rewrites: Rewrite[];
	outOfScope: boolean;
	/** An answer that cited lines, none of which could be verified. */
	unverified: boolean;
	cards: Card[];
	/** The answer says a posting is needed: the panel offers "Add a posting". */
	needsPosting: boolean;
	/** The report version the message was written against; older citations no longer link. */
	reportId: string | null;
	event?: PageEvent;
}

export function chatMessage(m: Pick<ChatMessage, "id" | "role"> & Partial<ChatMessage>): ChatMessage {
	return { text: "", status: "done", citations: [], rewrites: [], outOfScope: false, unverified: false, cards: [], needsPosting: false, reportId: null, ...m };
}

/** Exchanges the model remembers; the UI keeps the whole conversation. */
export const CHAT_MEMORY = 4;
export const MEMORY_ANSWER_CHARS = 200;

export function memoryOf(messages: ChatMessage[]): { question: string; answer: string }[] {
	const said = messages.filter((m) => m.role !== "page");
	const pairs: { question: string; answer: string }[] = [];
	for (let i = 0; i < said.length - 1; i++) {
		const q = said[i]!;
		const a = said[i + 1]!;
		if (q.role === "user" && a.role === "assistant" && a.status === "done") {
			pairs.push({ question: q.text, answer: a.outOfScope ? "(out of scope)" : a.text.slice(0, MEMORY_ANSWER_CHARS) });
		}
	}
	return pairs.slice(-CHAT_MEMORY);
}
