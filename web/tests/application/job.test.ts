// compareJob end to end with the scripted engine and the real reader (spec 004).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseCv } from "@app/usecases/analyseCv";
import { compareJob, measureJob } from "@app/usecases/compareJob";
import { measureLayout } from "@app/usecases/measureLayout";
import { fakeEngine, type Script } from "../fakes/fakeEngine";
import { EXAMPLE, readPdf } from "../support";
import { goodScript } from "../ui/scripts";

const POSTING = readFileSync(`${process.cwd()}/tests/fixtures/postings/backend.txt`, "utf8");
const today = new Date(2026, 9, 17);

const jobScript = (): Script => ({
	...goodScript(),
	extract_contact: [{ next: "read_lines", page: 1, from: 1, to: 20 }, { next: "answer" }, {
		name: { value: "Jane Doe", refs: ["p1:1"] }, headline: { value: "", refs: [] },
		email: { value: "jane.doe@example.com", refs: ["p1:3"] }, phone: { value: "+1 555 0100", refs: ["p1:3"] },
		location: { value: "", refs: [] }, links: [],
	}],
	extract_job: [{
		title: "Senior Backend Engineer",
		requirements: [
			{ text: "5+ years of professional backend development", kind: "experience", importance: "required", knockout: "years", years: 5, level: "" },
			{ text: "Kubernetes", kind: "skill", importance: "required", knockout: "none", years: 0, level: "" },
			{ text: "PostgreSQL", kind: "skill", importance: "required", knockout: "none", years: 0, level: "" },
			{ text: "English C1", kind: "language", importance: "required", knockout: "language", years: 0, level: "C1" },
			{ text: "Terraform", kind: "skill", importance: "preferred", knockout: "none", years: 0, level: "" },
			{ text: "gRPC", kind: "skill", importance: "preferred", knockout: "none", years: 0, level: "" },
		],
	}],
	match_job: [
		{ next: "search", query: "kubernetes" },
		{ next: "answer" },
		{ title_in_cv: false, matches: [
			{ requirement: "5+ years of professional backend development", status: "partial", evidence: [], target: "none", phrasing: "", source_ref: "" },
			{ requirement: "Kubernetes", status: "missing", evidence: [], target: "skills", phrasing: "Kubernetes, Docker and 12 microservices at Acme", source_ref: "p1:1" },
			{ requirement: "PostgreSQL", status: "matched", evidence: [{ ref: "p1:1", quote: "Jane Doe" }], target: "none", phrasing: "", source_ref: "" },
			{ requirement: "English C1", status: "missing", evidence: [], target: "skills", phrasing: "", source_ref: "" },
			{ requirement: "Terraform", status: "missing", evidence: [], target: "skills", phrasing: "", source_ref: "" },
			{ requirement: "gRPC", status: "partial", evidence: [], target: "experience", phrasing: "Jane Doe gRPC", source_ref: "p1:1" },
		] },
	],
});

describe("compareJob", async () => {
	const measured = measureLayout(await readPdf(EXAMPLE), "en");

	it("without an engine: only the measured keyword check, no summary, no score change", async () => {
		const report = await analyseCv({ measured, engine: null, lang: "en" });
		const out = await compareJob({ measured, report, engine: null, jobText: POSTING, lang: "en" });
		expect(out.job!.aiRan).toBe(false);
		expect(out.job!.summary).toBeNull();
		expect(out.job!.keywords.length).toBeGreaterThan(5);
		expect(out.job!.keywords.every((k) => k.provenance === "measured")).toBe(true);
		expect(measureJob(POSTING, measured).keywords).toEqual(out.job!.keywords);
	});

	it("with an engine: requirements, knock-outs, guarded suggestions, summary and findings", async () => {
		const { engine } = fakeEngine(jobScript());
		const report = await analyseCv({ measured, engine, lang: "en" });
		const out = await compareJob({ measured, report, engine, jobText: POSTING, lang: "en", today });
		const job = out.job!;
		expect(job.aiRan).toBe(true);
		expect(job.title).toBe("Senior Backend Engineer");
		expect(job.requirements).toHaveLength(6);

		// The phrasing adding "12" and "Acme" is withheld; the other one only adds the requirement.
		const k8s = job.requirements.find((r) => r.requirement.text === "Kubernetes")!.suggestion!;
		expect(k8s.phrasing).toBeNull();
		expect(k8s.rejected).toEqual(expect.arrayContaining(["12", "Acme"]));
		const grpc = job.requirements.find((r) => r.requirement.text === "gRPC")!.suggestion!;
		expect(grpc).toMatchObject({ phrasing: "Jane Doe gRPC", sourceRef: "p1:1", provenance: "ai-verified" });

		// Knock-outs are measured from the profile.
		expect(job.knockouts.map((k) => k.kind).sort()).toEqual(["language", "years"]);

		// Summary: required 4 (years partial, k8s missing, pg matched, english missing) → 1.5; preferred 2 → 0.5.
		expect(job.summary).toMatchObject({ required: { covered: 1.5, total: 4 }, preferred: { covered: 0.5, total: 2 }, verdict: "gaps" });
		expect(job.summary!.percent).toBe(Math.round((100 * (1.5 * 2 + 0.5)) / 10));
		expect(out.categories.keywords).toBe(job.summary!.percent);
		expect(out.findings.some((f) => f.type === "missing_requirement" && f.title.endsWith("Kubernetes"))).toBe(true);
		expect(out.findings.some((f) => f.type === "title_mismatch")).toBe(true);
	});
});
