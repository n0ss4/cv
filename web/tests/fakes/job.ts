// A small, fictional job match for the chat tests (spec 006). Refs point at
// the skills line of the text CV in tests/application/ask.test.ts.
import type { JobMatch } from "@domain/job/model";

const req = (text: string, importance: "required" | "preferred" = "required") => ({ text, kind: "skill" as const, importance, knockout: null, years: null, level: null });

export const JOB: JobMatch = {
	title: "Backend Engineer",
	titleInCv: true,
	trimmed: false,
	aiRan: true,
	keywords: [
		{ term: "Go", group: null, status: "exact", cvTerm: "Go", ref: "p1:12", line: "Go, Python, K8s", importance: "required", provenance: "measured" },
		{ term: "Kubernetes", group: "kubernetes", status: "variant", cvTerm: "K8s", ref: "p1:12", line: "Go, Python, K8s", importance: "required", provenance: "measured" },
		{ term: "Terraform", group: "terraform", status: "missing", cvTerm: null, ref: null, line: null, importance: "preferred", provenance: "measured" },
	],
	requirements: [
		{ requirement: req("3+ years with Go"), status: "matched", evidence: [], suggestion: null },
		{ requirement: req("Infrastructure as code with Terraform", "preferred"), status: "missing", evidence: [], suggestion: null },
	],
	knockouts: [{ requirement: { ...req("Fluent English"), kind: "language", knockout: "language" }, kind: "language", outcome: "not-stated", evidence: [], detail: { key: "notStated" } }],
	summary: { required: { covered: 1, total: 1 }, preferred: { covered: 0, total: 1 }, percent: 67, verdict: "close", missingRequired: [] },
};
