// The posting in the chat's context (spec 006): compact form, allowed terms, cards.
import { describe, expect, it } from "vitest";
import { cardsFor, compactJob, jobEvent, postingMissing, postingTermsInCv } from "@domain/chat/context";
import { chatMessage, memoryOf } from "@domain/chat/model";
import { JOB } from "../fakes/job";

describe("chat context", () => {
	it("compacts the match for the prompt", () => {
		const c = compactJob(JOB);
		expect(c.match).toMatchObject({ percent: 67, required_covered: "1/1" });
		expect(c.keywords[1]).toEqual({ term: "Kubernetes", status: "variant", cv_says: "K8s" });
		expect(c.hard_filters).toEqual([{ requirement: "Fluent English", outcome: "not-stated" }]);
		expect(JSON.stringify(compactJob({ ...JOB, requirements: Array(40).fill(JOB.requirements[0]) })).length).toBeLessThan(2500);
	});

	it("allows posting terms the CV has, and names the ones it lacks", () => {
		const allowed = postingTermsInCv(JOB);
		expect(allowed).toContain("Kubernetes");
		expect(allowed).toContain("K8s");
		expect(allowed).not.toContain("Terraform");
		expect(postingMissing(["Terraform", "AWS"], JOB)).toEqual(["Terraform"]);
		expect(postingTermsInCv(undefined)).toBe("");
	});

	it("keeps only cards with data, at most two, without duplicates", () => {
		expect(cardsFor(["fit", "fit", "keywords", "gaps"], JOB).map((c) => c.kind)).toEqual(["fit", "keywords"]);
		expect(cardsFor(["fit"], { ...JOB, summary: null })).toEqual([]);
		expect(cardsFor(["poem", "knockouts"], JOB).map((c) => c.kind)).toEqual(["knockouts"]);
		expect(cardsFor(["fit"], undefined)).toEqual([]);
	});

	it("summarises a comparison for the page message", () => {
		expect(jobEvent(JOB, 52)).toMatchObject({ kind: "job", percent: 67, before: 52, fails: 0, notStated: 1, missingKeywords: 1 });
	});

	it("doesn't send page messages to the model as memory", () => {
		const msgs = [
			chatMessage({ id: "1", role: "user", text: "q" }),
			chatMessage({ id: "p", role: "page", event: { kind: "jobFailed" } }),
			chatMessage({ id: "2", role: "assistant", text: "a" }),
		];
		expect(memoryOf(msgs)).toEqual([{ question: "q", answer: "a" }]);
	});
});
