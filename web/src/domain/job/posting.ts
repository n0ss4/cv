// Long postings are cut to their requirement sections before analysis
// (research R6 of spec 004), so the small on-device model sees what matters.

export const POSTING_LIMIT = 6000;

const HEADINGS = /^\s*(?:#+\s*)?(requirements|qualifications|what you('|’)ll bring|what we('|’)re looking for|you have|must[- ]haves?|nice to have|skills|requisitos|qué buscamos|que buscamos|qué necesitas|se valorará|perfil|requerimientos)\b/im;

export function trimPosting(text: string): { text: string; trimmed: boolean } {
	const clean = text.replace(/\r\n/g, "\n").trim();
	if (clean.length <= POSTING_LIMIT) return { text: clean, trimmed: false };
	const at = HEADINGS.exec(clean)?.index ?? 0;
	return { text: clean.slice(at).trimStart().slice(0, POSTING_LIMIT), trimmed: true };
}
