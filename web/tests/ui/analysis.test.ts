// The analysis state machine, transition by transition (contracts/ui.md).
import { chatMessage } from "@domain/chat/model";
import { JOB } from "../fakes/job";
import { describe, expect, it } from "vitest";
import { measureLayout } from "@app/usecases/measureLayout";
import type { Report } from "@domain/report/report";
import { initialState, reducer, type AnalysisState } from "@ui/app/analysis";
import { readPdf, EXAMPLE, fixture } from "../support";

const file = { name: "cv.pdf", size: 1000 };
const fakeReport = (id: string) => ({ id, log: [] }) as unknown as Report;

describe("analysis reducer", async () => {
	const measured = measureLayout(await readPdf(EXAMPLE), "en");
	const scanned = measureLayout(await readPdf(fixture("scanned")), "en");
	const started = () => reducer(initialState("available"), { type: "start", file });

	it("start: read running, layout and AI steps pending", () => {
		const s = started();
		expect(s.phase).toBe("reading");
		expect(s.steps.map((x) => `${x.id}:${x.status}`)).toEqual([
			"read:running", "layout:pending", "extract_contact:pending", "extract_sections_experience:pending", "extract_education_skills:pending", "review:pending",
		]);
	});

	it("measured without AI marks the AI steps skipped with a reason", () => {
		const s = reducer(started(), { type: "measured", measured, aiPlanned: false });
		expect(s.steps.filter((x) => x.status === "skipped").map((x) => x.skipReason)).toEqual(["no-ai", "no-ai", "no-ai", "no-ai"]);
		expect(s.steps[0]!.detail?.key).toBe("readPages");
	});

	it("an unreadable file skips the AI even when an engine is ready", () => {
		const s = reducer(started(), { type: "measured", measured: scanned, aiPlanned: true });
		expect(s.steps.filter((x) => x.status === "skipped")).toHaveLength(4);
	});

	it("consent: declined skips the AI; accepted inserts a download step that tracks progress", () => {
		const waiting = reducer(reducer(started(), { type: "measured", measured, aiPlanned: true }), { type: "needConsent" });
		expect(waiting.phase).toBe("consent");
		const declined = reducer(waiting, { type: "consent", accepted: false });
		expect(declined.steps.filter((x) => x.skipReason === "declined")).toHaveLength(4);
		let s: AnalysisState = reducer(waiting, { type: "consent", accepted: true });
		expect(s.steps[2]!.id).toBe("download");
		s = reducer(s, { type: "downloadProgress", share: 0.42 });
		expect(s.steps[2]!.detail?.params).toEqual({ n: 42 });
		s = reducer(s, { type: "downloaded" });
		expect(s.engine.availability).toBe("available");
		expect(s.steps[2]!.status).toBe("done");
	});

	it("tool events become a live detail line under the running step", () => {
		const s = reducer(started(), { type: "progress", event: { step: "extract_contact", status: "running", detail: { task: "extract_contact", tool: "read_lines", args: { page: 1, from: 1, to: 20 } } }, log: [] });
		expect(s.steps.find((x) => x.id === "extract_contact")!.detail).toEqual({ key: "tool.read_lines", params: { page: "1", from: "1", to: "20" } });
	});

	it("a finished report becomes the rescan baseline; Clear forgets it, Cancel keeps it", () => {
		let s = reducer(started(), { type: "done", report: fakeReport("a") });
		s = reducer(s, { type: "start", file });
		expect(s.previous?.id).toBe("a");
		expect(s.report).toBeNull();
		expect(reducer(s, { type: "cancelled" }).previous?.id).toBe("a");
		const cleared = reducer(s, { type: "clear" });
		expect(cleared.previous).toBeNull();
		expect(cleared.notice).toBe("cleared");
	});

	it("a model failure still shows results, flagged", () => {
		const s = reducer(started(), { type: "done", report: fakeReport("b"), modelError: true });
		expect(s.phase).toBe("done");
		expect(s.error).toBe("model");
	});

	it("chat: ask adds the question and a pending answer; answer, cancel and clear resolve it", () => {
		const done = reducer(started(), { type: "done", report: fakeReport("c") });
		let s = reducer(done, { type: "chatAsk", question: "Why?", id: "a1" });
		expect(s.chat.messages.map((m) => `${m.role}:${m.status}`)).toEqual(["user:done", "assistant:pending"]);
		expect(s.chat.running).toBe(true);
		s = reducer(s, { type: "chatStep", tool: "read_lines", args: { page: 1, from: 1, to: 20 } });
		expect(s.chat.status).toEqual({ key: "tool.read_lines", params: { page: "1", from: "1", to: "20" } });
		const answered = reducer(s, { type: "chatAnswer", message: chatMessage({ id: "a1", role: "assistant", text: "Because." }), log: [] });
		expect(answered.chat.messages[1]!.text).toBe("Because.");
		expect(answered.chat.running).toBe(false);
		expect(reducer(s, { type: "chatCancel" }).chat.messages[1]!.status).toBe("cancelled");
		expect(reducer(answered, { type: "clear" }).chat.messages).toEqual([]);
		// A new version keeps the conversation (spec 006, the edit loop).
		expect(reducer(answered, { type: "start", file }).chat.messages).toHaveLength(2);
	});

	it("chat (006): a posting sets the context and adds a page message; re-comparing it reports the change", () => {
		let s = reducer(started(), { type: "done", report: fakeReport("c") });
		const posting = { text: "Senior Backend Engineer…", title: "Backend" };
		s = reducer(s, { type: "jobDone", report: { ...fakeReport("c"), job: JOB } as Report, posting });
		expect(s.chat.posting).toEqual({ ...posting, percent: 67 });
		expect(s.chat.messages.at(-1)!.event).toMatchObject({ kind: "job", percent: 67, before: null });
		const better = { ...JOB, summary: { ...JOB.summary!, percent: 80 } };
		s = reducer(s, { type: "jobDone", report: { ...fakeReport("c"), job: better } as Report, posting });
		expect(s.chat.messages.at(-1)!.event).toMatchObject({ percent: 80, before: 67 });
		s = reducer(s, { type: "jobFailed" });
		expect(s.chat.messages.at(-1)!.event).toEqual({ kind: "jobFailed" });
		s = reducer(s, { type: "chatReset" });
		expect(s.chat.messages).toEqual([]);
		expect(s.chat.posting?.title).toBe("Backend");
	});

	it("chat (006): a new version keeps the conversation and adds a version message; Clear removes it all", () => {
		const report = (id: string, overall: number) => ({ id, log: [], overall, findings: [], document: { fileName: "cv.pdf" } }) as unknown as Report;
		let s = reducer(started(), { type: "done", report: report("v1", 60) });
		s = reducer(s, { type: "chatAsk", question: "Why?", id: "a1" });
		s = reducer(s, { type: "start", file });
		expect(s.chat.messages).toHaveLength(2);
		expect(s.chat.running).toBe(false);
		s = reducer(s, { type: "done", report: report("v2", 72) });
		expect(s.chat.messages.at(-1)!.event).toMatchObject({ kind: "version", scoreBefore: 60, scoreAfter: 72 });
		expect(reducer(s, { type: "clear" }).chat).toMatchObject({ messages: [], posting: null });
	});
});
