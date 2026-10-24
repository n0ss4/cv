// One question of the chat (specs 005 and 006). The model answers through the
// same tool loop as the review; the page then verifies its citations, guards
// its rewrites (004's phrasing guard, against the source line plus the posting
// terms the CV already has), keeps only the cards its job match can fill and,
// for an out-of-scope question, keeps none of the model's words. Nothing here
// can change the report.

import { cardsFor, compactJob, postingMissing, postingTermsInCv } from "@domain/chat/context";
import { chatMessage, memoryOf, type ChatMessage, type Rewrite } from "@domain/chat/model";
import type { Lang } from "@domain/findings/types";
import { guardPhrasing } from "@domain/job/phrasing";
import { verifyEvidence } from "@domain/profile/verify";
import type { Report } from "@domain/report/report";
import { engineErrorText, runTask, TaskError, type StepEvent } from "../agent/orchestrator";
import { compactProfile } from "../agent/profile";
import type { AiEngine } from "../ports/AiEngine";
import { SYSTEM_PROMPT } from "../prompts/system";
import type { TaskContext } from "../prompts/tasks";
import { layoutFactsForModel } from "../tools/tools";
import { engineLangs } from "./engine";
import type { Measured } from "./measureLayout";

export interface AskInput {
	measured: Measured;
	report: Report;
	engine: AiEngine;
	question: string;
	/** The conversation so far; only the last exchanges are sent (CHAT_MEMORY). */
	history: ChatMessage[];
	lang: Lang;
	signal?: AbortSignal;
	onStep?: (e: StepEvent) => void;
	now?: () => number;
	id?: string;
}

type RawAnswer = {
	answer: string;
	out_of_scope: boolean;
	needs_posting?: boolean;
	cards?: string[];
	citations: { ref: string; quote?: string }[];
	rewrites: { source_ref: string; text: string }[];
};

export function reportSummary(report: Report) {
	return {
		verdict: report.verdict,
		score: report.overall,
		score_rule: "computed by the page from the findings with a published formula",
		findings: report.findings.map((f) => ({ type: f.type, title: f.title, severity: f.severity, source: f.provenance === "measured" ? "measured by the page" : "AI review" })),
	};
}

export async function askCv(input: AskInput): Promise<ChatMessage> {
	const { measured, report, engine, lang, signal } = input;
	const ctx: TaskContext = {
		lang,
		docInfo: measured.info,
		outline: measured.outline,
		layoutFacts: layoutFactsForModel(measured.facts, measured.index.doc.format),
		measured: [],
		compactProfile: report.profile ? compactProfile(report.profile) : null,
		reportSummary: reportSummary(report),
		history: memoryOf(input.history),
		question: input.question,
		job: report.job ? compactJob(report.job) : undefined,
	};
	const id = input.id ?? `a-${Math.random().toString(36).slice(2, 10)}`;
	const now = input.now ?? Date.now;
	// The answer bubble only says "try rephrasing"; the AI log keeps the reason.
	const failure = (err: unknown) => {
		if (!signal?.aborted) report.log.push({ task: "ask", step: 0, kind: "failure", message: err instanceof TaskError ? err.message : `the on-device model stopped (${engineErrorText(err)})`, ms: 0, at: now() });
		return err;
	};
	const base = await engine.createSession({ system: SYSTEM_PROMPT, langs: engineLangs(lang), signal }).catch((err) => Promise.reject(failure(err)));
	try {
		const raw = (await runTask("ask", { base, index: measured.index, ctx, log: report.log, signal, onStep: input.onStep, now }).catch((err) => Promise.reject(failure(err)))) as RawAnswer;
		if (raw.out_of_scope) return chatMessage({ id, role: "assistant", outOfScope: true, reportId: report.id });
		const citations = verifyEvidence(raw.citations, measured.index);
		const allowed = postingTermsInCv(report.job);
		const rewrites: Rewrite[] = raw.rewrites.map((r) => {
			const line = measured.index.byRef.get(r.source_ref);
			if (!line) return { sourceRef: null, sourceLine: null, text: null, added: ["source"], postingMissing: [] };
			const guard = guardPhrasing(r.text, line.text, allowed);
			return { sourceRef: line.ref, sourceLine: line.text, text: guard.ok ? r.text : null, added: guard.added, postingMissing: postingMissing(guard.added, report.job) };
		});
		return chatMessage({
			id,
			role: "assistant",
			text: raw.answer,
			citations,
			rewrites,
			cards: cardsFor(raw.cards ?? [], report.job),
			needsPosting: !report.job && raw.needs_posting === true,
			unverified: citations.length > 0 && citations.every((c) => !c.verified),
			reportId: report.id,
		});
	} finally {
		base.destroy();
	}
}
