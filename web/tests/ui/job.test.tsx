// @vitest-environment jsdom
// The Job match tab (specs 004, 006): the detailed report of the posting
// added in the chat.
import { readFileSync } from "node:fs";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeEngine } from "../fakes/fakeEngine";
import { EXAMPLE, fileFrom } from "../support";
import { a11yViolations, noInlineStyles, renderApp } from "./render";
import { jobScript as script } from "./scripts";

const POSTING = readFileSync(`${process.cwd()}/tests/fixtures/postings/backend.txt`, "utf8");
const drop = (file: File) => fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });

/** Adds the posting from the chat, the one place to add it, then opens its tab. */
async function openJobTab(engines = [fakeEngine(script()).engine]) {
	renderApp({ engines });
	await screen.findByText(/We read/);
	drop(fileFrom(EXAMPLE));
	await screen.findByRole("tab", { name: "Overview" }, { timeout: 10000 });
	expect(screen.queryByRole("tab", { name: /Job match/ })).toBeNull();
	const chat = screen.getByRole("complementary", { name: "Chat with your CV" });
	fireEvent.click(within(chat).getByRole("button", { name: /Add a job posting/ }));
	fireEvent.change(within(chat).getByLabelText("Posting text"), { target: { value: POSTING } });
	fireEvent.click(within(chat).getByRole("button", { name: "Compare" }));
	fireEvent.click(await screen.findByRole("tab", { name: /^Job match/ }, { timeout: 10000 }));
}

describe("Job match tab", () => {
	it("leads with the summary, then what to fix first; shows filters, keywords and guarded suggestions", async () => {
		await openJobTab();
		const summary = (await screen.findByRole("heading", { name: "How well you match" }, { timeout: 10000 })).closest("section")!;
		expect(within(summary).getByText(/of 3 required/)).toBeTruthy();
		expect(within(summary).getByText(/of 1 preferred/)).toBeTruthy();
		expect(within(summary).getByText(/doesn't appear in your CV/)).toBeTruthy();

		const first = screen.getByRole("heading", { name: "Fix first for this job" }).closest("section")!;
		expect(within(first).getAllByText("Kubernetes").length).toBeGreaterThan(0);

		expect(screen.getByRole("heading", { name: "Hard filters" })).toBeTruthy();
		expect(screen.getAllByText(/years in your CV · asks for 5/).length).toBeGreaterThan(0);
		expect(screen.getByText(/Counted from your dated roles/)).toBeTruthy();

		const keywords = screen.getByRole("heading", { name: "Exact keywords" }).closest("section")!;
		expect(within(keywords).getByText("Kubernetes")).toBeTruthy();

		// The Terraform phrasing invented "Acme" and "3 years": withheld. The Kubernetes one is shown with Copy.
		expect(screen.getAllByText(/added things your CV doesn't say \(.*Acme.*\)/).length).toBeGreaterThan(0);
		expect(screen.getAllByText("Jane Doe Kubernetes").length).toBeGreaterThan(0);
		expect(screen.getAllByRole("button", { name: "Copy" }).length).toBeGreaterThan(0);

		expect(await a11yViolations()).toEqual([]);
		expect(noInlineStyles()).toEqual([]);
	});

	it("without on-device AI: says what needs the AI and still runs the exact-keyword check", async () => {
		await openJobTab([]);
		const keywords = (await screen.findByRole("heading", { name: "Exact keywords" }, { timeout: 10000 })).closest("section")!;
		expect(screen.getByText(/only the exact-keyword check runs/)).toBeTruthy();
		expect(within(keywords).getAllByText("Measured").length).toBeGreaterThan(0);
		expect(screen.queryByRole("heading", { name: "How well you match" })).toBeNull();
	});

	it("the keywords score in the overview reflects the match %", async () => {
		await openJobTab();
		await screen.findByRole("heading", { name: "How well you match" }, { timeout: 10000 });
		fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
		await waitFor(() => expect(screen.getAllByText("Job keywords").length).toBeGreaterThan(0));
	});
});
