// When the browser ends the model's session on its own (Chrome does under
// memory pressure, and reports it as an AbortError), the analysis recovers
// instead of being treated as cancelled by the user.
import { describe, expect, it } from "vitest";
import type { Document } from "@domain/document/types";
import { analyseCv } from "@app/usecases/analyseCv";
import { measureLayout } from "@app/usecases/measureLayout";
import { fakeEngine } from "../fakes/fakeEngine";
import { goodScript } from "../ui/scripts";

const CV = `Taylor Example
taylor.example@example.com | +1 555 0177
Summary
Backend engineer building payment platforms in Go and PostgreSQL for regulated markets.
Experience
Senior Backend Engineer, Example Payments, 2020 - present
Led the migration of the ledger service to event sourcing, cutting reconciliation time.
Built the settlement API used by every merchant integration and its monitoring.
Backend Engineer, Example Logistics, 2016 - 2020
Designed the routing service that schedules deliveries across three regions.
Education
BSc Computer Science, Example University, 2012 - 2016
Skills
Go, Python, PostgreSQL, Kafka, Kubernetes`;
const doc: Document = { format: "txt", fileName: "cv.txt", fileSize: CV.length, capabilities: { positions: false, pages: false, graphics: false, structure: false }, pages: [{ number: 1, lines: CV.split("\n") }] };

const ended = () => Object.assign(new Error("The model execution session has been destroyed."), { name: "AbortError" });

describe("model failures", () => {
	it("restarts a session the browser ended and runs that task once more", async () => {
		const good = goodScript();
		const contact = good.extract_contact as unknown[];
		const fake = fakeEngine({ ...good, extract_contact: (run) => (run === 0 ? [ended()] : contact) });
		const report = await analyseCv({ measured: measureLayout(doc, "en"), engine: fake.engine, lang: "en" });
		expect(report.verdict).not.toBe("incomplete");
		expect(fake.creates()).toBe(2);
		expect(report.log.some((l) => l.task === "extract_contact" && l.kind === "retry" && /AbortError: The model execution session has been destroyed/.test(l.message ?? ""))).toBe(true);
	});

	it("fails only that task when the model stops twice, with the reason in the log", async () => {
		const fake = fakeEngine({ ...goodScript(), extract_contact: [ended()] });
		const report = await analyseCv({ measured: measureLayout(doc, "en"), engine: fake.engine, lang: "en" });
		expect(report.verdict).toBe("incomplete");
		// The other tasks ran on a fresh session.
		expect(report.log.filter((l) => l.kind === "failure").map((l) => l.task)).toEqual(["extract_contact"]);
		expect(report.log.some((l) => l.task === "review" && l.message === "answer requested")).toBe(true);
		expect(report.log.find((l) => l.task === "extract_contact" && l.kind === "failure")?.message).toMatch(/model stopped \(AbortError/);
	});

	it("skips the remaining tasks when a new session can't be started", async () => {
		const fake = fakeEngine({ ...goodScript(), extract_contact: [ended()] }, { failCreate: 0 });
		let n = 0;
		const create = fake.engine.createSession;
		fake.engine.createSession = (o) => (n++ === 0 ? create(o) : Promise.reject(Object.assign(new Error("gone"), { name: "UnknownError" })));
		const report = await analyseCv({ measured: measureLayout(doc, "en"), engine: fake.engine, lang: "en" });
		expect(report.verdict).toBe("incomplete");
		expect(report.log.filter((l) => l.kind === "failure" && /skipped/.test(l.message ?? ""))).toHaveLength(3);
	});

	it("retries a model that can't start once, then reports why it gave up", async () => {
		expect((await analyseCv({ measured: measureLayout(doc, "en"), engine: fakeEngine(goodScript(), { failCreate: 1 }).engine, lang: "en" })).verdict).not.toBe("incomplete");
		const log: never[] = [];
		await expect(analyseCv({ measured: measureLayout(doc, "en"), engine: fakeEngine(goodScript(), { failCreate: Infinity }).engine, lang: "en", log })).rejects.toThrow();
		expect((log as { kind: string; message?: string }[]).at(-1)).toMatchObject({ kind: "failure", message: expect.stringMatching(/could not start \(UnknownError/) });
	});

	it("a real cancellation still cancels", async () => {
		const c = new AbortController();
		c.abort();
		const fake = fakeEngine(goodScript());
		await expect(analyseCv({ measured: measureLayout(doc, "en"), engine: fake.engine, lang: "en", signal: c.signal })).rejects.toMatchObject({ name: "AbortError" });
	});
});
