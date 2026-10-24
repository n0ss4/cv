// @vitest-environment jsdom
// The chat with your CV (specs 005, 006): one panel beside the report, a sheet
// on narrow screens, the posting in context, page cards, the edit loop.
import { readFileSync } from "node:fs";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeEngine, type Script } from "../fakes/fakeEngine";
import { EXAMPLE, fileFrom } from "../support";
import { a11yViolations, noInlineStyles, renderApp } from "./render";
import { jobScript } from "./scripts";

const POSTING = readFileSync(`${process.cwd()}/tests/fixtures/postings/backend.txt`, "utf8");
const drop = (file: File) => fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });
const T = { timeout: 10000 };

const answer = (a: Record<string, unknown>) => [{ next: "answer" }, { out_of_scope: false, citations: [], rewrites: [], cards: [], ...a }];

/** The chat's replies, one per question asked, in order. */
const script = (...replies: unknown[][]): Script => ({
	...jobScript(),
	ask: (run) => replies[Math.min(run, replies.length - 1)]!,
});

const cited = () => [
	{ next: "read_lines", page: 1, from: 1, to: 10 },
	{ next: "answer" },
	{ answer: "Your most recent role is listed first.", out_of_scope: false, citations: [{ ref: "p1:1", quote: "Jane Doe" }], rewrites: [{ source_ref: "p1:1", text: "Jane Doe" }, { source_ref: "p1:1", text: "Jane Doe at Acme" }] },
];

async function results(replies: unknown[][] = [cited()], engines?: ReturnType<typeof fakeEngine>["engine"][]) {
	renderApp({ engines: engines ?? [fakeEngine(script(...replies)).engine] });
	await screen.findByText(/We read/);
	drop(fileFrom(EXAMPLE));
	await screen.findByRole("tab", { name: "Overview" }, T);
	return screen.getByRole("complementary", { name: "Chat with your CV" });
}

async function addPosting(panel: HTMLElement) {
	fireEvent.click(within(panel).getByRole("button", { name: /Add a job posting/ }));
	fireEvent.change(within(panel).getByLabelText("Posting text"), { target: { value: POSTING } });
	fireEvent.change(within(panel).getByLabelText("Job title (optional)"), { target: { value: "Backend" } });
	fireEvent.click(within(panel).getByRole("button", { name: "Compare" }));
	return within(panel).findByText(/Posting compared: Backend/, {}, T);
}

afterEach(() => vi.unstubAllGlobals());

describe("chat panel (spec 006)", () => {
	it("sits beside the report on every tab; there is no Ask tab; answers are cited and rewrites guarded", async () => {
		const panel = await results();
		expect(screen.queryByRole("tab", { name: "Ask" })).toBeNull();
		expect(within(panel).getByText(/can't change your score/)).toBeTruthy();
		fireEvent.click(within(panel).getByRole("button", { name: "What does the ATS see as my most recent job?" }));
		const log = within(panel).getByRole("log");
		expect(await within(log).findByText("Your most recent role is listed first.", {}, T)).toBeTruthy();
		expect(within(log).getByText("AI · verified")).toBeTruthy();
		expect(within(log).getAllByRole("button", { name: "Copy" })).toHaveLength(1);
		expect(within(log).getByText(/Withheld: it added things the line doesn't say \(Acme\)/)).toBeTruthy();
		// The conversation stays while the report changes tabs.
		fireEvent.click(screen.getByRole("tab", { name: "All checks" }));
		expect(within(panel).getByText("Your most recent role is listed first.")).toBeTruthy();
		expect(await a11yViolations()).toEqual([]);
		expect(noInlineStyles()).toEqual([]);
	});

	it("a citation shows the line in the report's ATS view and keeps the conversation", async () => {
		const panel = await results();
		fireEvent.click(within(panel).getByRole("button", { name: "What should I fix first?" }));
		fireEvent.click(await within(panel).findByRole("button", { name: "p1:1" }, T));
		await waitFor(() => expect(document.querySelector('[aria-current="true"]')?.textContent).toContain("p1:1"));
		expect(screen.getByRole("tab", { name: "ATS view" }).getAttribute("aria-selected")).toBe("true");
		expect(within(panel).getByText("Your most recent role is listed first.")).toBeTruthy();
	});

	it("can be hidden and brought back with the conversation", async () => {
		const panel = await results();
		fireEvent.click(within(panel).getByRole("button", { name: "What should I fix first?" }));
		await within(panel).findByText("Your most recent role is listed first.", {}, T);
		fireEvent.click(within(panel).getByRole("button", { name: "Hide chat" }));
		expect(screen.queryByRole("complementary", { name: "Chat with your CV" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Chat with your CV" }));
		expect(within(screen.getByRole("complementary", { name: "Chat with your CV" })).getByText("Your most recent role is listed first.")).toBeTruthy();
	});

	it("an off-topic question gets the page's refusal, not the model's words", async () => {
		const panel = await results([[{ next: "answer" }, { answer: "Roses", out_of_scope: true, citations: [], rewrites: [] }]]);
		fireEvent.change(within(panel).getByLabelText("Your question"), { target: { value: "Write me a poem" } });
		fireEvent.click(within(panel).getByRole("button", { name: "Send" }));
		expect(await within(panel).findByText(/I can only help with this CV/, {}, T)).toBeTruthy();
		expect(screen.queryByText("Roses")).toBeNull();
	});
});

describe("posting in context", () => {
	it("adding a posting shows the page's match; fit questions show the page's figures, not the model's", async () => {
		const panel = await results([answer({ answer: "You're a 95% match.", cards: ["fit", "keywords"] })]);
		const event = (await addPosting(panel)).closest("li")!;
		const percent = /(\d+)% match/.exec(event.textContent ?? "")![1]!;
		expect(within(event).getByText("Measured")).toBeTruthy();
		const context = within(panel).getByRole("group", { name: "Context" }).textContent ?? "";
		expect(context).toContain("Posting: Backend");
		expect(context).toContain(`${percent}%`);
		// The suggestions are now about the posting.
		fireEvent.click(within(panel).getByRole("button", { name: "Am I right for this job?" }));
		const card = (await within(panel).findByText("Your match", {}, T)).closest("div")!.parentElement!;
		expect(card.textContent).toContain(`${percent}%`);
		expect(card.textContent).not.toContain("95%");
		expect(within(panel).getByText("Keywords")).toBeTruthy();
		// Same figure as the Job match tab, which the posting also filled.
		fireEvent.click(within(card).getByRole("button", { name: /Open Job match/ }));
		const summary = (await screen.findByRole("heading", { name: "How well you match" })).closest("section")!;
		expect(summary.textContent).toContain(`${percent}%`);
		expect(await a11yViolations()).toEqual([]);
	});

	it("the Job match tab exists only while a posting is in context, named with its match", async () => {
		const panel = await results();
		expect(screen.queryByRole("tab", { name: /Job match/ })).toBeNull();
		const percent = /(\d+)% match/.exec((await addPosting(panel)).closest("li")!.textContent ?? "")![1]!;
		expect(screen.getByRole("tab", { name: `Job match · ${percent}%` })).toBeTruthy();
	});

	it("without a posting, a posting question offers to add one", async () => {
		const panel = await results([answer({ answer: "Add the posting and I'll compare it.", needs_posting: true })]);
		fireEvent.change(within(panel).getByLabelText("Your question"), { target: { value: "Am I right for a backend job?" } });
		fireEvent.click(within(panel).getByRole("button", { name: "Send" }));
		await within(panel).findByText("Add the posting and I'll compare it.", {}, T);
		fireEvent.click(within(within(panel).getByRole("log")).getByRole("button", { name: "Add a posting" }));
		expect(within(panel).getByLabelText("Posting text")).toBeTruthy();
	});

	it("a rewrite that adds a skill the posting asks for and the CV lacks says so", async () => {
		const panel = await results([answer({ answer: "Here:", rewrites: [{ source_ref: "p1:1", text: "Jane Doe gRPC" }] })]);
		await addPosting(panel);
		fireEvent.click(within(panel).getByRole("button", { name: "What should I change for this posting?" }));
		expect(await within(panel).findByText(/the posting asks for gRPC, but your CV doesn't mention it/, {}, T)).toBeTruthy();
	});

	it("Remove takes the posting out everywhere: chat, Job match tab and score", async () => {
		const panel = await results();
		const score = () => document.getElementById("verdict")!.closest("section")!.textContent;
		const before = score();
		await addPosting(panel);
		fireEvent.click(screen.getByRole("tab", { name: /^Job match/ }));
		await waitFor(() => expect(screen.getAllByText("Job keywords").length).toBeGreaterThan(0));
		fireEvent.click(within(panel).getByRole("button", { name: "Remove" }));
		expect(within(panel).getByText(/Posting removed/)).toBeTruthy();
		expect(within(panel).getByRole("button", { name: /Add a job posting/ })).toBeTruthy();
		expect(screen.queryByRole("tab", { name: /Job match/ })).toBeNull();
		// The tab that was open falls back to the overview, and the score is the one without the posting.
		expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
		expect(score()).toBe(before);
		expect(screen.queryByText("Job keywords")).toBeNull();
	});

	it("Change opens the posting with its text, to edit and compare again", async () => {
		const panel = await results();
		await addPosting(panel);
		fireEvent.click(within(panel).getByRole("button", { name: "Change" }));
		expect((within(panel).getByLabelText("Posting text") as HTMLTextAreaElement).value).toContain("Senior Backend Engineer");
		expect((within(panel).getByLabelText("Job title (optional)") as HTMLInputElement).value).toBe("Backend");
	});

	it("New conversation keeps the posting", async () => {
		const panel = await results();
		await addPosting(panel);
		fireEvent.click(within(panel).getByRole("button", { name: "New conversation" }));
		expect(within(panel).queryByText(/Posting compared/)).toBeNull();
		expect(within(panel).getByText(/Posting: Backend/)).toBeTruthy();
	});
});

describe("the edit loop", () => {
	it("a new version keeps the conversation, re-compares the posting and marks old citations", async () => {
		const panel = await results();
		await addPosting(panel);
		fireEvent.click(within(panel).getByRole("button", { name: "What should I change for this posting?" }));
		await within(panel).findByRole("button", { name: "p1:1" }, T);
		drop(fileFrom(EXAMPLE));
		const again = await screen.findByRole("complementary", { name: "Chat with your CV" }, T);
		expect(await within(again).findByText("New version analysed", {}, T)).toBeTruthy();
		await waitFor(() => expect(within(again).getAllByText(/Posting compared: Backend/)).toHaveLength(2), T);
		expect(within(again).getByText("Your most recent role is listed first.")).toBeTruthy();
		expect(within(again).queryByRole("button", { name: "p1:1" })).toBeNull();
		expect(within(again).getAllByText(/previous version/).length).toBeGreaterThan(0);
	});

	it("Clear everything removes the conversation and the posting", async () => {
		const panel = await results();
		await addPosting(panel);
		fireEvent.click(screen.getByRole("button", { name: "Clear everything" }));
		await screen.findByText(/Your file, its text and the results are gone/);
		drop(fileFrom(EXAMPLE));
		const fresh = await screen.findByRole("complementary", { name: "Chat with your CV" }, T);
		expect(within(fresh).queryByText(/Posting/)).toBeNull();
		expect(within(fresh).getByRole("button", { name: /Add a job posting/ })).toBeTruthy();
	});

	it("Stop cancels a running question", async () => {
		const panel = await results([cited()], [fakeEngine(script(cited()), { delay: 60 }).engine]);
		fireEvent.click(within(panel).getByRole("button", { name: "Why does my CV get this score?" }));
		fireEvent.click(await within(panel).findByRole("button", { name: "Stop" }));
		expect(await within(panel).findByText("Stopped.")).toBeTruthy();
	});
});

describe("without AI, on mobile, in the log", () => {
	it("without on-device AI the panel explains why, and a posting still gets the page's comparison", async () => {
		const panel = await results([], []);
		expect(within(panel).getByText(/Questions need the on-device AI/)).toBeTruthy();
		expect(within(panel).queryByLabelText("Your question")).toBeNull();
		fireEvent.click(within(panel).getByRole("button", { name: /Add a job posting/ }));
		fireEvent.change(within(panel).getByLabelText("Posting text"), { target: { value: POSTING } });
		fireEvent.click(within(panel).getByRole("button", { name: "Compare" }));
		expect(await within(panel).findByText(/Only the exact keywords were checked/, {}, T)).toBeTruthy();
	});

	it("on a narrow screen the chat is a sheet; a citation closes it and shows the line", async () => {
		vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
		renderApp({ engines: [fakeEngine(script(cited())).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(EXAMPLE));
		const open = await screen.findByRole("button", { name: "Chat with your CV" }, T);
		expect(screen.queryByRole("complementary")).toBeNull();
		fireEvent.click(open);
		const sheet = screen.getByRole("dialog", { name: "Chat with your CV" });
		fireEvent.click(within(sheet).getByRole("button", { name: "What should I fix first?" }));
		fireEvent.click(await within(sheet).findByRole("button", { name: "p1:1" }, T));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.querySelector('[aria-current="true"]')?.textContent).toContain("p1:1");
		fireEvent.click(screen.getByRole("button", { name: "Chat with your CV" }));
		expect(within(screen.getByRole("dialog")).getByText("Your most recent role is listed first.")).toBeTruthy();
		expect(await a11yViolations()).toEqual([]);
	});

	it("the chat's tool calls appear in the AI log", async () => {
		const panel = await results();
		fireEvent.click(within(panel).getByRole("button", { name: "What should I fix first?" }));
		await within(panel).findByText("Your most recent role is listed first.", {}, T);
		fireEvent.click(screen.getByRole("button", { name: /How the AI read your CV/ }));
		const drawer = await screen.findByRole("dialog", { name: "How the AI read your CV" });
		expect(within(drawer).getAllByText(/^Ask · /).length).toBeGreaterThan(0);
	});
});
