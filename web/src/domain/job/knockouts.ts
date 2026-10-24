// Knock-out filters (US4 of spec 004): the hard requirements recruiters filter
// on, compared with the verified profile. The model only says which
// requirement is which kind; every comparison here is measured. A requirement
// the CV does not mention is "not stated" -- never "fails": the fix may simply
// be to say it.

import type { LineIndex } from "../document/lineIndex";
import type { Evidence } from "../findings/types";
import type { ExtractedProfile } from "../profile/types";
import { levelName, parseLevel } from "./cefr";
import { EQUIVALENCES } from "./equivalences";
import type { KnockoutResult, Requirement } from "./model";
import { findInCv, hasForm } from "./terms";
import { computeYears } from "./years";

const groups = (prefix: string) => EQUIVALENCES.filter((g) => g.id.startsWith(prefix));
const LANGUAGES = groups("lang-");
const DEGREE_RANK: Record<string, number> = { bachelor: 1, master: 2, mba: 2, phd: 3 };
const DEGREES = EQUIVALENCES.filter((g) => g.id in DEGREE_RANK);
const CERTS = EQUIVALENCES.filter((g) => ["aws-saa", "cka", "ckad", "pmp", "psm", "cissp", "itil"].includes(g.id));
const AUTH = EQUIVALENCES.filter((g) => ["work-permit", "eu-citizen", "driving-licence"].includes(g.id));

const ev = (hit: { ref: string; text: string } | null): Evidence[] => (hit ? [{ ref: hit.ref, quote: hit.text.slice(0, 80), verified: true }] : []);
const findGroup = (index: LineIndex, forms: string[]) => {
	for (const f of forms) {
		const hit = findInCv(index, f);
		if (hit) return hit;
	}
	return null;
};

function years(req: Requirement, profile: ExtractedProfile, today: Date): Omit<KnockoutResult, "requirement" | "kind"> {
	const need = req.years ?? Number(/(\d+)\s*\+?\s*(?:years|year|yrs|años|anys|ans|jahre)/i.exec(req.text)?.[1] ?? 0);
	if (!profile.experience.length) return { outcome: "not-stated", evidence: [], detail: { key: "yearsNoRoles", params: { need } } };
	const comp = computeYears(profile.experience, today);
	if (!comp.dated) return { outcome: "unknown", evidence: [], detail: { key: "yearsUndated", params: { need } }, years: comp };
	const evidence = comp.ranges.filter((r) => r.ref).map((r) => ({ ref: r.ref!, verified: true }));
	if (!need) return { outcome: "unknown", evidence, detail: { key: "yearsNoNumber", params: { have: comp.years } }, years: comp };
	return { outcome: comp.years >= need ? "meets" : "fails", evidence, detail: { key: "years", params: { have: comp.years, need } }, years: comp };
}

function language(req: Requirement, profile: ExtractedProfile, index: LineIndex): Omit<KnockoutResult, "requirement" | "kind"> {
	const group = LANGUAGES.find((g) => g.forms.some((f) => hasForm(req.text, f)));
	if (!group) return { outcome: "unknown", evidence: [], detail: { key: "languageUnknown" } };
	const name = group.forms[0]!;
	const need = parseLevel(req.level) ?? parseLevel(req.text);
	const entry = profile.languages.find((l) => l.verified !== false && group.forms.some((f) => hasForm(l.language, f)));
	const hit = entry ? (index.byRef.get(entry.ref) ? { ref: entry.ref, text: index.byRef.get(entry.ref)!.text } : null) : findGroup(index, group.forms);
	if (!entry && !hit) return { outcome: "not-stated", evidence: [], detail: { key: "languageNotStated", params: { language: name } } };
	const have = parseLevel(entry?.level) ?? parseLevel(hit?.text);
	if (need === null) return { outcome: "meets", evidence: ev(hit), detail: { key: "languagePresent", params: { language: name } } };
	if (have === null) return { outcome: "unknown", evidence: ev(hit), detail: { key: "languageNoLevel", params: { language: name, need: levelName(need) } } };
	return {
		outcome: have >= need ? "meets" : "fails",
		evidence: ev(hit),
		detail: { key: "language", params: { language: name, have: levelName(have), need: levelName(need) } },
	};
}

function degree(req: Requirement, profile: ExtractedProfile, index: LineIndex): Omit<KnockoutResult, "requirement" | "kind"> {
	const needed = DEGREES.filter((g) => g.forms.some((f) => hasForm(req.text, f)));
	const need = Math.max(1, ...needed.map((g) => DEGREE_RANK[g.id]!));
	const education = profile.education.filter((e) => e.verified !== false);
	let best = 0;
	let bestHit: { ref: string; text: string } | null = null;
	for (const e of education) {
		const text = `${e.qualification ?? ""} ${e.institution ?? ""}`;
		for (const g of DEGREES) {
			if (g.forms.some((f) => hasForm(text, f)) && DEGREE_RANK[g.id]! > best) {
				best = DEGREE_RANK[g.id]!;
				const line = e.refs[0] ? index.byRef.get(e.refs[0]) : undefined;
				bestHit = line ? { ref: line.ref, text: line.text } : null;
			}
		}
	}
	if (!education.length) return { outcome: "not-stated", evidence: [], detail: { key: "degreeNotStated" } };
	if (!best) return { outcome: "unknown", evidence: [], detail: { key: "degreeUnclear" } };
	return { outcome: best >= need ? "meets" : "fails", evidence: ev(bestHit), detail: { key: best >= need ? "degreeMeets" : "degreeLower" } };
}

function certification(req: Requirement, profile: ExtractedProfile, index: LineIndex): Omit<KnockoutResult, "requirement" | "kind"> {
	const group = CERTS.find((g) => g.forms.some((f) => hasForm(req.text, f)));
	const hit = group ? findGroup(index, group.forms) : findInCv(index, req.text.trim());
	const listed = profile.certifications.some((c) => (group ? group.forms.some((f) => hasForm(c.value, f)) : hasForm(c.value, req.text.trim())));
	if (hit || listed) return { outcome: "meets", evidence: ev(hit), detail: { key: "certificationMeets" } };
	return { outcome: "not-stated", evidence: [], detail: { key: "certificationNotStated" } };
}

function location(req: Requirement, profile: ExtractedProfile): Omit<KnockoutResult, "requirement" | "kind"> {
	const where = profile.location?.value;
	// Whether a city lies inside "the EU" or a commute radius is a judgement the
	// page won't make: it shows what the CV says and leaves the call to the user.
	if (!where) return { outcome: "not-stated", evidence: [], detail: { key: "locationNotStated" } };
	const ref = profile.location!.refs[0];
	return { outcome: "unknown", evidence: ref ? [{ ref, quote: where, verified: profile.location!.verified !== false }] : [], detail: { key: "locationCheck", params: { where } } };
}

function authorisation(req: Requirement, index: LineIndex): Omit<KnockoutResult, "requirement" | "kind"> {
	const hit = findGroup(index, AUTH.flatMap((g) => g.forms));
	if (hit) return { outcome: "meets", evidence: ev(hit), detail: { key: "authorisationMeets" } };
	return { outcome: "not-stated", evidence: [], detail: { key: "authorisationNotStated" } };
}

export function evaluateKnockouts(requirements: Requirement[], profile: ExtractedProfile, index: LineIndex, today: Date = new Date()): KnockoutResult[] {
	const out: KnockoutResult[] = [];
	for (const requirement of requirements) {
		const kind = requirement.knockout;
		if (!kind) continue;
		const r =
			kind === "years" ? years(requirement, profile, today)
			: kind === "language" ? language(requirement, profile, index)
			: kind === "degree" ? degree(requirement, profile, index)
			: kind === "certification" ? certification(requirement, profile, index)
			: kind === "location" ? location(requirement, profile)
			: authorisation(requirement, index);
		out.push({ requirement, kind, ...r });
	}
	const order = { fails: 0, "not-stated": 1, unknown: 2, meets: 3 } as const;
	return out.sort((a, b) => order[a.outcome] - order[b.outcome]);
}
