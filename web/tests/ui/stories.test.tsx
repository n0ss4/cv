// @vitest-environment jsdom
// US2 transparency, US3 evidence, US4 rescan, US5 job match, US6 capability, US7 formats in the UI.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeEngine } from "../fakes/fakeEngine";
import { SAMPLE_TXT, TextReader } from "../fakes/TextReader";
import { EXAMPLE, fileFrom, fixture, nodePdfReader } from "../support";
import { a11yViolations, noInlineStyles, renderApp } from "./render";
import { goodScript } from "./scripts";

const drop = (file: File) => fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });
const results = () => screen.findByRole("heading", { level: 1, name: /ATS/ }, { timeout: 10000 });

describe("US2 — privacy and AI transparency", () => {
	it("the privacy chip is on every screen and opens the details panel with the live policy", async () => {
		document.head.insertAdjacentHTML("beforeend", `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'">`);
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		const chip = await screen.findByRole("button", { name: /On this device · nothing uploaded/ });
		fireEvent.click(chip);
		const dialog = await screen.findByRole("dialog", { name: "Where your CV goes" });
		expect(within(dialog).getByText(/connect-src 'none'/)).toBeTruthy();
		expect(within(dialog).getByText("Check it yourself")).toBeTruthy();
		expect(await a11yViolations()).toEqual([]);
		fireEvent.keyDown(dialog, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		drop(fileFrom(EXAMPLE));
		await results();
		expect(screen.getByRole("button", { name: /On this device/ })).toBeTruthy();
	});

	it("About the AI names the engine, its limits, the badge legend and links to the exact prompts", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		fireEvent.click((await screen.findAllByRole("button", { name: /About the AI/ }))[0]!);
		const dialog = await screen.findByRole("dialog", { name: "About the AI" });
		expect(within(dialog).getByText(/Scripted fake · Test/)).toBeTruthy();
		expect(within(dialog).getByText("It can be wrong")).toBeTruthy();
		expect(within(dialog).getByText("AI · unverified")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: /exact prompts/ }));
		const prompts = await screen.findByRole("dialog", { name: "Prompts and rules" });
		expect(within(prompts).getByText(/You are an ATS \(applicant tracking system\) analyst/)).toBeTruthy();
		expect(within(prompts).getByText("multi_column_layout")).toBeTruthy();
	});

	it("every finding carries a provenance badge, and the AI log shows tool calls", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(fixture("two-column")));
		await results();
		const articles = screen.getAllByRole("article");
		for (const a of articles) expect(within(a).getByText(/^(Measured|AI · verified|AI · unverified)$/)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /How the AI read your CV/ }));
		const log = await screen.findByRole("dialog", { name: "How the AI read your CV" });
		expect(within(log).getAllByText(/read_lines/).length).toBeGreaterThan(0);
		expect(within(log).getAllByText(/Prepared by the page/).length).toBe(3);
	});

	it("Clear removes the report, the log and the previous report", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(EXAMPLE));
		await results();
		fireEvent.click(screen.getByRole("button", { name: "Clear everything" }));
		expect(await screen.findByText(/Your file, its text and the results are gone/)).toBeTruthy();
		drop(fileFrom(EXAMPLE));
		await results();
		expect(screen.queryByText(/Since your previous version/)).toBeNull();
	});
});

describe("US3 — what the ATS will file", () => {
	it("profile fields link to their lines; Show in ATS view highlights the evidence", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(fixture("two-column")));
		await results();
		fireEvent.click(screen.getAllByRole("button", { name: /Show in ATS view/ })[0]!);
		const panel = await screen.findByRole("tabpanel");
		const marked = panel.querySelectorAll('[aria-current="true"]');
		expect(marked.length).toBeGreaterThan(0);
		fireEvent.click(screen.getByRole("tab", { name: "What the ATS files" }));
		expect(await screen.findByText("jane.doe@example.com")).toBeTruthy();
		expect(screen.getAllByText("Not found").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Recruiters filter on this").length).toBeGreaterThan(0);
		expect(noInlineStyles()).toEqual([]);
	});
});

describe("US6 — browsers without on-device AI", () => {
	it("explains before the drop, then shows measured checks only — no score, no profile", async () => {
		renderApp({ engines: [] });
		expect(await screen.findByText(/no on-device AI, so there will be no AI review or score/)).toBeTruthy();
		drop(fileFrom(fixture("two-column")));
		await screen.findByText("Layout checked · AI review unavailable", {}, { timeout: 10000 });
		expect(screen.queryByText("of 100")).toBeNull();
		expect(screen.getByText(/No score: without an AI review/)).toBeTruthy();
		for (const a of screen.getAllByRole("article")) expect(within(a).getByText("Measured")).toBeTruthy();
		fireEvent.click(screen.getByRole("tab", { name: "What the ATS files" }));
		expect(await screen.findByText(/The profile is extracted by the on-device AI/)).toBeTruthy();
	});

	it("downloadable: asks for consent; declining gives layout checks only", async () => {
		const fake = fakeEngine(goodScript(), { availability: "downloadable" });
		renderApp({ engines: [fake.engine] });
		expect(await screen.findByText(/downloads its AI model once/)).toBeTruthy();
		drop(fileFrom(EXAMPLE));
		const dialog = await screen.findByRole("dialog", { name: /needs its AI model/ }, { timeout: 10000 });
		expect(within(dialog).getByText(/not part of the download/)).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "Layout checks only" }));
		await screen.findByText("Layout checked · AI review unavailable", {}, { timeout: 10000 });
		expect(fake.prepared()).toBe(0);
		expect(fake.prompts).toHaveLength(0);
	});

	it("downloadable: accepting downloads (with progress) and continues to the AI review", async () => {
		const fake = fakeEngine(goodScript(), { availability: "downloadable" });
		renderApp({ engines: [fake.engine] });
		drop(fileFrom(EXAMPLE));
		const dialog = await screen.findByRole("dialog", { name: /needs its AI model/ }, { timeout: 10000 });
		fireEvent.click(within(dialog).getByRole("button", { name: "Download and continue" }));
		await screen.findByText("Ready for an ATS", {}, { timeout: 10000 });
		expect(fake.prepared()).toBe(1);
	});
});

describe("US4 — rescan", () => {
	it("two-column then the example: the column finding is resolved and the score goes up", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(fixture("two-column")));
		await screen.findByText("Not ready for an ATS", {}, { timeout: 10000 });
		drop(fileFrom(EXAMPLE));
		const banner = await screen.findByText(/Since your previous version/, {}, { timeout: 10000 });
		expect(banner.textContent).toMatch(/score \d+ → \d+ · [1-9]\d* resolved/);
		const [before, after] = banner.textContent!.match(/score (\d+) → (\d+)/)!.slice(1).map(Number);
		expect(after!).toBeGreaterThan(before!);
	});
});

describe("US7 — a second format in the UI", () => {
	it("the drop zone accepts and analyses a registered text reader's files", async () => {
		renderApp({ readers: [nodePdfReader(), new TextReader()], engines: [] });
		expect(await screen.findByText(/We read: PDF, Plain text/)).toBeTruthy();
		drop(new File([SAMPLE_TXT], "cv.txt", { type: "text/plain" }));
		await screen.findByText("Layout checked · AI review unavailable", {}, { timeout: 10000 });
		fireEvent.click(screen.getByRole("tab", { name: "All checks" }));
		expect((await screen.findAllByText(/Not applicable to TXT/)).length).toBeGreaterThan(0);
	});
});

describe("Spanish", () => {
	it("renders the start screen in Spanish with no missing strings", async () => {
		renderApp({ lang: "es" });
		expect(await screen.findByRole("heading", { name: "Mira tu CV como lo ve un ATS" })).toBeTruthy();
		expect(screen.getByText(/Leemos: PDF/)).toBeTruthy();
		expect(document.body.textContent).not.toMatch(/\{\w+\}/);
	});
});

describe("model failures in the UI", () => {
	it("an AbortError the browser raised on its own shows the notice, not an endless analysis", async () => {
		const fake = fakeEngine(goodScript());
		fake.engine.createSession = () => Promise.reject(Object.assign(new Error("The model execution session has been destroyed."), { name: "AbortError" }));
		renderApp({ engines: [fake.engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(EXAMPLE));
		expect(await screen.findByText(/The on-device AI stopped unexpectedly/, {}, { timeout: 10000 })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /How the AI read your CV/ }));
		const drawer = await screen.findByRole("dialog", { name: "How the AI read your CV" });
		expect(within(drawer).getAllByText(/failed: the on-device model could not start \(AbortError/).length).toBeGreaterThan(0);
	});
});
