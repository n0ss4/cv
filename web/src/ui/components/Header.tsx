import type { Lang } from "@domain/findings/types";
import { useAnalysis } from "../app/AnalysisProvider";
import { useI18n } from "../i18n";
import { Icon } from "./icons";

// Set at build time by CI (VITE_SOURCE_URL = the repository's URL), so no
// account name is written into the source. Without it the links are hidden.
export const SOURCE_URL: string = import.meta.env.VITE_SOURCE_URL ?? "";

export type Panel = "privacy" | "about" | "prompts" | "log" | null;

function PrivacyStatus({ onOpen }: { onOpen(): void }) {
	const { t } = useI18n();
	const { state } = useAnalysis();
	const downloading = state.engine.availability === "downloading" || state.phase === "downloading";
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-haspopup="dialog"
			className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-accent/25 bg-accent-soft px-3 py-1.5 text-[13px] text-accent hover:border-accent/50"
		>
			<Icon name="shield" className="size-4 shrink-0" strokeWidth={1.75} />
			<span className="truncate">
				{downloading ? t.app.privacyChipDownloading : (<><strong className="font-semibold">{t.app.privacyChipStrong}</strong>{t.app.privacyChipRest}</>)}
			</span>
			<Icon name="chevronDown" className="size-3.5 shrink-0" />
		</button>
	);
}

function LangSwitch() {
	const { lang, setLang, t } = useI18n();
	return (
		<div role="group" aria-label={t.app.language} className="flex rounded-lg bg-surface-muted p-[3px]">
			{(["en", "es"] as Lang[]).map((l) => (
				<button
					key={l}
					type="button"
					aria-pressed={lang === l}
					onClick={() => setLang(l)}
					className={`h-[26px] w-9 rounded-md text-xs ${lang === l ? "bg-surface font-semibold text-accent shadow-sm" : "font-medium text-muted"}`}
				>
					{l.toUpperCase()}
				</button>
			))}
		</div>
	);
}

export function Header({ onPanel, onHome }: { onPanel(p: Panel): void; onHome(): void }) {
	const { t } = useI18n();
	return (
		<header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
			<div className="mx-auto flex max-w-[1440px] flex-col gap-2.5 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-0">
				<div className="flex items-center justify-between gap-3">
					<button type="button" onClick={onHome} className="flex items-center gap-2.5 rounded-lg">
						<span className="grid size-8 place-items-center rounded-[9px] bg-accent text-on-accent"><Icon name="file" className="size-[18px]" /></span>
						<span className="text-[17px] font-bold">{t.app.title}</span>
					</button>
					<div className="flex items-center gap-3 sm:hidden">
						<button type="button" onClick={() => onPanel("about")} className="flex items-center gap-1.5 text-sm font-medium" aria-haspopup="dialog">
							<span className="text-ai"><Icon name="sparkles" strokeWidth={1.75} /></span>{t.app.aboutAi}
						</button>
						<LangSwitch />
					</div>
				</div>
				<nav className="flex items-center gap-5" aria-label="Site">
					<PrivacyStatus onOpen={() => onPanel("privacy")} />
					<button type="button" onClick={() => onPanel("about")} className="hidden items-center gap-1.5 text-sm font-medium sm:flex" aria-haspopup="dialog">
						<span className="text-ai"><Icon name="sparkles" strokeWidth={1.75} /></span>{t.app.aboutAi}
					</button>
					<span className="hidden sm:block"><LangSwitch /></span>
					{SOURCE_URL ? <a href={SOURCE_URL} className="hidden text-sm font-medium text-muted hover:text-text sm:block" rel="noreferrer">{t.app.source} ↗</a> : null}
				</nav>
			</div>
		</header>
	);
}
