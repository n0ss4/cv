// Measured findings: layout facts mapped to catalogue entries by fixed rules
// (contracts/findings.md#measured, research R3).
//
// These rules do not judge content -- that stays with the model. They turn an
// observation the page already made ("14 of 40 lines hold two side-by-side
// blocks") into the finding a user can act on, deterministically, so the same
// file always gets the same parsing verdict and browsers without on-device AI
// still get it. Every threshold is named here so it can be reviewed.

import { docInfo as computeDocInfo, type DocInfo, type LineIndex, type LineRef } from "../document/lineIndex";
import { entry } from "../findings/catalogue";
import type { Evidence, Finding, Lang, Severity } from "../findings/types";
import { EMAIL, PHONE, type LayoutFacts } from "./facts";

export const RULES = {
	columnsMinLines: 5,
	columnsMinShare: 0.15,
	graphicsMinPaths: 40,
	graphicsMaxChars: 200,
	unreadableCriticalRatio: 0.02,
	bulletsMinLines: 2,
	shapesMinRows: 2,
	maxPages: 2,
} as const;

const QUOTE = 80;

function evidence(index: LineIndex, refs: (LineRef | null | undefined)[], max = 3): Evidence[] {
	const out: Evidence[] = [];
	for (const ref of refs) {
		if (!ref || out.some((e) => e.ref === ref)) continue;
		const line = index.byRef.get(ref);
		if (line) out.push({ ref, quote: line.text.slice(0, QUOTE), verified: true });
		if (out.length >= max) break;
	}
	return out;
}

function finding(type: string, lang: Lang, ev: Evidence[], severity?: Severity): Finding {
	const c = entry(type);
	return {
		type,
		category: c.category,
		severity: severity ?? c.severity,
		title: c.title[lang],
		why: c.why[lang],
		fix: c.fix[lang],
		evidence: ev,
		provenance: "measured",
	};
}

function contactOnlyInZones(index: LineIndex, facts: LayoutFacts): LineRef[] {
	if (!facts.header_zone.applicable) return [];
	const zone = [...facts.header_zone.value, ...facts.footer_zone.value];
	const zoneRefs = new Set(zone.map((z) => z.ref).filter(Boolean));
	const hits: LineRef[] = [];
	for (const z of zone) {
		for (const re of [EMAIL, PHONE]) {
			const value = re.exec(z.text)?.[0];
			if (!value) continue;
			const elsewhere = index.lines.some((l) => !zoneRefs.has(l.ref) && l.text.includes(value));
			if (!elsewhere && z.ref) hits.push(z.ref);
		}
	}
	return hits;
}

export function measuredFindings(index: LineIndex, facts: LayoutFacts, lang: Lang, info: DocInfo = computeDocInfo(index)): Finding[] {
	if (info.text_layer === "none") return [finding("no_text_layer", lang, [])];

	const out: Finding[] = [];

	if (facts.graphics_pages.applicable) {
		const drawn = facts.graphics_pages.value.filter((p) => (p.images >= 1 || p.paths >= RULES.graphicsMinPaths) && p.chars < RULES.graphicsMaxChars);
		if (drawn.length) {
			const all = drawn.length === info.pages;
			const refs = drawn.map((p) => index.pages.find((x) => x.number === p.page)?.lines[0]?.ref);
			out.push(finding("text_as_graphics", lang, evidence(index, refs), all ? "critical" : "major"));
		}
	}

	const sbs = facts.side_by_side_blocks;
	if (sbs.applicable && sbs.value.lines >= RULES.columnsMinLines && sbs.value.lines >= RULES.columnsMinShare * sbs.value.of_total_lines) {
		out.push(finding("multi_column_layout", lang, evidence(index, sbs.value.example_refs)));
	}

	if (facts.table_grid.applicable && facts.table_grid.value.length) {
		out.push(finding("table_layout", lang, evidence(index, facts.table_grid.value.map((t) => t.first_ref))));
	}

	const zoneHits = contactOnlyInZones(index, facts);
	if (zoneHits.length) out.push(finding("contact_in_header_footer", lang, evidence(index, zoneHits)));

	const unusual = facts.unusual_characters.value;
	if (unusual.count >= 1) {
		const refs = index.lines.filter((l) => unusual.examples.some((c) => l.text.includes(c))).map((l) => l.ref);
		out.push(finding("unreadable_characters", lang, evidence(index, refs), unusual.ratio > RULES.unreadableCriticalRatio ? "critical" : "minor"));
	}

	if (facts.bullet_only_lines.value.length >= RULES.bulletsMinLines) {
		out.push(finding("detached_bullets", lang, evidence(index, facts.bullet_only_lines.value)));
	}

	const detached = [...facts.date_only_lines.value, ...(facts.right_edge_dates.applicable ? facts.right_edge_dates.value : [])];
	if (detached.length) out.push(finding("detached_dates", lang, evidence(index, detached)));

	if (facts.hyphen_breaks.value.length) out.push(finding("hyphenated_words", lang, evidence(index, facts.hyphen_breaks.value)));

	if (facts.ambiguous_dates.value.length) {
		out.push(finding("ambiguous_date_format", lang, evidence(index, facts.ambiguous_dates.value.map((d) => d.ref))));
	}

	if (facts.shape_rows.applicable && facts.shape_rows.value.length >= RULES.shapesMinRows) {
		out.push(finding("skill_rating_graphics", lang, evidence(index, facts.shape_rows.value.map((r) => r.ref))));
	}

	if (facts.unlabelled_contact.value.length) {
		out.push(finding("icon_only_contact", lang, evidence(index, facts.unlabelled_contact.value.map((c) => c.ref))));
	}

	if (info.pages > RULES.maxPages) out.push(finding("too_long", lang, []));

	return out;
}

/**
 * The facts each measured rule reads. A rule whose facts are all not
 * applicable to the document's format is reported as "not applicable", never
 * as passed (FR-012).
 */
export const RULE_FACTS: Record<string, (keyof LayoutFacts)[]> = {
	no_text_layer: [],
	text_as_graphics: ["graphics_pages"],
	multi_column_layout: ["side_by_side_blocks"],
	table_layout: ["table_grid"],
	contact_in_header_footer: ["header_zone", "footer_zone"],
	unreadable_characters: ["unusual_characters"],
	detached_bullets: ["bullet_only_lines"],
	detached_dates: ["date_only_lines", "right_edge_dates"],
	hyphenated_words: ["hyphen_breaks"],
	ambiguous_date_format: ["ambiguous_dates"],
	skill_rating_graphics: ["shape_rows"],
	icon_only_contact: ["unlabelled_contact"],
	too_long: [],
};

export function ruleApplicable(type: string, facts: LayoutFacts): boolean {
	const needed = RULE_FACTS[type];
	return !needed || needed.length === 0 || needed.some((f) => facts[f].applicable);
}
