// The interface language: the browser's by default, switchable, held in memory
// only (storing the choice would be storing something, FR-002).

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@domain/findings/types";
import { en, type Strings } from "./en";
import { es } from "./es";

const DICTS: Record<Lang, Strings> = { en, es };

export function browserLang(): Lang {
	const l = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
	return l.startsWith("es") || l.startsWith("ca") ? "es" : "en";
}

/** Replaces {name} placeholders. */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
	return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

interface I18n {
	lang: Lang;
	t: Strings;
	setLang(lang: Lang): void;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
	const [lang, setLang] = useState<Lang>(initial ?? browserLang());
	const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang]);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
	const v = useContext(Ctx);
	if (!v) throw new Error("useI18n outside I18nProvider");
	return v;
}
