// Whether recruiters in this CV's field expect a profile link. GitHub matters
// for tech roles, a portfolio for design, LinkedIn for business-facing roles;
// a physiotherapist, nurse or electrician is not marked down for having none.
// Decided by the page from the verified profile, not by the model: a small
// model applies "only for some profiles" unreliably.

import { fold } from "../document/text";
import type { ExtractedProfile } from "./types";

// Software, data and design. Whole words or phrases, accent- and case-folded,
// in English, Spanish and Catalan; * matches any ending ("disenador*" → diseñadora).
const LINK_FIELDS = [
	// software and data
	"software", "developer*", "desarrollador*", "programador*", "programmer*", "frontend", "front-end", "backend", "back-end", "full stack", "fullstack",
	"devops", "sre", "cloud", "data scien*", "data engineer*", "data analyst*", "analista de datos", "cientific* de datos", "machine learning", "qa",
	"sysadmin", "web", "javascript", "typescript", "python", "java", "react", "github", "computer science", "ingenieria informatica",
	"ingenier* informatic*", "enginyeria informatica",
	// design
	"designer*", "disenador*", "dissenyador*", "ux", "ui", "ux/ui", "product design*", "graphic design*", "diseno grafico", "illustrator*", "ilustrador*",
	"art director*", "photographer*", "fotografo*", "fotografa*",
];
// Business-facing roles, where LinkedIn is the norm. Only matched in the
// headline, job titles and degrees: "Comunicación" in a skills list is a soft
// skill, not a field.
const ROLE_FIELDS = [
	"marketing", "sales", "ventas", "comercial", "business development", "account manager*", "recruiter*", "reclutador*", "talent acquisition",
	"human resources", "recursos humanos", "consultant*", "consultor*", "product manager*", "project manager*", "communications", "comunicacion",
	"periodista*", "journalist*", "copywriter*", "redactor*",
];
const word = (s: string) => s.replace(/[.+/]/g, "\\$&").replace(/\*/g, "[a-z]*");
const matcher = (words: string[]) => new RegExp(`(^|[^a-z0-9])(${words.map(word).join("|")})(?![a-z0-9])`);
const ANYWHERE = matcher(LINK_FIELDS);
const IN_ROLES = matcher([...LINK_FIELDS, ...ROLE_FIELDS]);

export function expectsProfileLink(profile: ExtractedProfile): boolean {
	const ok = <T extends { verified?: boolean }>(x: T | null | undefined): x is T => Boolean(x) && x!.verified !== false;
	const roles = [
		ok(profile.headline) ? profile.headline.value : "",
		...profile.experience.filter(ok).map((e) => e.title ?? ""),
		...profile.education.filter(ok).map((e) => e.qualification ?? ""),
	];
	return roles.some((t) => IN_ROLES.test(fold(t))) || profile.skills.filter(ok).some((s) => ANYWHERE.test(fold(s.value)));
}
