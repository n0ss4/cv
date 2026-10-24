// When a missing LinkedIn/GitHub/portfolio link is worth reporting.
import { describe, expect, it } from "vitest";
import { expectsProfileLink } from "@domain/profile/field";
import { emptyProfile, type ExtractedProfile } from "@domain/profile/types";
import { contradictsProfile } from "@domain/profile/verify";

function profile(p: { headline?: string; titles?: string[]; degrees?: string[]; skills?: string[] }): ExtractedProfile {
	const out = emptyProfile();
	if (p.headline) out.headline = { value: p.headline, refs: ["p1:1"], verified: true };
	out.experience = (p.titles ?? []).map((title) => ({ title, organisation: null, location: null, start: null, end: null, current: false, refs: ["p1:2"], bullets: [], verified: true }));
	out.education = (p.degrees ?? []).map((qualification) => ({ qualification, institution: null, start: null, end: null, refs: ["p1:3"], verified: true }));
	out.skills = (p.skills ?? []).map((value) => ({ value, ref: "p1:4", verified: true }));
	return out;
}

describe("expectsProfileLink", () => {
	it("is false for fields where recruiters don't expect one", () => {
		expect(expectsProfileLink(profile({
			headline: "Estudiante de Fisioterapia",
			titles: ["Prácticas de fisioterapia", "Monitora de natación"],
			degrees: ["Grado en Fisioterapia", "Técnico Superior en Animación"],
			skills: ["Comunicación", "Trabajo en equipo", "Microsoft Office", "Consultas de valoración"],
		}))).toBe(false);
		expect(expectsProfileLink(profile({ headline: "Registered Nurse", skills: ["Communication", "Patient care"] }))).toBe(false);
		expect(expectsProfileLink(profile({ headline: "Electricista", skills: ["Instalaciones de baja tensión"] }))).toBe(false);
	});

	it("is true for tech, data and design, from the role or the skills", () => {
		expect(expectsProfileLink(profile({ headline: "Backend Engineer" }))).toBe(true);
		expect(expectsProfileLink(profile({ titles: ["Desarrolladora web"] }))).toBe(true);
		expect(expectsProfileLink(profile({ titles: ["Analista"], skills: ["Python", "SQL"] }))).toBe(true);
		expect(expectsProfileLink(profile({ headline: "Diseñadora UX/UI" }))).toBe(true);
		expect(expectsProfileLink(profile({ degrees: ["Grado en Ingeniería Informática"] }))).toBe(true);
	});

	it("is true for business-facing roles, but not for a soft skill with the same word", () => {
		expect(expectsProfileLink(profile({ headline: "Responsable de Marketing Digital" }))).toBe(true);
		expect(expectsProfileLink(profile({ titles: ["Technical Recruiter"] }))).toBe(true);
		expect(expectsProfileLink(profile({ skills: ["Comunicación", "Marketing"] }))).toBe(false);
	});

	it("ignores unverified values", () => {
		const p = profile({ headline: "Software Engineer" });
		p.headline!.verified = false;
		expect(expectsProfileLink(p)).toBe(false);
	});

	it("drops the finding where no link is expected, keeps it where one is", () => {
		expect(contradictsProfile("missing_profile_link", profile({ headline: "Fisioterapeuta" }))).toBe(true);
		expect(contradictsProfile("missing_profile_link", profile({ headline: "Frontend Developer" }))).toBe(false);
	});
});
