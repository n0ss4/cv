// The format-neutral document every reader produces (data-model.md#document).
//
// A reader for a positional format (PDF) fills `items` per page and leaves the
// line reconstruction to the domain; a structural format (Word, later) has no
// positions and supplies its parser-order `lines` directly, plus whatever it
// knows structurally (header/footer parts, tables). Each layout fact later
// says whether it could be measured for this document, so a missing capability
// reads as "not applicable" -- never as "no problem".

export type FormatId = string;

export interface ReaderCapabilities {
	/** Text items carry x/y positions (geometric facts are measurable). */
	positions: boolean;
	/** The format has real pages (header/footer zones exist). */
	pages: boolean;
	/** Image and vector-drawing counts are available per page. */
	graphics: boolean;
	/** The reader supplies header/footer text and tables directly. */
	structure: boolean;
}

export interface PositionedItem {
	str: string;
	x: number;
	y: number;
	w: number;
	h: number;
	bold: boolean;
	/** The source format marks the end of a line after this item. */
	eol: boolean;
}

export interface PageGraphics {
	images: number;
	paths: number;
	/** Small vector shapes grouped by baseline band (skill bars, stars). */
	pathRows: { y: number; count: number }[];
}

export interface Page {
	number: number;
	width?: number;
	height?: number;
	items?: PositionedItem[];
	lines?: string[];
	graphics?: PageGraphics;
}

export interface StructureFacts {
	headerText: string[];
	footerText: string[];
	tables: { rows: number; cols: number; firstLineText?: string }[];
	textBoxes: number;
}

export interface Document {
	format: FormatId;
	fileName: string;
	fileSize: number;
	capabilities: ReaderCapabilities;
	pages: Page[];
	structure?: StructureFacts;
}

/** Throws when a reader produced a document that contradicts its capabilities. */
export function assertDocument(doc: Document): void {
	if (!doc.pages.length) throw new Error("document has no pages");
	for (const page of doc.pages) {
		const positional = page.items !== undefined && page.width !== undefined && page.height !== undefined;
		if (doc.capabilities.positions && !positional) throw new Error(`page ${page.number}: positions declared but missing`);
		if (!doc.capabilities.positions && page.lines === undefined) throw new Error(`page ${page.number}: no lines`);
		if (doc.capabilities.graphics && !page.graphics) throw new Error(`page ${page.number}: graphics declared but missing`);
	}
	if (doc.capabilities.structure && !doc.structure) throw new Error("structure declared but missing");
}
