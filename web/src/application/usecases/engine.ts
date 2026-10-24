// Which on-device engine to use, and getting it ready.

import type { Lang } from "@domain/findings/types";
import type { AiEngine, EngineAvailability, EngineLangs } from "../ports/AiEngine";

export function engineLangs(uiLang: Lang): EngineLangs {
	return { input: uiLang === "en" ? ["en"] : ["en", uiLang], output: uiLang };
}

export interface EngineChoice {
	engine: AiEngine | null;
	availability: EngineAvailability;
}

const RANK: Record<EngineAvailability, number> = { available: 0, downloading: 1, downloadable: 2, unavailable: 3, "no-api": 4 };

/** The best registered engine: one that is ready, else one that can be made ready. */
export async function checkEngine(engines: readonly AiEngine[], uiLang: Lang): Promise<EngineChoice> {
	const langs = engineLangs(uiLang);
	let best: EngineChoice = { engine: null, availability: "no-api" };
	for (const engine of engines) {
		let availability: EngineAvailability;
		try {
			availability = await engine.availability(langs);
		} catch {
			availability = "unavailable";
		}
		if (RANK[availability] < RANK[best.availability]) best = { engine, availability };
	}
	return best.availability === "unavailable" || best.availability === "no-api" ? { engine: null, availability: best.availability } : best;
}

/** Only ever called after the user consented in the download dialog. */
export function prepareEngine(engine: AiEngine, uiLang: Lang, opts: { onProgress?: (share: number) => void; signal?: AbortSignal } = {}) {
	return engine.prepare({ langs: engineLangs(uiLang), ...opts });
}
