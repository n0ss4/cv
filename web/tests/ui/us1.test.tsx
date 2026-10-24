// @vitest-environment jsdom
// US1: drop a CV, follow the steps, read "Fix these first".
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeEngine } from "../fakes/fakeEngine";
import { EXAMPLE, fileFrom, fixture } from "../support";
import { a11yViolations, noInlineStyles, renderApp } from "./render";
import { goodScript } from "./scripts";

const drop = (file: File) => {
	const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
	fireEvent.change(input, { target: { files: [file] } });
};

describe("US1 — check a CV and know what to fix first", () => {
	it("start screen says what we read, from the registry, and passes axe", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		expect(await screen.findByText(/We read: PDF · up to 10 MB/)).toBeTruthy();
		expect(document.querySelector('input[type="file"]')!.getAttribute("accept")).toBe(".pdf,application/pdf");
		expect(await a11yViolations()).toEqual([]);
		expect(noInlineStyles()).toEqual([]);
	});

	it("example CV → steps → ready verdict with a score; the AI steps ran", async () => {
		const { engine } = fakeEngine(goodScript());
		renderApp({ engines: [engine] });
		await screen.findByText(/We read/);
		await waitFor(() => expect(screen.queryByText(/no on-device AI/i)).toBeNull());
		drop(fileFrom(EXAMPLE));
		expect(await screen.findByText(/Checking CV_Jane_Doe_EN.pdf/)).toBeTruthy();
		const verdict = await screen.findByRole("heading", { level: 1, name: /An ATS can read it/ }, { timeout: 10000 });
		expect(verdict).toBeTruthy();
		expect(screen.getByText("Ready for an ATS")).toBeTruthy();
		expect(screen.getByText("of 100")).toBeTruthy();
		expect(await a11yViolations()).toEqual([]);
		expect(noInlineStyles()).toEqual([]);
	});

	it("two-column → the first fix is the measured column finding, with evidence", async () => {
		renderApp({ engines: [fakeEngine(goodScript()).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(fixture("two-column")));
		await screen.findByRole("heading", { level: 1, name: /would miss key information/ }, { timeout: 10000 });
		const fix = screen.getByRole("heading", { name: "Fix these first" }).parentElement!;
		const first = within(fix).getAllByRole("article")[0]!;
		expect(within(first).getByText("Two columns get mixed together")).toBeTruthy();
		expect(within(first).getByText("Measured")).toBeTruthy();
		expect(within(first).getAllByText(/^p1:\d+$/).length).toBeGreaterThan(0);
	});

	it("a scanned PDF is unreadable and never reaches the model", async () => {
		const fake = fakeEngine(goodScript());
		renderApp({ engines: [fake.engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(fixture("scanned")));
		await screen.findByRole("heading", { level: 1, name: /blank document/ }, { timeout: 10000 });
		expect(fake.prompts).toHaveLength(0);
	});

	it("Cancel stops the run and says nothing was kept", async () => {
		renderApp({ engines: [fakeEngine(goodScript(), { delay: 50 }).engine] });
		await screen.findByText(/We read/);
		drop(fileFrom(EXAMPLE));
		fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
		expect(await screen.findByText(/Cancelled. Nothing was kept./)).toBeTruthy();
	});

	it("an unsupported file names the supported formats", async () => {
		renderApp();
		await screen.findByText(/We read/);
		drop(new File(["hello"], "cv.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
		expect(await screen.findByText(/We can't read this file. We read: PDF./)).toBeTruthy();
	});
});
