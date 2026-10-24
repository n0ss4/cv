// US7 / SC-007: a second format through the same pipeline, untouched.
import { describe, expect, it } from "vitest";
import { FormatRegistry } from "@app/formats/registry";
import { analyseCv } from "@app/usecases/analyseCv";
import { measureLayout } from "@app/usecases/measureLayout";
import { readDocument } from "@app/usecases/readDocument";
import { fakeEngine } from "../fakes/fakeEngine";
import { SAMPLE_TXT, TextReader } from "../fakes/TextReader";
import { nodePdfReader } from "../support";

const txtFile = (text = SAMPLE_TXT) => new File([text], "cv.txt", { type: "text/plain" });

describe("format registry", () => {
	const registry = new FormatRegistry().register(nodePdfReader()).register(new TextReader());

	it("derives the accept list, labels and limit from the readers", () => {
		expect(registry.acceptAttribute()).toBe(".pdf,application/pdf,.txt,text/plain");
		expect(registry.labels()).toEqual(["PDF", "Plain text"]);
		expect(registry.maxBytes()).toBe(10 * 1024 * 1024);
	});

	it("matches by extension or MIME type, confirmed by sniffing", () => {
		const head = new TextEncoder().encode("%PDF-1.7");
		expect(registry.match({ name: "a.PDF", type: "", head })?.format).toBe("pdf");
		expect(registry.match({ name: "a.pdf", type: "", head: new TextEncoder().encode("PK") })).toBeNull();
		expect(registry.match({ name: "cv", type: "text/plain", head: new TextEncoder().encode("hi") })?.format).toBe("txt");
		expect(registry.match({ name: "cv.docx", type: "", head })).toBeNull();
	});

	it("refuses to register a format twice", () => {
		expect(() => new FormatRegistry().register(new TextReader()).register(new TextReader())).toThrow();
	});

	it("analyses a .txt CV end to end with the unchanged pipeline", async () => {
		const { doc } = await readDocument(registry, txtFile());
		const measured = measureLayout(doc, "en");
		// Facts a text file cannot provide are not applicable, and their rules don't fire.
		expect(measured.facts.side_by_side_blocks.applicable).toBe(false);
		expect(measured.facts.header_zone.applicable).toBe(false);
		expect(measured.findings.map((f) => f.type)).toEqual(["ambiguous_date_format"]);
		const { engine } = fakeEngine({
			extract_contact: [{ next: "read_lines", page: 1, from: 1, to: 5 }, { next: "answer" }, { name: { value: "Taylor Example", refs: ["p1:1"] }, headline: { value: "", refs: [] }, email: { value: "taylor.example@example.com", refs: ["p1:2"] }, phone: { value: "+1 555 0177", refs: ["p1:2"] }, location: { value: "", refs: [] }, links: [] }],
			extract_sections_experience: [{ next: "outline" }, { next: "read_lines", page: 1, from: 1, to: 20 }, { next: "answer" }, { sections: [], experience: [] }],
			extract_education_skills: [{ next: "outline" }, { next: "read_lines", page: 1, from: 1, to: 20 }, { next: "answer" }, { education: [], skills: [], languages: [], certifications: [] }],
			review: [{ next: "layout_facts" }, { next: "answer" }, { findings: [], strengths: [] }],
		});
		const report = await analyseCv({ measured, engine, lang: "en" });
		expect(report.document.format).toBe("txt");
		expect(report.profile!.email!.verified).toBe(true);
		expect(report.verdict).toBe("ready");
		// The model was told, in words, which facts don't apply.
		const facts = report.log.find((l) => l.tool === "layout_facts" && l.task === "review")!.result as Record<string, unknown>;
		expect(facts.side_by_side_blocks).toBe("not applicable for txt");
	});

	it("rejects empty and oversized files before reading", async () => {
		await expect(readDocument(registry, new File([], "cv.txt", { type: "text/plain" }))).rejects.toMatchObject({ code: "empty" });
		const big = { name: "cv.pdf", type: "application/pdf", size: 11 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) };
		await expect(readDocument(registry, big)).rejects.toMatchObject({ code: "too-large" });
	});
});
