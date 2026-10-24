import { describe, expect, it } from "vitest";
import { CATALOGUE_ENTRIES } from "@domain/findings/catalogue";
import type { Finding } from "@domain/findings/types";
import { capFor, categoryScore, fixFirst, scoreFindings, verdictFor, WEIGHTS } from "@domain/scoring/score";

const f = (type: string, category: Finding["category"], severity: Finding["severity"], extra: Partial<Finding> = {}): Finding => ({
	type, category, severity, title: type, why: "", fix: "", evidence: [], provenance: "measured", ...extra,
});

describe("scoring (contracts/findings.md)", () => {
	it("category scores and weighted overall", () => {
		expect(categoryScore([f("a", "parsing", "critical"), f("b", "parsing", "minor")])).toBe(48);
		expect(categoryScore(Array(4).fill(f("a", "parsing", "critical")))).toBe(0);
		const { categories, overall } = scoreFindings([f("x", "parsing", "major")]);
		expect(categories.parsing).toBe(80);
		expect(overall).toBe(Math.round((80 * 30 + 100 * 70) / 100));
		expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
	});

	it("verdict follows the worst severity, and the score never contradicts it", () => {
		expect(verdictFor([f("a", "content", "minor")])).toBe("ready");
		expect(verdictFor([f("a", "content", "major")])).toBe("needs-work");
		expect(verdictFor([f("a", "content", "critical")])).toBe("not-ready");
		expect(capFor("needs-work", 92)).toBe(79);
		expect(capFor("not-ready", 92)).toBe(59);
		expect(capFor("ready", 92)).toBe(92);
	});

	it("the design's example adds up: one major parsing issue and three minors → 79", () => {
		const findings = [f("contact_in_header_footer", "parsing", "major"), f("d", "content", "minor"), f("s", "language", "minor"), f("a", "dates", "minor")];
		const { overall } = scoreFindings(findings);
		expect(capFor(verdictFor(findings), overall)).toBe(79);
	});

	it("keywords count only when a posting was compared", () => {
		const { categories } = scoreFindings([], { percent: 50 });
		expect(categories.keywords).toBe(50);
		expect(scoreFindings([]).categories.keywords).toBeUndefined();
	});

	it("fix-first: severity, category weight, provenance, position; at most five", () => {
		const list = [
			f("minor-parsing", "parsing", "minor"),
			f("major-content", "content", "major", { provenance: "ai-verified" }),
			f("major-parsing", "parsing", "major"),
			f("critical-contact", "contact", "critical", { provenance: "ai-verified" }),
			f("major-parsing-unverified", "parsing", "major", { provenance: "ai-unverified" }),
			f("major-parsing-late", "parsing", "major", { evidence: [{ ref: "p2:3", verified: true }] }),
			f("minor-length", "length", "minor"),
		];
		// critical first; then majors by category weight (parsing 30 > content 20);
		// within parsing, measured before unverified; within measured, located
		// evidence (p2:3) before none.
		expect(fixFirst(list).map((x) => x.type)).toEqual([
			"critical-contact", "major-parsing-late", "major-parsing", "major-parsing-unverified", "major-content",
		]);
	});

	it("every catalogue entry is complete in both languages", () => {
		for (const c of CATALOGUE_ENTRIES) {
			for (const lang of ["en", "es"] as const) {
				expect(c.title[lang], `${c.type} title.${lang}`).toBeTruthy();
				expect(c.why[lang], `${c.type} why.${lang}`).toBeTruthy();
				expect(c.fix[lang], `${c.type} fix.${lang}`).toBeTruthy();
			}
			expect(c.definition).toBeTruthy();
		}
	});
});
