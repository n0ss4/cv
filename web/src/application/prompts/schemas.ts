// JSON Schemas for every model turn (contracts/schemas.md).
//
// Kept to the plain subset that constrains reliably on a small model: type,
// properties, required, items, enum, maxItems, maxLength, additionalProperties.
// No null and no unions: an absent value is the empty string "", which the
// orchestrator turns into null. Every value travels with the line references it
// was copied from (`p<page>:<line>`), so it can be verified.

import { AI_REVIEW_TYPES } from "@domain/findings/catalogue";
import { TOOL_NAMES } from "../tools/tools";

export interface Schema {
	type: "object" | "array" | "string" | "integer" | "boolean";
	properties?: Record<string, Schema>;
	required?: string[];
	additionalProperties?: boolean;
	items?: Schema;
	maxItems?: number;
	maxLength?: number;
	pattern?: string;
	enum?: readonly string[];
	minimum?: number;
	maximum?: number;
}

const REF: Schema = { type: "string", pattern: "^p[0-9]{1,2}:[0-9]{1,3}$" };
const REFS: Schema = { type: "array", items: REF, maxItems: 4 };
const str = (max = 120): Schema => ({ type: "string", maxLength: max });
const obj = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({
	type: "object", properties, required, additionalProperties: false,
});
const field = (max = 120) => obj({ value: str(max), refs: REFS });
const list = (items: Schema, max: number): Schema => ({ type: "array", items, maxItems: max });
const oneOf = (values: readonly string[]): Schema => ({ type: "string", enum: values });

/** One turn of the tool loop (contracts/tools.md). */
export const TURN = obj(
	{
		next: oneOf([...TOOL_NAMES, "answer"]),
		page: { type: "integer", minimum: 1, maximum: 50 },
		from: { type: "integer", minimum: 1, maximum: 999 },
		to: { type: "integer", minimum: 1, maximum: 999 },
		query: str(60),
	},
	["next"],
);

export const CONTACT = obj({
	name: field(80),
	headline: field(120),
	email: field(120),
	phone: field(40),
	location: field(80),
	links: list(obj({ kind: oneOf(["linkedin", "github", "portfolio", "other"]), value: str(160), refs: REFS }), 5),
});

const SECTION_KINDS = ["summary", "experience", "education", "skills", "languages", "projects", "certifications", "awards", "other"] as const;

export const SECTIONS_EXPERIENCE = obj({
	sections: list(obj({ heading: str(60), kind: oneOf(SECTION_KINDS), ref: REF }), 14),
	experience: list(
		obj({
			title: str(100),
			organisation: str(100),
			location: str(80),
			start: str(30),
			end: str(30),
			current: { type: "boolean" },
			refs: REFS,
			bullets: list(obj({ text: str(140), ref: REF }), 8),
		}),
		10,
	),
});

export const EDUCATION_SKILLS = obj({
	education: list(obj({ qualification: str(140), institution: str(100), start: str(30), end: str(30), refs: REFS }), 6),
	skills: list(obj({ value: str(60), ref: REF }), 40),
	languages: list(obj({ language: str(40), level: str(60), ref: REF }), 8),
	certifications: list(obj({ value: str(120), ref: REF }), 8),
});

const EVIDENCE = list(obj({ ref: REF, quote: str(60) }), 2);

export const REVIEW = obj({
	findings: list(
		obj({ type: oneOf(AI_REVIEW_TYPES), title: str(55), why: str(140), fix: str(140), evidence: EVIDENCE }),
		3,
	),
	strengths: list(str(70), 1),
});

const KNOCKOUTS = ["none", "years", "degree", "language", "certification", "location", "authorisation"] as const;
const REQ_KINDS = ["skill", "experience", "education", "language", "certification", "location", "authorisation", "other"] as const;

export const JOB = obj({
	title: str(100),
	requirements: list(
		obj({
			text: str(100),
			kind: oneOf(REQ_KINDS),
			importance: oneOf(["required", "preferred"]),
			knockout: oneOf(KNOCKOUTS),
			years: { type: "integer", minimum: 0, maximum: 40 },
			level: str(30),
		}),
		15,
	),
});

// source_ref may be "" (no line supports a phrasing) or a line reference.
const OPTIONAL_REF: Schema = { type: "string", pattern: "^(p[0-9]{1,2}:[0-9]{1,3})?$" };

export const MATCH = obj({
	title_in_cv: { type: "boolean" },
	matches: list(
		obj({
			requirement: str(100),
			status: oneOf(["matched", "partial", "missing"]),
			evidence: EVIDENCE,
			target: oneOf(["skills", "experience", "summary", "headline", "none"]),
			phrasing: str(200),
			source_ref: OPTIONAL_REF,
		}),
		15,
	),
});

/** One answer of the chat (specs 005 and 006, contracts/chat.md). */
export const ASK = obj(
	{
		answer: str(600),
		out_of_scope: { type: "boolean" },
		// 006: optional, so a model that leaves them out isn't sent back to retry.
		needs_posting: { type: "boolean" },
		cards: list(oneOf(["fit", "knockouts", "keywords", "gaps"]), 2),
		citations: list(obj({ ref: REF, quote: str(80) }), 4),
		rewrites: list(obj({ source_ref: REF, text: str(300) }), 2),
	},
	["answer", "out_of_scope", "citations", "rewrites"],
);

/** The top-level shape, pasted into the answer prompt so the model sees it without the full schema. */
export const RESULT_SHAPES = {
	extract_contact: '{"name":{"value":"","refs":[]},"headline":{"value":"","refs":[]},"email":{"value":"","refs":[]},"phone":{"value":"","refs":[]},"location":{"value":"","refs":[]},"links":[]}',
	extract_sections_experience: '{"sections":[],"experience":[]}',
	extract_education_skills: '{"education":[],"skills":[],"languages":[],"certifications":[]}',
	review: '{"findings":[],"strengths":[]}',
	extract_job: '{"title":"","requirements":[]}',
	match_job: '{"title_in_cv":false,"matches":[]}',
	ask: '{"answer":"","out_of_scope":false,"needs_posting":false,"cards":[],"citations":[],"rewrites":[]}',
} as const;
