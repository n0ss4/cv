// What an ATS would file (contracts/schemas.md). Every value carries the line
// references it was copied from and, after verification, whether it was found
// there. null means "not in the document".

export interface Field {
	value: string;
	refs: string[];
	verified?: boolean;
}

export interface ProfileLink extends Field {
	kind: "linkedin" | "github" | "portfolio" | "other";
}

export type SectionKind = "summary" | "experience" | "education" | "skills" | "languages" | "projects" | "certifications" | "awards" | "other";

export interface Section {
	heading: string;
	kind: SectionKind;
	ref: string;
	verified?: boolean;
}

export interface Bullet {
	text: string;
	ref: string;
	verified?: boolean;
}

export interface ExperienceEntry {
	title: string | null;
	organisation: string | null;
	location: string | null;
	start: string | null;
	end: string | null;
	current: boolean;
	refs: string[];
	bullets: Bullet[];
	verified?: boolean;
}

export interface EducationEntry {
	qualification: string | null;
	institution: string | null;
	start: string | null;
	end: string | null;
	refs: string[];
	verified?: boolean;
}

export interface RefValue {
	value: string;
	ref: string;
	verified?: boolean;
}

export interface LanguageEntry {
	language: string;
	level: string | null;
	ref: string;
	verified?: boolean;
}

export interface ExtractedProfile {
	name: Field | null;
	headline: Field | null;
	email: Field | null;
	phone: Field | null;
	location: Field | null;
	links: ProfileLink[];
	sections: Section[];
	experience: ExperienceEntry[];
	education: EducationEntry[];
	skills: RefValue[];
	languages: LanguageEntry[];
	certifications: RefValue[];
}

/** The fields recruiters filter on most (research R2), marked in the profile view. */
export const SEARCHABLE_FIELDS = ["skills", "education", "experience", "certifications"] as const;

export const emptyProfile = (): ExtractedProfile => ({
	name: null, headline: null, email: null, phone: null, location: null,
	links: [], sections: [], experience: [], education: [], skills: [], languages: [], certifications: [],
});
