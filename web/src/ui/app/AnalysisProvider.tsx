// Turns use-case calls and their events into state-machine actions. One
// AbortController per run: Cancel, Clear and a second drop all abort it.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { FormatRegistry } from "@app/formats/registry";
import type { AiEngine } from "@app/ports/AiEngine";
import { ReadError } from "@app/ports/DocumentReader";
import { analyseCv, setupLog } from "@app/usecases/analyseCv";
import { askCv } from "@app/usecases/askCv";
import { compareJob as compareJobUseCase } from "@app/usecases/compareJob";
import { checkEngine, prepareEngine, type EngineChoice } from "@app/usecases/engine";
import { measureLayout, type Measured } from "@app/usecases/measureLayout";
import { readDocument, type FileLike } from "@app/usecases/readDocument";
import type { Report } from "@domain/report/report";
import { useI18n } from "../i18n";
import { initialState, reducer, type AnalysisState } from "./analysis";

export interface Services {
	formats: FormatRegistry;
	engines: readonly AiEngine[];
}

interface Analysis {
	state: AnalysisState;
	services: Services;
	engine: AiEngine | null;
	onFile(file: FileLike): void;
	consent(accepted: boolean): void;
	cancel(): void;
	clear(): void;
	compareJob(text: string, title: string): void;
	/** The chat panel (specs 005, 006). */
	ask(question: string): void;
	stopAsk(): void;
	/** "New conversation": the messages go, the posting stays. */
	newConversation(): void;
	/** Take the posting out of the chat's context. */
	removePosting(): void;
}

const Ctx = createContext<Analysis | null>(null);

export function AnalysisProvider({ services, children }: { services: Services; children: ReactNode }) {
	const { lang } = useI18n();
	const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
	const engineRef = useRef<AiEngine | null>(null);
	const controller = useRef<AbortController | null>(null);
	const pending = useRef<Measured | null>(null);
	const chatController = useRef<AbortController | null>(null);
	// The posting in context, read when a new version finishes (the edit loop).
	const postingRef = useRef<{ text: string; title: string } | null>(null);
	postingRef.current = state.chat.posting;
	// A file dropped before the engine check finishes must wait for it, or it
	// would be analysed as if this browser had no AI.
	const engineCheck = useRef<Promise<EngineChoice> | null>(null);

	useEffect(() => {
		let live = true;
		const check = checkEngine(services.engines, lang);
		engineCheck.current = check;
		void check.then((choice) => {
			if (!live) return;
			engineRef.current = choice.engine;
			dispatch({ type: "engine", availability: choice.availability });
		});
		return () => {
			live = false;
		};
	}, [services.engines, lang]);

	// One path for a posting, from the chat or the Job match tab. Without an
	// engine the use case still runs the measured keyword check.
	const runCompare = useCallback(
		(report: Report, measured: Measured, posting: { text: string; title: string }) => {
			const c = controller.current ?? new AbortController();
			dispatch({ type: "jobStart" });
			compareJobUseCase({ measured, report, engine: engineRef.current, jobText: posting.text, jobTitle: posting.title || undefined, lang, signal: c.signal })
				.then((next) => dispatch({ type: "jobDone", report: next, posting }))
				.catch(() => {
					if (!c.signal.aborted) dispatch({ type: "jobFailed" });
				});
		},
		[lang],
	);

	const run = useCallback(
		async (measured: Measured, engine: AiEngine | null, signal: AbortSignal) => {
			const log = setupLog(measured, Date.now);
			try {
				const report = await analyseCv({ measured, engine, lang, signal, log, onProgress: (event) => dispatch({ type: "progress", event, log }) });
				if (signal.aborted) return;
				dispatch({ type: "done", report });
				// A new version while a posting is in context: compare it again.
				if (postingRef.current) runCompare(report, measured, postingRef.current);
			} catch {
				if (signal.aborted) return;
				// The model failed outright (memory pressure, disabled AI): keep
				// what was measured and say so, rather than showing nothing.
				const report = await analyseCv({ measured, engine: null, lang, log });
				dispatch({ type: "done", report, modelError: true });
			}
		},
		[lang, runCompare],
	);

	const onFile = useCallback(
		(file: FileLike) => {
			controller.current?.abort();
			chatController.current?.abort();
			const c = new AbortController();
			controller.current = c;
			pending.current = null;
			dispatch({ type: "start", file: { name: file.name, size: file.size } });
			void (async () => {
				try {
					const { doc } = await readDocument(services.formats, file, {
						signal: c.signal,
						onProgress: (page, pages) => dispatch({ type: "readProgress", page, pages }),
					});
					if (c.signal.aborted) return;
					const measured = measureLayout(doc, lang);
					const choice = await (engineCheck.current ?? checkEngine(services.engines, lang));
					if (c.signal.aborted) return;
					const { engine, availability } = choice;
					engineRef.current = engine;
					const aiPlanned = engine !== null && measured.info.text_layer !== "none";
					dispatch({ type: "measured", measured, aiPlanned });
					if (aiPlanned && availability === "downloadable") {
						pending.current = measured;
						dispatch({ type: "needConsent" });
						return;
					}
					await run(measured, aiPlanned ? engine : null, c.signal);
				} catch (err) {
					if (c.signal.aborted) return;
					dispatch({ type: "failed", error: err instanceof ReadError ? err.code : "unknown" });
				}
			})();
		},
		[services.formats, services.engines, lang, run],
	);

	const consent = useCallback(
		(accepted: boolean) => {
			const measured = pending.current;
			const c = controller.current;
			const engine = engineRef.current;
			if (!measured || !c) return;
			pending.current = null;
			dispatch({ type: "consent", accepted });
			if (!accepted || !engine) {
				void run(measured, null, c.signal);
				return;
			}
			// Called from the click handler: the user gesture lets Chrome start the download.
			void prepareEngine(engine, lang, { signal: c.signal, onProgress: (share) => dispatch({ type: "downloadProgress", share }) })
				.then(() => {
					dispatch({ type: "downloaded" });
					return run(measured, engine, c.signal);
				})
				.catch(async () => {
					if (c.signal.aborted) return;
					const report = await analyseCv({ measured, engine: null, lang });
					dispatch({ type: "done", report, modelError: true });
				});
		},
		[lang, run],
	);

	const cancel = useCallback(() => {
		controller.current?.abort();
		chatController.current?.abort();
		pending.current = null;
		dispatch({ type: "cancelled" });
	}, []);

	const clear = useCallback(() => {
		controller.current?.abort();
		chatController.current?.abort();
		pending.current = null;
		dispatch({ type: "clear" });
	}, []);

	const compareJob = useCallback(
		(text: string, title: string) => {
			if (state.report && state.measured) runCompare(state.report, state.measured, { text, title });
		},
		[state.report, state.measured, runCompare],
	);

	const ask = useCallback(
		(question: string) => {
			const engine = engineRef.current;
			const { report, measured } = state;
			if (!engine || !report || !measured || state.chat.running || !question.trim()) return;
			const c = new AbortController();
			chatController.current = c;
			const id = `a-${Date.now().toString(36)}`;
			dispatch({ type: "chatAsk", question: question.trim(), id });
			askCv({
				measured, report, engine, question: question.trim(), history: state.chat.messages, lang, signal: c.signal, id,
				onStep: (e) => dispatch({ type: "chatStep", tool: e.tool ?? "doc_info", args: e.args as Record<string, unknown> | undefined }),
			})
				.then((message) => dispatch({ type: "chatAnswer", message, log: report.log }))
				.catch(() => {
					if (c.signal.aborted) dispatch({ type: "chatCancel" });
					else dispatch({ type: "chatError", log: report.log });
				});
		},
		[state, lang],
	);

	const stopAsk = useCallback(() => chatController.current?.abort(), []);

	const newConversation = useCallback(() => {
		chatController.current?.abort();
		dispatch({ type: "chatReset" });
	}, []);

	const removePosting = useCallback(() => dispatch({ type: "postingRemove" }), []);

	const value = useMemo(
		() => ({ state, services, engine: engineRef.current, onFile, consent, cancel, clear, compareJob, ask, stopAsk, newConversation, removePosting }),
		[state, services, onFile, consent, cancel, clear, compareJob, ask, stopAsk, newConversation, removePosting],
	);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysis(): Analysis {
	const v = useContext(Ctx);
	if (!v) throw new Error("useAnalysis outside AnalysisProvider");
	return v;
}
