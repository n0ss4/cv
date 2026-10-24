import type { Script } from "../fakes/fakeEngine";

/** A model that reads a little, extracts Jane Doe and reports one verified minor finding. */
export const goodScript = (): Script => ({
	extract_contact: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "answer" },
		{
			name: { value: "Jane Doe", refs: ["p1:1"] },
			headline: { value: "", refs: [] },
			email: { value: "jane.doe@example.com", refs: ["p1:3"] },
			phone: { value: "+1 555 0100", refs: ["p1:3"] },
			location: { value: "", refs: [] },
			links: [],
		},
	],
	extract_sections_experience: [
		{ next: "outline" },
		{ next: "read_lines", page: 1, from: 1, to: 40 },
		{ next: "answer" },
		{ sections: [{ heading: "SUMMARY", kind: "summary", ref: "p1:5" }], experience: [] },
	],
	extract_education_skills: [
		{ next: "read_lines", page: 1, from: 1, to: 40 },
		{ next: "search", query: "skills" },
		{ next: "answer" },
		{ education: [], skills: [], languages: [], certifications: [] },
	],
	review: [
		{ next: "read_lines", page: 1, from: 1, to: 20 },
		{ next: "answer" },
		{ findings: [{ type: "duty_style_bullets", title: "Bullets describe duties", why: "w", fix: "f", evidence: [{ ref: "p1:1", quote: "Jane Doe" }] }], strengths: ["Clear structure"] },
	],
});

/** goodScript plus a posting comparison (specs 004, 006). */
export const jobScript = (): Script => ({
	...goodScript(),
	extract_sections_experience: [{ next: "outline" }, { next: "read_lines", page: 1, from: 1, to: 40 }, { next: "answer" }, {
		sections: [{ heading: "SUMMARY", kind: "summary", ref: "p1:5" }],
		experience: [
			{ title: "Data Engineer", organisation: "Example", location: "", start: "2016", end: "2019", current: false, refs: ["p1:1"], bullets: [] },
			{ title: "Senior Data Engineer", organisation: "Example", location: "", start: "Mar 2019", end: "Present", current: true, refs: ["p1:1"], bullets: [] },
		],
	}],
	extract_job: [{
		title: "Senior Backend Engineer",
		requirements: [
			{ text: "5+ years of professional backend development", kind: "experience", importance: "required", knockout: "years", years: 5, level: "" },
			{ text: "Kubernetes", kind: "skill", importance: "required", knockout: "none", years: 0, level: "" },
			{ text: "English C1", kind: "language", importance: "required", knockout: "language", years: 0, level: "C1" },
			{ text: "Terraform", kind: "skill", importance: "preferred", knockout: "none", years: 0, level: "" },
		],
	}],
	match_job: [{ next: "answer" }, { next: "answer" }, { title_in_cv: false, matches: [
		{ requirement: "5+ years of professional backend development", status: "matched", evidence: [], target: "none", phrasing: "", source_ref: "" },
		{ requirement: "Kubernetes", status: "missing", evidence: [], target: "skills", phrasing: "Jane Doe Kubernetes", source_ref: "p1:1" },
		{ requirement: "English C1", status: "partial", evidence: [], target: "skills", phrasing: "", source_ref: "" },
		{ requirement: "Terraform", status: "missing", evidence: [], target: "skills", phrasing: "Terraform at Acme for 3 years", source_ref: "p1:1" },
	] }],
});
