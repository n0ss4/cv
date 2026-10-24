// Everything that needs no AI: the line index, document facts, layout facts
// and the measured findings. Runs for every file, with or without a model.

import { docInfo, indexDocument, outline, type DocInfo, type LineIndex, type OutlinePage } from "@domain/document/lineIndex";
import { guessLanguage } from "@domain/document/language";
import type { Document } from "@domain/document/types";
import type { Finding, Lang } from "@domain/findings/types";
import { measureLayout as measure, type LayoutFacts } from "@domain/layout/facts";
import { measuredFindings } from "@domain/layout/rules";

export interface Measured {
	index: LineIndex;
	info: DocInfo;
	outline: OutlinePage[];
	facts: LayoutFacts;
	findings: Finding[];
	cvLanguage: string | null;
}

export function measureLayout(doc: Document, lang: Lang): Measured {
	const index = indexDocument(doc);
	const info = docInfo(index);
	const facts = measure(index);
	return {
		index,
		info,
		outline: outline(index),
		facts,
		findings: measuredFindings(index, facts, lang, info),
		cvLanguage: guessLanguage(index.text),
	};
}
