// The closed catalogue of findings (contracts/findings.md). It is what "at ATS
// level" means here: the defects this project's builder guards against, the
// parser behaviour documented in research R2, and what recruiters filter on.
//
// `definition` is written for whoever decides: the model (source "ai") reads
// it in the review prompt, so it says what evidence justifies the finding;
// for "measured" entries it documents the rule in rules.ts. Category and
// severity always come from here, never from the model.

import type { Category, Lang, Severity, Source } from "./types";

type Localised = Record<Lang, string>;

export interface CatalogueEntry {
	type: string;
	category: Category;
	severity: Severity;
	source: Source;
	definition: string;
	title: Localised;
	why: Localised;
	fix: Localised;
	/** The defect keeps the CV out of recruiters' searches on this field. */
	searchable?: boolean;
	/** Only produced by the job comparison. */
	job?: boolean;
}

const e = (entry: CatalogueEntry) => entry;

export const CATALOGUE_ENTRIES: CatalogueEntry[] = [
	// ── measured: parsing ────────────────────────────────────────────────
	e({
		type: "no_text_layer", category: "parsing", severity: "critical", source: "measured",
		definition: "doc_info.text_layer is none.",
		title: { en: "No readable text in this file", es: "El archivo no tiene texto legible" },
		why: { en: "It was scanned or exported as images. An ATS reads nothing and files an empty profile.", es: "Se escaneó o exportó como imágenes. Un ATS no lee nada y archiva un perfil vacío." },
		fix: { en: "Export the CV again from Word, Google Docs or this builder as a text PDF.", es: "Vuelve a exportar el CV desde Word, Google Docs o este generador como PDF con texto." },
	}),
	e({
		type: "text_as_graphics", category: "parsing", severity: "critical", source: "measured",
		definition: "A page has images or vector drawing but fewer than 200 characters of text.",
		title: { en: "Text is drawn as graphics", es: "El texto está dibujado como gráficos" },
		why: { en: "Design-tool exports (Canva, Figma, InDesign) can turn text into shapes. Parsers see an almost blank page.", es: "Las exportaciones de herramientas de diseño (Canva, Figma, InDesign) pueden convertir el texto en formas. El parser ve una página casi vacía." },
		fix: { en: "Export with real text (not outlined), or rebuild the CV in a word processor.", es: "Exporta con texto real (no contorneado) o rehaz el CV en un procesador de textos." },
	}),
	e({
		type: "multi_column_layout", category: "parsing", severity: "critical", source: "measured",
		definition: "side_by_side_blocks.lines ≥ 5 and ≥ 15 % of of_total_lines.",
		title: { en: "Two columns get mixed together", es: "Las dos columnas se mezclan" },
		why: { en: "Parsers read across the page, so lines from both columns end up interleaved in your profile.", es: "Los parsers leen de lado a lado, así que las líneas de ambas columnas se mezclan en tu perfil." },
		fix: { en: "Use a single column; move the sidebar content into its own sections.", es: "Usa una sola columna; mueve el contenido de la barra lateral a sus propias secciones." },
	}),
	e({
		type: "table_layout", category: "parsing", severity: "major", source: "measured",
		definition: "table_grid has a grid of ≥ 3 rows × ≥ 3 columns.",
		title: { en: "Content is laid out as a table", es: "Hay contenido en forma de tabla" },
		why: { en: "Table cells come out of parsers in an unpredictable order, separating labels from their values.", es: "Las celdas de una tabla salen del parser en un orden impredecible y separan etiquetas de sus valores." },
		fix: { en: "Replace the table with plain lines: one item per line, or a comma-separated list.", es: "Sustituye la tabla por líneas normales: un elemento por línea o una lista separada por comas." },
	}),
	e({
		type: "contact_in_header_footer", category: "parsing", severity: "major", source: "measured",
		definition: "An email or phone appears in header_zone/footer_zone and in no other line.",
		title: { en: "Your contact details are only in the page header or footer", es: "Tus datos de contacto solo están en el encabezado o pie de página" },
		why: { en: "Many parsers skip page headers and footers, so your profile can arrive with no way to contact you.", es: "Muchos parsers ignoran encabezados y pies de página, y tu perfil puede llegar sin forma de contactarte." },
		fix: { en: "Move your email and phone into the first lines of the page body, under your name.", es: "Mueve tu email y teléfono a las primeras líneas del cuerpo, bajo tu nombre." },
	}),
	e({
		type: "unreadable_characters", category: "parsing", severity: "critical", source: "measured",
		definition: "unusual_characters.ratio > 0.02 (critical) or count ≥ 1 (minor).",
		title: { en: "Some characters can't be read", es: "Algunos caracteres no se pueden leer" },
		why: { en: "The font has no proper Unicode map, so letters (accented names first) arrive garbled and won't match searches.", es: "La fuente no tiene un mapa Unicode correcto: las letras (primero las acentuadas) llegan corruptas y no coinciden en las búsquedas." },
		fix: { en: "Use a standard font (Arial, Calibri, Inter…) and export again; avoid ligatures and symbol fonts.", es: "Usa una fuente estándar (Arial, Calibri, Inter…) y vuelve a exportar; evita ligaduras y fuentes de símbolos." },
	}),
	e({
		type: "detached_bullets", category: "parsing", severity: "major", source: "measured",
		definition: "bullet_only_lines has ≥ 2 lines.",
		title: { en: "Bullets are separated from their text", es: "Las viñetas están separadas de su texto" },
		why: { en: "Each bullet marker is extracted on its own line, apart from the achievement it introduces.", es: "Cada viñeta se extrae en su propia línea, separada del logro que introduce." },
		fix: { en: "Type the bullet character inline (•) instead of using a list style or a separate text box.", es: "Escribe la viñeta en la misma línea (•) en lugar de un estilo de lista o un cuadro de texto aparte." },
	}),
	e({
		type: "detached_dates", category: "parsing", severity: "minor", source: "measured",
		definition: "date_only_lines + right_edge_dates ≥ 1.",
		title: { en: "Dates are separated from their roles", es: "Las fechas están separadas de sus puestos" },
		why: { en: "Right-aligned or stand-alone dates can surface before or apart from their job, breaking your timeline.", es: "Las fechas alineadas a la derecha o sueltas pueden aparecer antes o lejos de su puesto y romper tu cronología." },
		fix: { en: "Put the dates on the same line as the employer: “Company · Jan 2021 – Present”.", es: "Pon las fechas en la misma línea que la empresa: «Empresa · ene. 2021 – Actualidad»." },
	}),
	e({
		type: "hyphenated_words", category: "parsing", severity: "minor", source: "measured",
		definition: "hyphen_breaks has ≥ 1 line.",
		title: { en: "Words are split across lines", es: "Hay palabras partidas entre líneas" },
		why: { en: "A parser that doesn't rejoin “require-ments” indexes two non-words, neither matching a search.", es: "Un parser que no une «requi-sitos» indexa dos fragmentos que no coinciden con ninguna búsqueda." },
		fix: { en: "Turn off automatic hyphenation in your editor.", es: "Desactiva la división automática de palabras en tu editor." },
	}),
	// ── measured: dates, content, contact, length ────────────────────────
	e({
		type: "ambiguous_date_format", category: "dates", severity: "minor", source: "measured",
		definition: "ambiguous_dates has ≥ 1 line (apostrophe years, dd/mm/yy, month + two-digit year).",
		title: { en: "Some dates are abbreviated", es: "Algunas fechas están abreviadas" },
		why: { en: "Parsers misread “Jan '22” or “01/02/22”, which miscounts your years of experience.", es: "Los parsers interpretan mal «ene '22» o «01/02/22», y calculan mal tus años de experiencia." },
		fix: { en: "Write full years: “January 2022 – Present” or “01/2022 – 06/2024”.", es: "Escribe años completos: «enero 2022 – Actualidad» o «01/2022 – 06/2024»." },
	}),
	e({
		type: "skill_rating_graphics", category: "content", severity: "minor", source: "measured",
		definition: "shape_rows has ≥ 3 shapes on ≥ 2 lines.",
		title: { en: "Skill levels are shown as graphics", es: "Los niveles de habilidad son gráficos" },
		why: { en: "Bars, dots and stars carry no text, so your level is invisible to the ATS and to searches.", es: "Las barras, puntos y estrellas no contienen texto: tu nivel es invisible para el ATS y las búsquedas." },
		fix: { en: "State levels in words: “Python (advanced)”, “German — B2”.", es: "Indica el nivel con palabras: «Python (avanzado)», «Alemán — B2»." },
	}),
	e({
		type: "icon_only_contact", category: "contact", severity: "minor", source: "measured",
		definition: "unlabelled_contact has ≥ 1 line: an icon glyph before an email/phone, with no text label.",
		title: { en: "Contact details are labelled with icons only", es: "Los datos de contacto solo llevan iconos" },
		why: { en: "Some parsers rely on labels like “Email:”; an icon glyph can make the field go unrecognised.", es: "Algunos parsers dependen de etiquetas como «Email:»; un icono puede hacer que no reconozcan el campo." },
		fix: { en: "Add a short text label (“Email:”, “Phone:”) or write the details plainly.", es: "Añade una etiqueta corta («Email:», «Teléfono:») o escribe los datos sin iconos." },
	}),
	e({
		type: "too_long", category: "length", severity: "minor", source: "measured",
		definition: "doc_info.pages > 2.",
		title: { en: "The CV is longer than two pages", es: "El CV tiene más de dos páginas" },
		why: { en: "Recruiters skim; the most relevant experience should fit on one or two pages.", es: "Los reclutadores leen en diagonal; lo más relevante debería caber en una o dos páginas." },
		fix: { en: "Trim older roles to one line each and drop outdated skills.", es: "Reduce los puestos antiguos a una línea y quita habilidades obsoletas." },
	}),

	// ── AI: contact ──────────────────────────────────────────────────────
	e({
		type: "missing_email", category: "contact", severity: "critical", source: "ai",
		definition: "The profile has no email.",
		title: { en: "No email address found", es: "No se encontró ningún email" },
		why: { en: "Without an email the ATS profile can't be contacted.", es: "Sin email, nadie puede contactar con el perfil del ATS." },
		fix: { en: "Add your email in plain text under your name.", es: "Añade tu email como texto bajo tu nombre." },
	}),
	e({
		type: "missing_phone", category: "contact", severity: "major", source: "ai",
		definition: "The profile has no phone number.",
		title: { en: "No phone number found", es: "No se encontró teléfono" },
		why: { en: "Recruiters often call first; many ATS forms treat the phone as required.", es: "Los reclutadores suelen llamar primero; muchos ATS consideran obligatorio el teléfono." },
		fix: { en: "Add your phone with the country code, e.g. +34 600 000 000.", es: "Añade tu teléfono con prefijo, p. ej. +34 600 000 000." },
	}),
	e({
		type: "missing_profile_link", category: "contact", severity: "minor", source: "ai",
		definition: "The profile has no LinkedIn, GitHub or portfolio link, and the role is one where recruiters expect one: software or data (GitHub or portfolio), design (portfolio), or business-facing roles such as sales, marketing, HR or consulting (LinkedIn). Never report it for other fields, such as healthcare, education, trades or hospitality.",
		title: { en: "No professional profile link", es: "Sin enlace a un perfil profesional" },
		why: { en: "In your field, recruiters often check a LinkedIn profile, GitHub or portfolio to verify your experience.", es: "En tu sector, los reclutadores suelen mirar un perfil de LinkedIn, GitHub o portfolio para verificar tu experiencia." },
		fix: { en: "Add the one your field uses as plain text, e.g. linkedin.com/in/your-name or your portfolio's address.", es: "Añade el que se use en tu sector como texto, p. ej. linkedin.com/in/tu-nombre o la dirección de tu portfolio." },
	}),
	e({
		type: "missing_location", category: "contact", severity: "minor", source: "ai",
		definition: "The profile has no city or country.",
		title: { en: "No location found", es: "No se encontró ubicación" },
		why: { en: "Recruiters filter by location; without one you can drop out of those searches.", es: "Los reclutadores filtran por ubicación; sin ella puedes quedar fuera de esas búsquedas." },
		fix: { en: "Add your city and country.", es: "Añade tu ciudad y país." },
	}),
	// ── AI: sections ─────────────────────────────────────────────────────
	e({
		type: "missing_experience_section", category: "sections", severity: "critical", source: "ai", searchable: true,
		definition: "No section heading of kind experience.",
		title: { en: "No recognisable experience section", es: "No hay una sección de experiencia reconocible" },
		why: { en: "Your job titles won't be filed, so recruiter searches by title won't find you.", es: "Tus puestos no se archivarán y las búsquedas por puesto no te encontrarán." },
		fix: { en: "Add a heading named “Experience” or “Work experience” above your roles.", es: "Añade un título «Experiencia» o «Experiencia laboral» sobre tus puestos." },
	}),
	e({
		type: "missing_education_section", category: "sections", severity: "major", source: "ai", searchable: true,
		definition: "No section heading of kind education.",
		title: { en: "No recognisable education section", es: "No hay una sección de formación reconocible" },
		why: { en: "Recruiters often filter by degree; without this section you won't appear in those searches.", es: "Los reclutadores suelen filtrar por titulación; sin esta sección no aparecerás en esas búsquedas." },
		fix: { en: "Add a heading named “Education”.", es: "Añade un título «Formación» o «Educación»." },
	}),
	e({
		type: "missing_skills_section", category: "sections", severity: "major", source: "ai", searchable: true,
		definition: "No section heading of kind skills.",
		title: { en: "No recognisable skills section", es: "No hay una sección de habilidades reconocible" },
		why: { en: "Skills are the field recruiters search most; without the section they may not be filed.", es: "Las habilidades son el campo más buscado; sin la sección pueden no archivarse." },
		fix: { en: "Add a “Skills” heading with a comma-separated list.", es: "Añade un título «Habilidades» con una lista separada por comas." },
	}),
	e({
		type: "unconventional_heading", category: "sections", severity: "major", source: "ai",
		definition: "A section heading worded so that an ATS would not recognise it (for example 'Where I've worked', 'My toolbox' instead of 'Experience', 'Skills'). Quote the heading.",
		title: { en: "A heading an ATS won't recognise", es: "Un título que el ATS no reconocerá" },
		why: { en: "Parsers match headings against a list; creative wording leaves the section unfiled.", es: "Los parsers comparan los títulos con una lista; un título creativo deja la sección sin archivar." },
		fix: { en: "Use a standard heading: Experience, Education, Skills, Languages, Projects.", es: "Usa un título estándar: Experiencia, Formación, Habilidades, Idiomas, Proyectos." },
	}),
	// ── AI: content and language ─────────────────────────────────────────
	e({
		type: "no_measurable_results", category: "content", severity: "major", source: "ai",
		definition: "Fewer than a third of the experience bullets contain a number, percentage or amount.",
		title: { en: "Few results are measurable", es: "Pocos resultados son medibles" },
		why: { en: "Recruiters favour outcomes with numbers; duties without results are easy to skip.", es: "Los reclutadores valoran resultados con cifras; las tareas sin resultados se pasan por alto." },
		fix: { en: "Rewrite strong bullets as action + result + number.", es: "Reescribe tus mejores puntos como acción + resultado + cifra." },
	}),
	e({
		type: "duty_style_bullets", category: "content", severity: "minor", source: "ai",
		definition: "Several bullets describe duties ('Responsible for…', 'Worked on…', 'Encargado de…') instead of achievements. Quote one.",
		title: { en: "Bullets describe duties, not results", es: "Los puntos describen tareas, no logros" },
		why: { en: "“Responsible for…” says what the job was, not what you achieved.", es: "«Responsable de…» dice cuál era el puesto, no qué lograste." },
		fix: { en: "Start with a verb and a result: “Cut reporting time by 40% by…”.", es: "Empieza con un verbo y un resultado: «Reduje un 40 % el tiempo de informes…»." },
	}),
	e({
		type: "missing_summary", category: "content", severity: "minor", source: "ai",
		definition: "No section of kind summary.",
		title: { en: "No summary at the top", es: "Sin resumen al principio" },
		why: { en: "A two-line summary with your target title helps both searches and the first skim.", es: "Un resumen de dos líneas con tu puesto objetivo ayuda en las búsquedas y en la primera lectura." },
		fix: { en: "Add 2–3 lines: who you are, your strongest skills, what you're looking for.", es: "Añade 2–3 líneas: quién eres, tus puntos fuertes y qué buscas." },
	}),
	e({
		type: "first_person", category: "language", severity: "minor", source: "ai",
		definition: "Bullets or the summary use the first person ('I', 'my', 'yo', 'mi'). Quote it.",
		title: { en: "Written in the first person", es: "Escrito en primera persona" },
		why: { en: "CV convention is an implied subject; “I” costs space and reads informal.", es: "La convención es omitir el sujeto; «yo» ocupa espacio y suena informal." },
		fix: { en: "Start bullets with the verb: “Led…”, “Built…”.", es: "Empieza los puntos con el verbo: «Dirigí…», «Construí…»." },
	}),
	e({
		type: "spelling_or_grammar", category: "language", severity: "minor", source: "ai",
		definition: "A clear spelling or grammar mistake. Quote the exact words. Do not report style preferences or words in another language.",
		title: { en: "Possible spelling mistake", es: "Posible error ortográfico" },
		why: { en: "A misspelt keyword won't match a recruiter's search.", es: "Una palabra clave mal escrita no coincidirá con la búsqueda del reclutador." },
		fix: { en: "Correct the quoted words.", es: "Corrige las palabras citadas." },
	}),
	// ── AI: dates ────────────────────────────────────────────────────────
	e({
		type: "missing_dates", category: "dates", severity: "major", source: "ai",
		definition: "An experience entry has neither start nor end date.",
		title: { en: "A role has no dates", es: "Un puesto no tiene fechas" },
		why: { en: "Without dates the ATS can't compute your years of experience, a common filter.", es: "Sin fechas el ATS no puede calcular tus años de experiencia, un filtro habitual." },
		fix: { en: "Add month and year for start and end.", es: "Añade mes y año de inicio y fin." },
	}),
	e({
		type: "inconsistent_date_format", category: "dates", severity: "minor", source: "ai",
		definition: "Entries use different date formats (for example '03/2021' in one and 'March 2021' in another). Years only everywhere is consistent.",
		title: { en: "Dates use different formats", es: "Las fechas usan formatos distintos" },
		why: { en: "Mixed formats are parsed inconsistently and look careless.", es: "Los formatos mezclados se interpretan de forma inconsistente y parecen descuidados." },
		fix: { en: "Use one format everywhere, e.g. “Mar 2021 – Jun 2023”.", es: "Usa un único formato, p. ej. «mar. 2021 – jun. 2023»." },
	}),
	// ── AI: job comparison ───────────────────────────────────────────────
	e({
		type: "missing_requirement", category: "keywords", severity: "major", source: "ai", job: true,
		definition: "A required job requirement has no evidence in the CV.",
		title: { en: "A required skill from the posting is missing", es: "Falta un requisito obligatorio de la oferta" },
		why: { en: "Recruiters search for the posting's requirements; without it you won't appear.", es: "Los reclutadores buscan los requisitos de la oferta; sin él no aparecerás." },
		fix: { en: "If you have it, name it explicitly in a bullet or your skills.", es: "Si lo tienes, nómbralo explícitamente en un punto o en tus habilidades." },
	}),
	e({
		type: "title_mismatch", category: "keywords", severity: "major", source: "ai", job: true,
		definition: "The target job title does not appear in the CV.",
		title: { en: "The job title doesn't appear in your CV", es: "El título del puesto no aparece en tu CV" },
		why: { en: "Exact title matches are among the strongest search signals recruiters use.", es: "Coincidir con el título exacto es una de las señales de búsqueda más fuertes." },
		fix: { en: "Use the posting's title in your headline or summary, if it's accurate.", es: "Usa el título de la oferta en tu titular o resumen, si es fiel a tu perfil." },
	}),
	e({
		type: "knockout_failed", category: "keywords", severity: "major", source: "measured", job: true,
		definition: "A hard requirement of the posting (years, degree, language level) is stated in the CV below what the posting asks.",
		title: { en: "Below a hard requirement of the posting", es: "Por debajo de un requisito eliminatorio de la oferta" },
		why: { en: "Recruiters filter on hard requirements before reading; the CV is likely screened out.", es: "Los reclutadores filtran por requisitos eliminatorios antes de leer; es probable que el CV quede fuera." },
		fix: { en: "Check the CV states your real level; if it does, this posting may not be a fit.", es: "Comprueba que el CV refleja tu nivel real; si lo hace, puede que esta oferta no encaje." },
	}),
	e({
		type: "knockout_not_stated", category: "keywords", severity: "minor", source: "measured", job: true,
		definition: "A hard requirement of the posting (language, degree, location, work authorisation, certification) is not mentioned in the CV.",
		title: { en: "A hard requirement isn't stated in your CV", es: "Tu CV no menciona un requisito eliminatorio" },
		why: { en: "A filter can't match what the CV doesn't say, even if you meet it.", es: "Un filtro no puede encontrar lo que el CV no dice, aunque lo cumplas." },
		fix: { en: "If you meet it, state it plainly (for example “English — C1”, “EU work permit”).", es: "Si lo cumples, indícalo claramente (por ejemplo «Inglés — C1», «Permiso de trabajo UE»)." },
	}),
];

export const CATALOGUE: ReadonlyMap<string, CatalogueEntry> = new Map(CATALOGUE_ENTRIES.map((c) => [c.type, c]));

/** Types the review prompt may name: AI-decided, not job-only. */
export const AI_REVIEW_TYPES = CATALOGUE_ENTRIES.filter((c) => c.source === "ai" && !c.job).map((c) => c.type);
export const MEASURED_TYPES = CATALOGUE_ENTRIES.filter((c) => c.source === "measured").map((c) => c.type);

export function entry(type: string): CatalogueEntry {
	const found = CATALOGUE.get(type);
	if (!found) throw new Error(`unknown finding type ${type}`);
	return found;
}
