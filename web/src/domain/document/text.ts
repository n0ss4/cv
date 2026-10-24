// Text normalisation shared by search, verification and the layout facts.

/** Case-, accent- and whitespace-insensitive form used for every comparison. */
export const fold = (s: string): string =>
	s.normalize("NFD").replace(/[\u0300-\u036F]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const nonSpace = (s: string): number => s.replace(/\s/g, "").length;
