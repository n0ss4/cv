// The orchestrator and analyseCv against a scripted fake engine, on real PDFs
// read by the real reader: tool loop, limits, retries, verification, catalogue
// enforcement, measured + AI merge and scoring (FR-027).
import { describe, expect, it } from "vitest";
import { parseModelJSON } from "@app/agent/json";
import { repair, validate } from "@app/agent/validate";
import * as S from "@app/prompts/schemas";
import { readLines, runTool, search, MAX_READ } from "@app/tools/tools";
import { analyseCv } from "@app/usecases/analyseCv";
import { measureLayout } from "@app/usecases/measureLayout";
import { fakeEngine, type Script } from "../fakes/fakeEngine";
import { EXAMPLE, fixture, indexPdf, readPdf } from "../support";

const measuredExample = async () => measureLayout(await readPdf(EXAMPLE), "en");

const goodScript = (): Script => ({
	extract_contact: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "answer" },
		{
			name: { value: "Jane Doe", refs: ["p1:1"] },
			headline: { value: "Data Engineer", refs: ["p1:2"] },
			email: { value: "jane.doe@example.com", refs: ["p1:3"] },
			phone: { value: "+1 555 0100", refs: ["p1:3"] },
			location: { value: "Valencia, Spain", refs: ["p1:3"] },
			links: [{ kind: "portfolio", value: "janedoe.example.com", refs: ["p1:4"] }],
		},
	],
	extract_sections_experience: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "read_lines", page: 1, from: 21, to: 40 },
		{ next: "answer" },
		{ sections: [{ heading: "SUMMARY", kind: "summary", ref: "p1:5" }, { heading: "Invented heading", kind: "other", ref: "p1:6" }], experience: [] },
	],
	extract_education_skills: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "read_lines", page: 2, from: 1, to: 20 },
		{ next: "answer" },
		{ education: [], skills: [{ value: "Python", ref: "p1:9" }], languages: [], certifications: [] },
	],
	review: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "answer" },
		{
			findings: [
				{ type: "duty_style_bullets", title: "t", why: "w", fix: "f", evidence: [{ ref: "p1:1", quote: "Jane Doe" }] },
				{ type: "duty_style_bullets", title: "dup", why: "w", fix: "f", evidence: [] },
				{ type: "first_person", title: "t", why: "w", fix: "f", evidence: [{ ref: "p1:1", quote: "not on this line" }] },
			],
			strengths: ["Clear structure"],
		},
	],
});

describe("tools", async () => {
	const ix = await indexPdf(EXAMPLE);
	it("read_lines, search and errors", () => {
		const lines = readLines(ix, { page: 1, from: 1, to: 3 }) as { ref: string }[];
		expect(lines).toHaveLength(3);
		expect(lines[0]!.ref).toBe("p1:1");
		expect((readLines(ix, { page: 1, from: 1, to: 500 }) as unknown[]).length).toBeLessThanOrEqual(MAX_READ);
		expect((search(ix, { query: "jane.doe@" }) as { text: string }[])[0]!.text).toContain("jane.doe@example.com");
		expect(readLines(ix, { page: 9 })).toHaveProperty("error");
		expect(runTool(ix, "delete_everything")).toHaveProperty("error");
	});
	it("doc_info tells the model the format and its capabilities", () => {
		expect(runTool(ix, "doc_info")).toMatchObject({ format: "pdf", capabilities: { positions: true } });
	});
});

describe("model output handling", () => {
	it("validator accepts conforming output and names the first error", () => {
		expect(validate(S.TURN, { next: "read_lines", page: 1, from: 1, to: 40 })).toBeNull();
		expect(validate(S.TURN, { next: "rm -rf" })).toMatch(/must be one of/);
		expect(validate(S.TURN, { next: "search", extra: 1 })).toMatch(/not allowed/);
		expect(validate(S.CONTACT, {})).toMatch(/is required/);
		expect(validate(S.REVIEW, { findings: [{ type: "missing_email", title: "t", why: "w", fix: "f", evidence: [{ ref: "line 3", quote: "" }] }], strengths: [] })).toMatch(/must match/);
	});

	it("the review schema only admits AI types", () => {
		expect(validate(S.REVIEW, { findings: [{ type: "multi_column_layout", title: "t", why: "w", fix: "f", evidence: [] }], strengths: [] })).toMatch(/must be one of/);
	});

	it("repairs harmless model shape drift without inventing evidence", () => {
		const experience = repair(S.SECTIONS_EXPERIENCE, {
			sections: [],
			experience: [{ title: "Engineer", organisation: "Example", location: "", start: 2024, end: null, current: "true", refs: ["p1:1"], bullets: [] }],
		}) as { experience: { start: string; end: string; current: boolean }[] };
		expect(experience.experience[0]).toMatchObject({ start: "2024", end: "", current: true });
		expect(validate(S.SECTIONS_EXPERIENCE, experience)).toBeNull();
		const profile = repair(S.EDUCATION_SKILLS, { education: [], skills: [], languages: [], certifications: ["AWS"] }) as { certifications: unknown[] };
		expect(profile.certifications).toEqual([]);
	});

	it("repairs a list returned as null or as a single object", () => {
		const empty = { value: "", refs: [] };
		const base = { name: empty, headline: empty, email: empty, phone: empty, location: empty };
		const none = repair(S.CONTACT, { ...base, links: null });
		expect(validate(S.CONTACT, none)).toBeNull();
		expect((none as { links: unknown[] }).links).toEqual([]);
		const one = repair(S.CONTACT, { ...base, links: { kind: "linkedin", value: "linkedin.com/in/example", refs: ["p1:2"] } });
		expect(validate(S.CONTACT, one)).toBeNull();
		expect((one as { links: unknown[] }).links).toEqual([{ kind: "linkedin", value: "linkedin.com/in/example", refs: ["p1:2"] }]);
		// A bare string can't be turned into a link without guessing its kind.
		expect(validate(S.CONTACT, repair(S.CONTACT, { ...base, links: "linkedin.com/in/example" }))).toMatch(/expected an array/);
	});

	it("salvages complete findings from a truncated review", () => {
		const raw = '{"findings":[{"type":"duty_style_bullets","title":"a","why":"b","fix":"c","evidence":[]},{"type":"first_pe';
		expect(parseModelJSON(raw, "review")).toMatchObject({ findings: [{ type: "duty_style_bullets" }] });
		expect(() => parseModelJSON(raw, "extract_contact")).toThrow();
	});
});

describe("analyseCv", () => {
	it("runs every task, logs tool calls, verifies values and evidence, merges measured findings", async () => {
		const measured = await measuredExample();
		const { engine, prompts } = fakeEngine(goodScript());
		const steps: string[] = [];
		const report = await analyseCv({ measured, engine, lang: "en", onProgress: (e) => steps.push(`${e.step}:${e.status}`) });

		expect(steps.filter((s) => s.endsWith(":done"))).toEqual(["extract_contact:done", "extract_sections_experience:done", "extract_education_skills:done", "review:done"]);
		expect(report.log.some((l) => l.task === "extract_contact" && l.tool === "read_lines")).toBe(true);
		expect(report.log.some((l) => l.task === "setup" && l.tool === "layout_facts")).toBe(true);
		expect(report.profile!.email!.verified).toBe(true);
		expect(report.profile!.phone!.verified).toBe(true);
		expect(report.profile!.sections[1]!.verified).toBe(false);
		expect(report.findings.map((f) => f.type).sort()).toEqual(["duty_style_bullets", "first_person"]);
		expect(report.findings.find((f) => f.type === "first_person")!.provenance).toBe("ai-unverified");
		expect(report.findings.find((f) => f.type === "duty_style_bullets")!.provenance).toBe("ai-verified");
		expect(report.verdict).toBe("ready");
		expect(report.overall).toBeGreaterThan(80);
		expect(report.engine).toEqual({ id: "fake", model: "Scripted fake" });
		expect(report.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
		// Tool turns are schema-constrained; final answers are validated locally.
		expect(prompts.filter((p) => !p.final).every((p) => p.schema)).toBe(true);
	});

	it("tells the review which findings were measured, and keeps the measured one if it repeats it", async () => {
		const measured = measureLayout(await readPdf(fixture("two-column")), "en");
		const script = goodScript();
		script.review = [{ next: "answer" }, { next: "answer" }, { findings: [], strengths: [] }];
		const { engine, prompts } = fakeEngine(script);
		const report = await analyseCv({ measured, engine, lang: "en" });
		expect(prompts.find((p) => p.text.includes("TASK: review"))!.text).toContain('"multi_column_layout"');
		expect(report.findings.find((f) => f.type === "multi_column_layout")!.provenance).toBe("measured");
		expect(report.verdict).toBe("not-ready");
		expect(report.fixFirst[0]!.type).toBe("multi_column_layout");
	});

	it("retries once on invalid JSON, then records the task as failed and refuses to score", async () => {
		const script = goodScript();
		script.extract_education_skills = ["not json", '{"still": "wrong"}'];
		const { engine } = fakeEngine(script);
		const report = await analyseCv({ measured: await measuredExample(), engine, lang: "en" });
		expect(report.failed.map((f) => f.task)).toEqual(["extract_education_skills"]);
		expect(report.log.some((l) => l.kind === "retry" && l.task === "extract_education_skills")).toBe(true);
		expect(report.log.some((l) => l.kind === "failure")).toBe(true);
		expect(report.profile!.email!.value).toBe("jane.doe@example.com");
		expect(report.verdict).toBe("incomplete");
		expect(report.overall).toBeNull();
	});

	it("enforces the tool-call limit", async () => {
		const script = goodScript();
		const final = (script.extract_contact as unknown[])[2];
		script.extract_contact = [...Array(4).fill({ next: "search", query: "@" }), final];
		const { engine } = fakeEngine(script);
		const report = await analyseCv({ measured: await measuredExample(), engine, lang: "en" });
		expect(report.log.filter((l) => l.task === "extract_contact" && l.kind === "tool")).toHaveLength(4);
		expect(report.profile!.name!.value).toBe("Jane Doe");
	});

	it("an unreadable PDF never reaches the model", async () => {
		const { engine, prompts } = fakeEngine({});
		const report = await analyseCv({ measured: measureLayout(await readPdf(fixture("scanned")), "en"), engine, lang: "en" });
		expect(report.verdict).toBe("unreadable");
		expect(prompts).toHaveLength(0);
	});

	it("without an engine: measured findings only, no score, no profile", async () => {
		const report = await analyseCv({ measured: measureLayout(await readPdf(fixture("two-column")), "en"), engine: null, lang: "en" });
		expect(report.verdict).toBe("measured-only");
		expect(report.overall).toBeNull();
		expect(report.profile).toBeNull();
		expect(report.findings.every((f) => f.provenance === "measured")).toBe(true);
	});

	it("cancels cleanly", async () => {
		const controller = new AbortController();
		const { engine } = fakeEngine(goodScript(), { delay: 5 });
		const run = analyseCv({ measured: await measuredExample(), engine, lang: "en", signal: controller.signal });
		controller.abort();
		await expect(run).rejects.toMatchObject({ name: "AbortError" });
	});
});
