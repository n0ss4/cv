// Grounding: every value the model extracts and every quote it cites must be
// on the line it points at. Small models invent; this turns "the AI said so"
// into "the AI said so, and here is the line" -- or flags it as unverified.

import { expectsProfileLink } from "./field";
import type { LineIndex } from "../document/lineIndex";
import { fold } from "../document/text";
import type { Evidence, Finding, Provenance } from "../findings/types";
import type { ExtractedProfile } from "./types";

const REF = /^p(\d+):(\d+)$/;

const norm = (s: string) => fold(String(s)).replace(/[^\p{L}\p{N}@.+#]+/gu, " ").trim();
const digits = (s: string) => String(s).replace(/\D/g, "");

export function isRef(ref: unknown, index: LineIndex): ref is string {
	return typeof ref === "string" && REF.test(ref) && index.byRef.has(ref);
}

// Text of the referenced lines plus the line after each, so a value that wraps
// onto the next line still verifies.
function context(refs: string[], index: LineIndex): string {
	const out: string[] = [];
	for (const ref of refs) {
		const line = index.byRef.get(ref);
		if (!line) continue;
		out.push(line.text);
		const next = index.byRef.get(`p${line.page}:${line.line + 1}`);
		if (next) out.push(next.text);
	}
	return out.join(" ");
}

export function verifyValue(value: unknown, refs: unknown, index: LineIndex, opts: { kind?: string | null } = {}): boolean {
	const valid = (Array.isArray(refs) ? refs : [refs]).filter((r): r is string => isRef(r, index));
	if (!valid.length || value == null || value === "") return false;
	const hay = context(valid, index);
	if (opts.kind === "phone") {
		const d = digits(String(value));
		return d.length >= 6 && digits(hay).includes(d);
	}
	const needle = norm(String(value));
	return needle.length > 0 && norm(hay).includes(needle);
}

type Node = Record<string, unknown>;

/** Adds `verified` next to every { value, refs } (or { text, ref } …) in the profile. Returns the share verified. */
export function verifyProfile(profile: ExtractedProfile, index: LineIndex): number {
	let total = 0;
	let ok = 0;
	const visit = (node: unknown, key: string | null): void => {
		if (Array.isArray(node)) return node.forEach((n) => visit(n, key));
		if (!node || typeof node !== "object") return;
		const n = node as Node;
		const value = n.value ?? n.text ?? n.heading ?? n.qualification ?? n.language ?? n.title;
		const refs = n.refs ?? (n.ref ? [n.ref] : null);
		if (value != null && refs) {
			total++;
			n.verified = verifyValue(value, refs, index, { kind: key });
			if (n.verified) ok++;
		}
		for (const [k, v] of Object.entries(n)) if (v && typeof v === "object") visit(v, k);
	};
	visit(profile, null);
	return total ? ok / total : 1;
}

export function verifyEvidence(evidence: { ref: string; quote?: string }[] | undefined, index: LineIndex): Evidence[] {
	return (evidence ?? []).map((e) => ({
		...e,
		verified: isRef(e.ref, index) && (!e.quote || verifyValue(e.quote, [e.ref], index)),
	}));
}

const present = (f: { value?: string | null; verified?: boolean } | null | undefined) => Boolean(f?.value) && f?.verified !== false;

/**
 * A review must not contradict facts the verifier already grounded: "missing
 * email" next to a verified email is dropped. Consistency guard, not scoring.
 */
export function contradictsProfile(type: string, profile: ExtractedProfile): boolean {
	const kinds = new Set(profile.sections.filter((s) => s.verified !== false).map((s) => s.kind));
	switch (type) {
		case "missing_email": return present(profile.email);
		case "missing_phone": return present(profile.phone);
		case "missing_location": return present(profile.location);
		// Also dropped where the field doesn't expect one (field.ts).
		case "missing_profile_link": return profile.links.some((l) => l.verified !== false) || !expectsProfileLink(profile);
		case "missing_summary": return kinds.has("summary");
		case "missing_experience_section": return kinds.has("experience");
		case "missing_education_section": return kinds.has("education");
		case "missing_skills_section": return kinds.has("skills");
		case "missing_dates": return profile.experience.length > 0 && profile.experience.every((e) => e.start || e.end);
		default: return false;
	}
}

/** Absence findings are "verified" by the consistency guard; the rest by their quotes. */
export function provenanceOf(finding: Pick<Finding, "type" | "evidence">): Provenance {
	if (finding.type.startsWith("missing_") || finding.type === "title_mismatch") return "ai-verified";
	return finding.evidence.some((e) => e.verified) ? "ai-verified" : "ai-unverified";
}
