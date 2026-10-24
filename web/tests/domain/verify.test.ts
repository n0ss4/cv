import { describe, expect, it } from "vitest";
import { diffReports } from "@domain/rescan/diff";
import { contradictsProfile, provenanceOf, verifyEvidence, verifyValue } from "@domain/profile/verify";
import { emptyProfile } from "@domain/profile/types";
import type { Finding } from "@domain/findings/types";
import { EXAMPLE, indexPdf } from "../support";

describe("verification", async () => {
	const ix = await indexPdf(EXAMPLE);
	const emailLine = ix.lines.find((l) => l.text.includes("jane.doe@example.com"))!;

	it("finds values on their cited line (and the next), ignoring case and accents", () => {
		expect(verifyValue("JANE.DOE@example.com", [emailLine.ref], ix)).toBe(true);
		expect(verifyValue("jane.doe@example.com", ["p1:1"], ix)).toBe(emailLine.ref === "p1:1" || emailLine.ref === "p1:2");
		expect(verifyValue("not in the cv", [emailLine.ref], ix)).toBe(false);
		expect(verifyValue("x", ["p99:1"], ix)).toBe(false);
	});

	it("compares phone numbers by digits", () => {
		expect(verifyValue("+1 (555) 0100", [emailLine.ref], ix, { kind: "phone" })).toBe(true);
	});

	it("flags quotes that are not on the cited line", () => {
		const [ok, bad] = verifyEvidence([{ ref: emailLine.ref, quote: "jane.doe@example.com" }, { ref: emailLine.ref, quote: "invented" }], ix);
		expect(ok!.verified).toBe(true);
		expect(bad!.verified).toBe(false);
		expect(provenanceOf({ type: "duty_style_bullets", evidence: [bad!] })).toBe("ai-unverified");
		expect(provenanceOf({ type: "duty_style_bullets", evidence: [ok!, bad!] })).toBe("ai-verified");
	});

	it("drops absence findings the verified profile contradicts", () => {
		const p = emptyProfile();
		p.email = { value: "jane.doe@example.com", refs: [emailLine.ref], verified: true };
		expect(contradictsProfile("missing_email", p)).toBe(true);
		p.email.verified = false;
		expect(contradictsProfile("missing_email", p)).toBe(false);
	});
});

describe("rescan diff", () => {
	const f = (type: string, quote?: string): Finding => ({
		type, category: "content", severity: "minor", title: type, why: "", fix: "",
		evidence: quote ? [{ ref: "p1:1", quote, verified: true }] : [], provenance: "measured",
	});
	it("matches by type, and by quote for repeatable types", () => {
		const d = diffReports(
			{ verdict: "not-ready", overall: 41, fileName: "a.pdf", findings: [f("multi_column_layout"), f("spelling_or_grammar", "managment"), f("too_long")] },
			{ verdict: "needs-work", overall: 79, fileName: "b.pdf", findings: [f("spelling_or_grammar", "Managment "), f("spelling_or_grammar", "recieve"), f("too_long")] },
		);
		expect(d.resolved.map((x) => x.type)).toEqual(["multi_column_layout"]);
		expect(d.added.map((x) => x.evidence[0]?.quote)).toEqual(["recieve"]);
		expect(d.unchanged).toHaveLength(2);
		expect(d.previous.overall).toBe(41);
	});
});
