// The measured half of the job match (spec 004): equivalences, exact keywords,
// years, CEFR, knock-outs, the phrasing guard, trimming and the summary.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexDocument } from "@domain/document/lineIndex";
import type { Document } from "@domain/document/types";
import { parseLevel } from "@domain/job/cefr";
import { EQUIVALENCES } from "@domain/job/equivalences";
import { checkKeywords } from "@domain/job/keywords";
import { evaluateKnockouts } from "@domain/job/knockouts";
import type { Requirement, RequirementMatch } from "@domain/job/model";
import { guardPhrasing } from "@domain/job/phrasing";
import { POSTING_LIMIT, trimPosting } from "@domain/job/posting";
import { summarise } from "@domain/job/summary";
import { hasForm, postingTerms } from "@domain/job/terms";
import { computeYears, parseDate } from "@domain/job/years";
import { emptyProfile, type ExperienceEntry } from "@domain/profile/types";

const POSTINGS = `${process.cwd()}/tests/fixtures/postings/`;
const posting = (name: string) => readFileSync(`${POSTINGS}${name}`, "utf8");
const indexText = (text: string) => {
	const doc: Document = { format: "txt", fileName: "cv.txt", fileSize: text.length, capabilities: { positions: false, pages: false, graphics: false, structure: false }, pages: [{ number: 1, lines: text.split("\n") }] };
	return indexDocument(doc);
};
const req = (text: string, extra: Partial<Requirement> = {}): Requirement => ({ text, kind: "skill", importance: "required", knockout: null, years: null, level: null, ...extra });
const role = (start: string | null, end: string | null, current = false, ref = "p1:1"): ExperienceEntry => ({ title: "Engineer", organisation: "Example", location: null, start, end, current, refs: [ref], bullets: [] });

describe("equivalences and term search", () => {
	it("has about 150 reviewed groups with unique ids", () => {
		expect(EQUIVALENCES.length).toBeGreaterThanOrEqual(150);
		expect(new Set(EQUIVALENCES.map((g) => g.id)).size).toBe(EQUIVALENCES.length);
	});

	it("is word-bounded and keeps C++, C#, .NET, Node.js intact", () => {
		expect(hasForm("Java and Spring", "JavaScript")).toBe(false);
		expect(hasForm("We use JavaScript.", "Java")).toBe(false);
		expect(hasForm("C++, C# and .NET", "C++")).toBe(true);
		expect(hasForm("C++17", "C++")).toBe(false);
		expect(hasForm("C++17, C# and .NET", "C#")).toBe(true);
		expect(hasForm("C++17, C# and .NET", ".NET")).toBe(true);
		expect(hasForm("Node.js services", "Node.js")).toBe(true);
		expect(hasForm("CI/CD pipelines", "CI/CD")).toBe(true);
		expect(hasForm("Aprendizaje automático aplicado", "aprendizaje automático")).toBe(true);
	});

	it("matches ordinary-word terms only case-sensitively", () => {
		expect(postingTerms("We go beyond the brief.").some((t) => t.group.id === "go")).toBe(false);
		expect(postingTerms("Experience with Go and gRPC").some((t) => t.group.id === "go")).toBe(true);
		expect(postingTerms("R&D budget").some((t) => t.group.id === "r")).toBe(false);
	});
});

describe("exact keywords", () => {
	const cv = indexText("Taylor Example\nSkills: K8s, Postgres, Kafka, Go\nBuilt dashboards in Tableau");

	it("finds planted variants and exact terms, with the CV line (SC-001)", () => {
		const k = checkKeywords(posting("backend.txt"), cv);
		const by = (id: string) => k.find((x) => x.group === id)!;
		expect(by("kubernetes")).toMatchObject({ status: "variant", term: "Kubernetes", cvTerm: "K8s", ref: "p1:2", provenance: "measured" });
		expect(by("postgresql")).toMatchObject({ status: "variant", term: "PostgreSQL", cvTerm: "Postgres" });
		expect(by("kafka").status).toBe("exact");
		expect(by("terraform").status).toBe("missing");
		expect(k.every((x) => x.status !== "variant" || x.group !== null)).toBe(true);
	});

	it("leaves work arrangements to the hard filters", () => {
		const groups = checkKeywords(posting("backend.txt"), cv).map((k) => k.group);
		expect(groups).not.toContain("remote");
		expect(groups).not.toContain("work-permit");
	});

	it("lists missing and variant terms first", () => {
		const statuses = checkKeywords(posting("backend.txt"), cv).map((k) => k.status);
		expect(statuses.indexOf("exact")).toBeGreaterThan(statuses.lastIndexOf("variant"));
	});

	it("works across Spanish postings and English CVs only through listed equivalents", () => {
		const k = checkKeywords(posting("data-es.txt"), indexText("Machine learning models in Python\nEnglish (C1)"));
		expect(k.find((x) => x.group === "machine-learning")).toMatchObject({ status: "variant", term: "aprendizaje automático", cvTerm: "machine learning" });
		expect(k.find((x) => x.group === "lang-en")).toMatchObject({ status: "variant" });
	});

	it("checks short AI-extracted skills the list doesn't cover, literally", () => {
		const k = checkKeywords("We want Temporal workflows", indexText("Built workflows with Temporal"), [req("Temporal")]);
		expect(k.find((x) => x.term === "Temporal")).toMatchObject({ status: "exact", group: null, provenance: "ai-verified" });
	});
});

describe("years of experience (SC-002)", () => {
	const today = new Date(2026, 9, 17); // October 2026

	it("parses months in several languages, numeric forms and bare years", () => {
		expect(parseDate("Mar 2021", "start")).toBe(2021 * 12 + 2);
		expect(parseDate("marzo de 2021", "start")).toBe(2021 * 12 + 2);
		expect(parseDate("03/2021", "start")).toBe(2021 * 12 + 2);
		expect(parseDate("2021-03", "start")).toBe(2021 * 12 + 2);
		expect(parseDate("2021", "start")).toBe(2021 * 12);
		expect(parseDate("2021", "end")).toBe(2021 * 12 + 11);
		expect(parseDate("Actualidad", "end")).toBe("present");
		expect(parseDate("Jan '20", "start")).toBe(2020 * 12);
	});

	it("merges overlaps, counts present as today, and reports undated roles", () => {
		const c = computeYears([role("2016", "2020"), role("Jun 2020", "", true), role(null, null)], today);
		expect(c.ranges).toEqual([{ from: "2016-01", to: "2026-10", ref: "p1:1" }]);
		expect(c.years).toBe(10);
		expect(c.undated).toBe(1);
	});

	it("does not double-count parallel jobs", () => {
		expect(computeYears([role("2018", "2019"), role("2018", "2019")], today).years).toBe(2);
	});
});

describe("CEFR", () => {
	it("parses explicit levels and native wording; vague wording is unknown", () => {
		expect(parseLevel("English — C1")).toBe(4);
		expect(parseLevel("Inglés B2")).toBe(3);
		expect(parseLevel("native")).toBe(5);
		expect(parseLevel("bilingüe")).toBe(5);
		expect(parseLevel("fluent")).toBeNull();
	});
});

describe("knock-outs", () => {
	const today = new Date(2026, 9, 17);
	const cv = indexText("Taylor Example\nValencia, Spain\nEnglish C1, Spanish native\nBSc Computer Science, Example University, 2012 - 2016");
	const profile = {
		...emptyProfile(),
		location: { value: "Valencia, Spain", refs: ["p1:2"], verified: true },
		experience: [role("2016", "2020", false, "p1:1"), role("2021", "", true, "p1:1")],
		languages: [{ language: "English", level: "C1", ref: "p1:3", verified: true }],
		education: [{ qualification: "BSc Computer Science", institution: "Example University", start: "2012", end: "2016", refs: ["p1:4"], verified: true }],
	};

	it("evaluates each kind, and an unmentioned requirement is never 'fails'", () => {
		const results = evaluateKnockouts([
			req("5+ years of backend development", { kind: "experience", knockout: "years", years: 5 }),
			req("English C2", { kind: "language", knockout: "language", level: "C2" }),
			req("German B1", { kind: "language", knockout: "language", level: "B1" }),
			req("Bachelor's degree in Computer Science", { kind: "education", knockout: "degree" }),
			req("Eligible to work in the EU", { kind: "authorisation", knockout: "authorisation" }),
			req("Remote within the EU", { kind: "location", knockout: "location" }),
		], profile, cv, today);
		const by = (t: string) => results.find((r) => r.requirement.text.startsWith(t))!;
		expect(by("5+ years").outcome).toBe("meets");
		// 2016-01…2020-12 and 2021-01…2026-10 are adjacent: one merged range, 130 months.
		expect(by("5+ years").years!.years).toBe(10);
		expect(by("English C2")).toMatchObject({ outcome: "fails", detail: { key: "language", params: { have: "C1", need: "C2" } } });
		expect(by("German").outcome).toBe("not-stated");
		expect(by("Bachelor").outcome).toBe("meets");
		expect(by("Eligible").outcome).toBe("not-stated");
		expect(by("Remote")).toMatchObject({ outcome: "unknown", detail: { key: "locationCheck", params: { where: "Valencia, Spain" } } });
		expect(results[0]!.outcome).toBe("fails");
	});
});

describe("phrasing guard (SC-003)", () => {
	const line = "Built dashboards in Tableau for the sales team";
	it("accepts a rewording that only adds the requirement", () => {
		expect(guardPhrasing("Built data visualisation dashboards in Tableau for the sales team", line, "data visualisation").ok).toBe(true);
	});
	it("rejects added numbers, names and technologies", () => {
		expect(guardPhrasing("Built dashboards in Tableau, cutting reporting time by 40%", line, "data visualisation").added).toContain("40");
		expect(guardPhrasing("Built dashboards in Tableau for Acme Corp", line, "data visualisation").added).toContain("Acme");
		expect(guardPhrasing("Built dashboards in Tableau and Power BI", line, "data visualisation").added).toContain("Power BI");
	});
});

describe("posting trimming", () => {
	it("keeps short postings whole and cuts long ones at the requirements", () => {
		expect(trimPosting(posting("backend.txt")).trimmed).toBe(false);
		const long = trimPosting(posting("long.txt"));
		expect(long.trimmed).toBe(true);
		expect(long.text.length).toBeLessThanOrEqual(POSTING_LIMIT);
		expect(long.text.startsWith("Requirements")).toBe(true);
	});
});

describe("summary (research R7)", () => {
	const m = (status: RequirementMatch["status"], importance: Requirement["importance"]): RequirementMatch => ({ requirement: req(`${importance}-${status}-${Math.random()}`, { importance }), status, evidence: [], suggestion: null });
	it("weighs required twice, and the verdict follows missing required and knock-outs", () => {
		const s = summarise([m("matched", "required"), m("missing", "required"), m("partial", "required"), m("matched", "required"), m("matched", "preferred"), m("missing", "preferred")], []);
		expect(s.required).toEqual({ covered: 2.5, total: 4 });
		expect(s.preferred).toEqual({ covered: 1, total: 2 });
		expect(s.percent).toBe(Math.round((100 * (2.5 * 2 + 1)) / 10));
		expect(s.verdict).toBe("close");
		expect(summarise([m("matched", "required")], []).verdict).toBe("strong");
		expect(summarise([m("missing", "required"), m("missing", "required")], []).verdict).toBe("gaps");
	});
});
