// Date patterns in the languages CVs reach this tool in (en, es, ca, fr, de, pt).

const MONTHS =
	"jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|" +
	"ene|abr|ago|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|" +
	"gen|febr|marc|maig|juny|jul|ag|set|des|gener|febrer|juliol|agost|setembre|novembre|desembre|" +
	"janv|fevr|avr|juil|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|decembre|" +
	"januar|februar|marz|juni|juli|oktober|dezember|janeiro|fevereiro|marco|maio|junho|julho|setembro|outubro|dezembro";
const PRESENT = "present|current|now|today|actualidad|actual|presente|hoy|actualitat|avui|aujourd'hui|aujourd’hui|heute|atual|oggi";
const DATE_POINT = `(?:(?:${MONTHS})\\.?\\s+|\\d{1,2}[/.-])?(?:19|20)\\d{2}`;

/** A line that holds nothing but a date or a date range. */
export const DATE_ONLY = new RegExp(
	`^\\s*(?:${DATE_POINT})(?:\\s*(?:-|–|—|to|a|al|à|bis|até)\\s*(?:${DATE_POINT}|${PRESENT}))?\\s*$`,
	"iu",
);

// Dates a parser is known to misread (research R2): apostrophe years ("Jan '22"),
// numeric dates with a two-digit year ("01/02/22"), and a month followed by a
// two-digit year ("Mar 21 – Jun 23"). A month and a day followed by a comma
// ("March 21, 2021") is a full date, not an abbreviation.
const AMBIGUOUS = [
	/['’‘]\d{2}\b/u,
	/(?<![\d+])\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2}\b(?![/.-]?\d)/u,
	new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{2}\\b(?![\\d,])`, "iu"),
];

/** Phone numbers look like dates to the patterns above. */
const PHONE_LIKE = /\+\d|\(\d{2,4}\)/;

export function ambiguousDate(text: string): boolean {
	if (PHONE_LIKE.test(text)) return false;
	return AMBIGUOUS.some((re) => re.test(text));
}
