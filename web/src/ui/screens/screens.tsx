// The screens of contracts/ui.md, selected by the analysis phase.

import { useEffect, useId, useMemo, useState } from "react";
import { presentReport } from "@adapters/presenters/report";
import { compareRescan } from "@app/usecases/compareRescan";
import type { Report } from "@domain/report/report";
import { useAnalysis } from "../app/AnalysisProvider";
import { fmt, useI18n } from "../i18n";
import { Button, Modal, Notice, Tabs, useWide } from "../components/base";
import { DropZone, megabytes } from "../components/DropZone";
import { AtsView, ProfileView } from "../components/evidence";
import { JobMatch } from "../components/job";
import { ChatPanel } from "../components/chat";
import { Icon, type IconName } from "../components/icons";
import { ProvenanceBadge } from "../components/ProvenanceBadge";
import { AllChecks, CategoryBars, FindingCard, RescanBanner, VerdictCard } from "../components/results";
import { StepList } from "../components/StepList";

type OpenPanel = (p: "privacy" | "about" | "log") => void;

function AvailabilityNotice() {
	const { t } = useI18n();
	const { state } = useAnalysis();
	const n = t.start.notice;
	const a = state.engine.availability;
	if (a === "available") return null;
	if (a === "downloadable") return <Notice title={n.downloadable.title}>{n.downloadable.body}</Notice>;
	if (a === "downloading") return <Notice title={n.downloading.title}>{n.downloading.body}</Notice>;
	const text = a === "unavailable" ? n.unavailable : n.noApi;
	return <Notice tone="warning" title={text.title}>{text.body}</Notice>;
}

const PRIVACY_ICONS: IconName[] = ["window", "cpu", "databaseOff"];

export function StartScreen({ onPanel }: { onPanel: OpenPanel }) {
	const { t } = useI18n();
	const { state } = useAnalysis();
	const s = t.start;
	const noAi = state.engine.availability === "no-api" || state.engine.availability === "unavailable";
	return (
		<div className="mx-auto flex max-w-[720px] flex-col gap-7 px-4 pb-16 pt-10 sm:pt-[72px]">
			{state.notice ? <Notice title={state.notice === "cleared" ? t.app.cleared : t.analysing.cancelled} role="status" /> : null}
			<div className="space-y-5 sm:text-center">
				<h1 className="text-[30px] font-bold leading-[1.15] tracking-tight sm:text-[46px]">{s.headline}</h1>
				<p className="text-base leading-relaxed text-muted sm:text-lg">{s.lede}</p>
			</div>
			<AvailabilityNotice />
			<DropZone />
			<section aria-labelledby="privacy-summary" className="space-y-3.5 rounded-2xl bg-accent-soft/60 p-5">
				<div className="flex items-center justify-between gap-3">
					<h2 id="privacy-summary" className="text-[15px] font-semibold">{s.privacyTitle}</h2>
					<button type="button" onClick={() => onPanel("privacy")} className="text-sm font-medium text-accent">{s.privacyHow}</button>
				</div>
				<ul className="grid gap-4 sm:grid-cols-3 sm:gap-5">
					{s.privacy.map((p, i) => (
						<li key={p.title} className="flex gap-2.5">
							<span className="mt-0.5 text-accent"><Icon name={PRIVACY_ICONS[i]!} className="size-5" strokeWidth={1.75} /></span>
							<div>
								<p className="text-sm font-semibold">{p.title}</p>
								<p className="text-[13px] leading-relaxed text-muted">{p.body}</p>
							</div>
						</li>
					))}
				</ul>
			</section>
			<section aria-labelledby="what-we-check" className="space-y-3.5">
				<h2 id="what-we-check" className="text-[15px] font-semibold">{s.checksTitle}</h2>
				<ul className="grid gap-3 sm:grid-cols-3">
					{s.checks.map((c) => (
						<li key={c.title} className={`space-y-2 rounded-[14px] border border-border bg-surface p-4 ${noAi && c.source === "ai" ? "opacity-55" : ""}`}>
							<ProvenanceBadge kind={c.source === "measured" ? "measured" : "ai"} />
							<p className="text-sm font-semibold">{c.title}</p>
							<p className="text-[13px] leading-relaxed text-muted">{c.body}</p>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}

export function ConsentDialog() {
	const { t } = useI18n();
	const { state, consent, engine } = useAnalysis();
	const c = t.consent;
	const facts = engine?.facts;
	return (
		<Modal
			open={state.phase === "consent"}
			onClose={() => consent(false)}
			title={c.title}
			footer={<><span /><div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => consent(false)}>{c.decline}</Button><Button onClick={() => consent(true)}>{c.accept}</Button></div></>}
		>
			<div className="space-y-4">
				<p className="text-[15px] leading-relaxed text-muted">{c.body}</p>
				<ul className="list-disc space-y-1.5 rounded-xl bg-surface-muted py-4 pl-9 pr-4 text-sm leading-relaxed">
					{c.facts.map((f) => <li key={f}>{fmt(f, { size: facts?.downloadSize ?? "", disk: facts?.diskSpace ?? "" })}</li>)}
				</ul>
			</div>
		</Modal>
	);
}

export function AnalysingScreen({ onPanel }: { onPanel: OpenPanel }) {
	const { t } = useI18n();
	const { state, cancel } = useAnalysis();
	return (
		<div className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 pb-16 pt-10 sm:pt-[72px]">
			<div className="space-y-2 text-center">
				<h1 className="break-words text-2xl font-bold sm:text-[28px]">{fmt(t.analysing.title, { name: state.file?.name ?? "" })}</h1>
				<p className="text-[15px] text-muted">{t.analysing.subtitle}</p>
			</div>
			<StepList steps={state.steps} />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<button type="button" onClick={() => onPanel("log")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ai">
					<Icon name="sparkles" strokeWidth={1.75} />{t.analysing.seeLog}
				</button>
				<Button variant="secondary" onClick={cancel}>{t.analysing.cancel}</Button>
			</div>
			<p className="text-center text-[13px] text-muted">{t.analysing.cancelNote}</p>
		</div>
	);
}

export function ErrorScreen() {
	const { t } = useI18n();
	const { state, services } = useAnalysis();
	const code = state.error ?? "unknown";
	const message = fmt((t.errors as Record<string, string>)[code] ?? t.errors.unknown, {
		formats: services.formats.labels().join(", "),
		size: megabytes(services.formats.maxBytes()),
	});
	return (
		<div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 pb-16 pt-10 sm:pt-[72px]">
			<Notice tone="error" title={message} role="alert">{state.file?.name}</Notice>
			<DropZone />
		</div>
	);
}

type Tab = "overview" | "checks" | "profile" | "ats" | "job";

export function ResultsScreen({ report, onPanel, onFormula }: { report: Report; onPanel: OpenPanel; onFormula(): void }) {
	const { t, lang } = useI18n();
	const { state, clear, engine } = useAnalysis();
	const [tab, setTab] = useState<Tab>("overview");
	const [highlight, setHighlight] = useState<string[]>([]);
	// The chat (spec 006): docked beside the report when wide (it can be
	// collapsed), full screen on narrow screens. Either way a floating button
	// brings it back.
	const wide = useWide();
	const [panelOpen, setPanelOpen] = useState(true);
	const [sheetOpen, setSheetOpen] = useState(false);
	const docked = wide && panelOpen;
	const chatTitle = useId();
	const view = useMemo(() => presentReport(report, lang), [report, lang]);
	const diff = useMemo(() => (state.previous ? compareRescan(state.previous, report) : null), [state.previous, report]);
	const lines = state.measured?.index.lines ?? [];
	const cvLang = state.measured?.cvLanguage;
	const supported = engine?.facts.languages ?? [];
	const names = t.languageNames as Record<string, string>;

	useEffect(() => {
		document.getElementById("verdict")?.focus();
	}, [report.id]);

	const showInAts = (refs: string[]) => {
		setSheetOpen(false);
		setHighlight(refs);
		setTab("ats");
		document.getElementById("results-tabs")?.scrollIntoView?.({ block: "start" });
	};
	const chatActions = {
		onShow: showInAts,
		onOpenJob: () => {
			setSheetOpen(false);
			setTab("job");
			document.getElementById("results-tabs")?.scrollIntoView?.({ block: "start" });
		},
	};

	// The Job match tab is the detailed report of the posting in the chat's
	// context, so it exists only while there is one (spec 006).
	const posting = state.chat.posting && report.job ? state.chat.posting : null;
	const tabs: { id: Tab; label: string }[] = [
		{ id: "overview", label: t.results.tabs.overview },
		{ id: "checks", label: t.results.tabs.checks },
		{ id: "profile", label: t.results.tabs.profile },
		{ id: "ats", label: t.results.tabs.ats },
		...(posting ? [{ id: "job" as const, label: posting.percent !== null ? fmt(t.job.tabPercent, { percent: posting.percent }) : t.results.tabs.job }] : []),
	];
	const shown: Tab = tab === "job" && !posting ? "overview" : tab;

	return (
		<div className={docked ? "grid grid-cols-[minmax(0,1fr)_clamp(22.5rem,30vw,27.5rem)]" : ""}>
			{/* A container: the report lays itself out by the width it gets, chat open or not. */}
			<div className="@container min-w-0">
				<div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
					{state.error === "model" ? <Notice tone="warning" title={t.errors.model} role="alert" /> : null}
					{diff ? <RescanBanner diff={diff} /> : null}
					{cvLang && engine && report.profile && !supported.includes(cvLang) ? (
						<Notice tone="warning" title={fmt(t.results.languageNote, { language: names[cvLang] ?? cvLang })} />
					) : null}
					<div className="flex flex-col gap-5 @3xl:flex-row">
						<div className="@3xl:w-[420px] @3xl:shrink-0"><VerdictCard view={view} onFormula={onFormula} /></div>
						<CategoryBars groups={view.groups} />
					</div>
					<div id="results-tabs" className="scroll-mt-20">
						<Tabs<Tab> tabs={tabs} value={shown} onChange={setTab} label={t.results.tabs.overview} />
					</div>
					<div id={`panel-${shown}`} role="tabpanel" aria-labelledby={`tab-${shown}`} className="min-h-40">
						{shown === "overview" ? (
							<section className="space-y-3.5" aria-labelledby="fix-first">
								<h2 id="fix-first" className="text-[22px] font-bold">{t.results.fixFirst}</h2>
								{view.fixFirst.length ? view.fixFirst.map((f) => <FindingCard key={f.key} finding={f} onShowInAts={showInAts} />) : <p className="text-muted">{t.results.fixFirstEmpty}</p>}
								{view.strengths.length ? (
									<div className="rounded-2xl bg-pass-soft p-4">
										<p className="text-sm font-semibold text-pass">{t.results.strengths}</p>
										<ul className="mt-1 text-sm">{view.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
									</div>
								) : null}
							</section>
						) : null}
						{shown === "checks" ? <AllChecks groups={view.groups} format={report.document.format} onShowInAts={showInAts} /> : null}
						{shown === "profile" ? <ProfileView profile={report.profile} onShow={showInAts} /> : null}
						{shown === "ats" ? <AtsView lines={lines} highlight={highlight} /> : null}
						{shown === "job" ? <JobMatch report={report} onShow={showInAts} /> : null}
					</div>
					<section aria-label={t.results.another} className="grid gap-4 border-t border-border pt-6 @2xl:grid-cols-[1fr_auto] @2xl:items-start">
						<DropZone compact />
						<div className="flex flex-col gap-3">
							<button type="button" onClick={() => onPanel("log")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ai">
								<Icon name="sparkles" strokeWidth={1.75} />{t.log.title}
							</button>
							<Button variant="secondary" onClick={clear}><Icon name="trash" />{t.app.clear}</Button>
						</div>
					</section>
				</div>
			</div>
			{docked ? (
				// Exactly the height under the sticky header: the composer is always in view.
				<aside aria-labelledby={chatTitle} className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-border">
					<ChatPanel actions={chatActions} onClose={() => setPanelOpen(false)} titleId={chatTitle} />
				</aside>
			) : (
				<button type="button" onClick={() => (wide ? setPanelOpen(true) : setSheetOpen(true))} className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent shadow-lg shadow-accent/25 hover:bg-accent/90">
					<Icon name="sparkles" strokeWidth={1.75} />{t.chat.open}
				</button>
			)}
			{wide ? null : (
				<Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.chat.title} variant="fullscreen" labelledBy={chatTitle}>
					<ChatPanel actions={chatActions} onClose={() => setSheetOpen(false)} closeKind="close" titleId={chatTitle} />
				</Modal>
			)}
		</div>
	);
}
