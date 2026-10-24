// The analysis state machine (contracts/ui.md). Pure: every transition is a
// reducer case, and the provider only turns use-case events into actions.

import type { EngineAvailability } from "@app/ports/AiEngine";
import type { ReadErrorCode } from "@app/ports/DocumentReader";
import { AI_STEPS, type AiStep, type ProgressEvent } from "@app/usecases/analyseCv";
import type { Measured } from "@app/usecases/measureLayout";
import { compareRescan } from "@app/usecases/compareRescan";
import { jobEvent } from "@domain/chat/context";
import { chatMessage, type ChatMessage, type PageEvent } from "@domain/chat/model";
import type { Report, ToolCall } from "@domain/report/report";

export type StepId = "read" | "layout" | "download" | AiStep;
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type SkipReason = "no-ai" | "declined";

export interface Step {
	id: StepId;
	status: StepStatus;
	detail?: { key: string; params?: Record<string, string | number> };
	skipReason?: SkipReason;
}

export type Phase = "idle" | "reading" | "consent" | "downloading" | "analysing" | "done" | "failed" | "cancelled";

export interface AnalysisState {
	phase: Phase;
	file: { name: string; size: number } | null;
	steps: Step[];
	engine: { availability: EngineAvailability; progress: number | null };
	measured: Measured | null;
	report: Report | null;
	/** The previous report of this session, for the rescan comparison. */
	previous: Report | null;
	/** This version's report before any posting: what "Remove" in the chat restores. */
	unmatched: Report | null;
	log: ToolCall[];
	error: ReadErrorCode | "model" | "unknown" | null;
	job: { status: "idle" | "running" | "failed" };
	/**
	 * The chat panel (specs 005, 006). It outlives a new version of the CV (the
	 * edit loop) and only "Clear everything" removes it.
	 */
	chat: {
		messages: ChatMessage[];
		running: boolean;
		status: { key: string; params?: Record<string, string> } | null;
		/** The posting in context, shared with the Job match tab; percent is its last match. */
		posting: Posting | null;
	};
	notice: "cleared" | "cancelled" | null;
}

export interface Posting {
	text: string;
	title: string;
	percent: number | null;
}

export type Action =
	| { type: "engine"; availability: EngineAvailability }
	| { type: "start"; file: { name: string; size: number } }
	| { type: "readProgress"; page: number; pages: number }
	| { type: "measured"; measured: Measured; aiPlanned: boolean; skip?: SkipReason }
	| { type: "needConsent" }
	| { type: "consent"; accepted: boolean }
	| { type: "downloadProgress"; share: number }
	| { type: "downloaded" }
	| { type: "progress"; event: ProgressEvent; log: ToolCall[] }
	| { type: "done"; report: Report; modelError?: boolean }
	| { type: "failed"; error: AnalysisState["error"] }
	| { type: "cancelled" }
	| { type: "clear" }
	| { type: "jobStart" }
	| { type: "jobDone"; report: Report; posting: { text: string; title: string } }
	| { type: "jobFailed" }
	| { type: "chatReset" }
	| { type: "postingRemove" }
	| { type: "chatAsk"; question: string; id: string }
	| { type: "chatStep"; tool: string; args?: Record<string, unknown> }
	| { type: "chatAnswer"; message: ChatMessage; log: ToolCall[] }
	| { type: "chatError"; log: ToolCall[] }
	| { type: "chatCancel" };

export const initialState = (availability: EngineAvailability = "no-api"): AnalysisState => ({
	phase: "idle",
	file: null,
	steps: [],
	engine: { availability, progress: null },
	measured: null,
	report: null,
	previous: null,
	unmatched: null,
	log: [],
	error: null,
	job: { status: "idle" },
	chat: { messages: [], running: false, status: null, posting: null },
	notice: null,
});

let pageIds = 0;
const pageMessage = (event: PageEvent, reportId: string | null): ChatMessage => chatMessage({ id: `page-${++pageIds}`, role: "page", event, reportId });
const keepChat = (chat: AnalysisState["chat"]): AnalysisState["chat"] => ({ ...chat, running: false, status: null });

const freshSteps = (): Step[] => [
	{ id: "read", status: "running" },
	{ id: "layout", status: "pending" },
	...AI_STEPS.map((id): Step => ({ id, status: "pending" })),
];

const setStep = (steps: Step[], id: StepId, patch: Partial<Step>) => steps.map((s) => (s.id === id ? { ...s, ...patch } : s));

const TOOL_KEYS: Record<string, string> = {
	doc_info: "doc_info", outline: "outline", read_lines: "read_lines", search: "search", layout_facts: "layout_facts",
};

export function reducer(state: AnalysisState, action: Action): AnalysisState {
	switch (action.type) {
		case "engine":
			return { ...state, engine: { ...state.engine, availability: action.availability } };

		case "start":
			return {
				...initialState(state.engine.availability),
				engine: state.engine,
				// A finished report becomes the comparison baseline for this one.
				previous: state.report ?? state.previous,
				chat: keepChat(state.chat),
				phase: "reading",
				file: action.file,
				steps: freshSteps(),
			};

		case "readProgress":
			return { ...state, steps: setStep(state.steps, "read", { detail: { key: "readPage", params: { page: action.page, pages: action.pages } } }) };

		case "measured": {
			const { info, findings } = action.measured;
			let steps = setStep(state.steps, "read", { status: "done", detail: { key: "readPages", params: { pages: info.pages, chars: info.chars.toLocaleString() } } });
			steps = setStep(steps, "layout", { status: "done", detail: findings.length ? { key: "layoutIssues", params: { n: findings.length } } : { key: "layoutClean" } });
			if (!action.aiPlanned || info.text_layer === "none") {
				steps = steps.map((s) => (AI_STEPS.includes(s.id as AiStep) ? { ...s, status: "skipped", skipReason: action.skip ?? "no-ai" } : s));
			}
			return { ...state, measured: action.measured, steps, phase: "analysing" };
		}

		case "needConsent":
			return { ...state, phase: "consent" };

		case "consent":
			if (!action.accepted) {
				return {
					...state,
					phase: "analysing",
					steps: state.steps.map((s) => (AI_STEPS.includes(s.id as AiStep) ? { ...s, status: "skipped", skipReason: "declined" } : s)),
				};
			}
			return {
				...state,
				phase: "downloading",
				engine: { availability: "downloading", progress: 0 },
				steps: [...state.steps.slice(0, 2), { id: "download", status: "running", detail: { key: "downloading", params: { n: 0 } } }, ...state.steps.slice(2)],
			};

		case "downloadProgress": {
			const n = Math.round(action.share * 100);
			return { ...state, engine: { ...state.engine, progress: action.share }, steps: setStep(state.steps, "download", { detail: { key: "downloading", params: { n } } }) };
		}

		case "downloaded":
			return { ...state, phase: "analysing", engine: { availability: "available", progress: null }, steps: setStep(state.steps, "download", { status: "done", detail: undefined }) };

		case "progress": {
			const e = action.event;
			if (e.step === "engine") return { ...state, log: [...action.log] };
			const patch: Partial<Step> = { status: e.status };
			if (e.detail?.tool) {
				// The live detail line under a running step: "AI is reading page 1, lines 21–40".
				const params = Object.fromEntries(Object.entries(e.detail.args ?? {}).map(([k, v]) => [k, String(v)]));
				patch.detail = { key: `tool.${TOOL_KEYS[e.detail.tool] ?? "doc_info"}`, params };
			} else if (e.status !== "running") {
				patch.detail = undefined;
			}
			return { ...state, log: [...action.log], steps: setStep(state.steps, e.step, patch) };
		}

		case "done": {
			// A new version during a conversation: say what changed (the edit loop).
			let chat = state.chat;
			if (chat.messages.length && state.previous) {
				const diff = compareRescan(state.previous, action.report);
				const event: PageEvent = { kind: "version", scoreBefore: state.previous.overall, scoreAfter: action.report.overall, resolved: diff.resolved.length, added: diff.added.length };
				chat = { ...chat, messages: [...chat.messages, pageMessage(event, action.report.id)] };
			}
			return { ...state, phase: "done", report: action.report, unmatched: action.report, log: [...action.report.log], error: action.modelError ? "model" : null, chat };
		}

		case "failed":
			return { ...state, phase: "failed", error: action.error, steps: state.steps.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)) };

		case "cancelled":
			return { ...initialState(state.engine.availability), engine: state.engine, previous: state.previous, chat: keepChat(state.chat), notice: "cancelled" };

		case "clear":
			return { ...initialState(state.engine.availability), engine: state.engine, notice: "cleared" };

		case "jobStart":
			return { ...state, job: { status: "running" } };

		case "jobDone": {
			const job = action.report.job;
			if (!job) return { ...state, report: action.report, log: [...action.report.log], job: { status: "idle" } };
			const old = state.chat.posting;
			const before = old && old.text === action.posting.text ? old.percent : null;
			const posting: Posting = { ...action.posting, percent: job.summary?.percent ?? null };
			// Without the AI the posting has no extracted title; the one the user typed stands in.
			const event = { ...jobEvent(job, before), title: job.title || action.posting.title || null };
			const messages = [...state.chat.messages, pageMessage(event, action.report.id)];
			return { ...state, report: action.report, log: [...action.report.log], job: { status: "idle" }, chat: { ...state.chat, messages, posting } };
		}

		case "jobFailed":
			return { ...state, job: { status: "failed" }, chat: { ...state.chat, messages: [...state.chat.messages, pageMessage({ kind: "jobFailed" }, state.report?.id ?? null)] } };

		case "postingRemove": {
			// The posting goes everywhere: chat context, Job match tab, score.
			if (!state.chat.posting) return state;
			const report = state.unmatched ?? state.report;
			return {
				...state,
				report,
				log: report ? [...report.log] : state.log,
				chat: { ...state.chat, posting: null, messages: [...state.chat.messages, pageMessage({ kind: "jobRemoved" }, state.report?.id ?? null)] },
			};
		}

		case "chatReset":
			return { ...state, chat: { ...state.chat, messages: [], running: false, status: null } };

		case "chatAsk": {
			const reportId = state.report?.id ?? null;
			const question = chatMessage({ id: `${action.id}-q`, role: "user", text: action.question, reportId });
			const pending = chatMessage({ id: action.id, role: "assistant", status: "pending", reportId });
			return { ...state, chat: { ...state.chat, messages: [...state.chat.messages, question, pending], running: true, status: null } };
		}

		case "chatStep":
			return {
				...state,
				chat: { ...state.chat, status: { key: `tool.${TOOL_KEYS[action.tool] ?? "doc_info"}`, params: Object.fromEntries(Object.entries(action.args ?? {}).map(([k, v]) => [k, String(v)])) } },
			};

		case "chatAnswer":
			return {
				...state,
				log: [...action.log],
				chat: { ...state.chat, messages: state.chat.messages.map((m) => (m.id === action.message.id ? action.message : m)), running: false, status: null },
			};

		case "chatError":
		case "chatCancel": {
			const status = action.type === "chatError" ? "error" : "cancelled";
			const messages = state.chat.messages.map((m) => (m.role === "assistant" && m.status === "pending" ? { ...m, status } as ChatMessage : m));
			return { ...state, log: action.type === "chatError" ? [...action.log] : state.log, chat: { ...state.chat, messages, running: false, status: null } };
		}
	}
}
