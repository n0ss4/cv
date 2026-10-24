// A rough guess of the CV's language, for the "About the AI" quality note only.
// It never changes what is analysed; it only tells the user how well the
// on-device model is expected to cope.

const STOPWORDS: Record<string, string[]> = {
	en: ["the", "and", "with", "for", "experience", "skills", "education", "of"],
	es: ["de", "la", "y", "con", "para", "experiencia", "formación", "habilidades", "en"],
	ca: ["de", "la", "i", "amb", "per", "experiència", "formació", "habilitats", "els"],
	fr: ["de", "la", "et", "avec", "pour", "expérience", "compétences", "formation", "les"],
	de: ["und", "die", "der", "mit", "für", "erfahrung", "kenntnisse", "ausbildung"],
	pt: ["de", "e", "com", "para", "experiência", "competências", "formação", "os"],
};

export function guessLanguage(text: string): string | null {
	const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
	if (words.length < 30) return null;
	const counts = new Map<string, number>();
	for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
	let best: string | null = null;
	let bestScore = 0;
	for (const [lang, list] of Object.entries(STOPWORDS)) {
		const score = list.reduce((n, w) => n + (counts.get(w) ?? 0), 0);
		if (score > bestScore) {
			best = lang;
			bestScore = score;
		}
	}
	return bestScore >= 3 ? best : null;
}
