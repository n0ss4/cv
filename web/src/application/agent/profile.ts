// Shaping model output into the domain profile and back into compact prompts.

import { emptyProfile, type ExtractedProfile } from "@domain/profile/types";

/** "" → null throughout an extraction result (the schemas use "" for absent). */
export function nullify(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(nullify);
	if (node && typeof node === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(node)) out[k] = v === "" ? null : nullify(v);
		// A { value, refs } field whose value is absent is itself absent.
		if ("value" in out && "refs" in out && out.value == null) return null;
		return out;
	}
	return node;
}

export function toProfile(parts: unknown[]): ExtractedProfile {
	const merged = Object.assign({}, ...parts.map((p) => (p && typeof p === "object" ? nullify(p) : {})));
	return { ...emptyProfile(), ...merged } as ExtractedProfile;
}

/** The profile as the review sees it: verified values only, short. */
export function compactProfile(profile: ExtractedProfile) {
	const v = (f: { value: string; verified?: boolean } | null) => (f && f.verified !== false ? f.value : null);
	return {
		name: v(profile.name),
		headline: v(profile.headline),
		email: v(profile.email),
		phone: v(profile.phone),
		location: v(profile.location),
		links: profile.links.filter((l) => l.verified !== false).map((l) => `${l.kind}: ${l.value}`),
		sections: profile.sections.map((s) => `${s.ref} ${s.heading} (${s.kind})`),
		experience: profile.experience.map((e) => ({
			role: `${e.title ?? ""} @ ${e.organisation ?? ""}`,
			dates: `${e.start ?? "?"} - ${e.end ?? "?"}`,
			ref: e.refs?.[0],
			bullets: (e.bullets ?? []).slice(0, 6).map((b) => `${b.ref} ${String(b.text).slice(0, 90)}`),
		})),
		education: profile.education.map((e) => `${e.qualification ?? ""}, ${e.institution ?? ""} (${e.start ?? "?"}-${e.end ?? "?"})`),
		skills: profile.skills.map((s) => s.value).slice(0, 30),
		languages: profile.languages.map((l) => `${l.language}${l.level ? ` (${l.level})` : ""}`),
		certifications: profile.certifications.map((c) => c.value),
	};
}
