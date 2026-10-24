// Results building blocks: verdict + score ring, category bars, finding cards,
// the rescan banner and the grouped "all checks" list. All sizes that depend
// on data are SVG attributes, never style attributes (the CSP forbids those).

import type { Category, Severity } from "@domain/findings/types";
import type { RescanDiff } from "@domain/rescan/diff";
import type { CategoryGroup, FindingView, ReportView } from "@adapters/presenters/report";
import { CAPS } from "@domain/scoring/score";
import { fmt, useI18n } from "../i18n";
import { Icon } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

const scoreTone = (score: number) => (score >= 90 ? "text-pass" : score >= 60 ? "text-warn" : "text-fail");
const verdictTone: Record<string, string> = {
	ready: "bg-pass-soft text-pass",
	"needs-work": "bg-warn-soft text-warn",
	"not-ready": "bg-fail-soft text-fail",
	unreadable: "bg-fail-soft text-fail",
	incomplete: "bg-surface-muted text-muted",
	"measured-only": "bg-accent-soft text-accent",
};

export function ScoreRing({ score }: { score: number }) {
	const { t } = useI18n();
	const r = 54;
	const c = 2 * Math.PI * r;
	return (
		<div className="relative size-32 shrink-0">
			<svg viewBox="0 0 128 128" className={`size-32 -rotate-90 ${scoreTone(score)}`} aria-hidden="true">
				<circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-surface-muted" />
				<circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" stroke="currentColor" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
			</svg>
			<div className="absolute inset-0 grid place-content-center text-center">
				<span className="text-4xl font-bold">{score}</span>
				<span className="text-xs font-medium text-muted">{t.results.of100}</span>
			</div>
		</div>
	);
}

export function VerdictCard({ view, onFormula }: { view: ReportView; onFormula(): void }) {
	const { t } = useI18n();
	const r = t.results;
	const worst: Severity | null = view.counts.critical ? "critical" : view.counts.major ? "major" : null;
	return (
		<section aria-labelledby="verdict" className="flex flex-col items-center gap-5 rounded-[18px] border border-border bg-surface p-6 text-center sm:flex-row sm:text-left">
			{view.overall !== null ? <ScoreRing score={view.overall} /> : null}
			<div className="space-y-2">
				<span className={`inline-block rounded-xl px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${verdictTone[view.verdict]}`}>{r.verdict[view.verdict]}</span>
				<h1 id="verdict" tabIndex={-1} className="text-xl font-bold leading-tight outline-none">{r.headline[view.verdict]}</h1>
				<p className="text-sm text-muted">{fmt(r.counts, view.counts)}</p>
				{view.overall === null && view.verdict === "measured-only" ? <p className="text-[13px] text-muted">{r.noScoreMeasured}</p> : null}
				{view.verdict === "incomplete" ? <p className="text-[13px] text-muted">{r.noScoreIncomplete}</p> : null}
				{view.overall !== null ? (
					<p className="text-[13px] font-medium text-accent">
						{view.capped && worst ? `${fmt(r.capped, { cap: worst === "critical" ? CAPS["not-ready"] : CAPS["needs-work"], severity: r.severity[worst].toLowerCase() })} ` : ""}
						<button type="button" onClick={onFormula} className="font-medium underline-offset-4 hover:underline">{r.formula}</button>
					</p>
				) : null}
			</div>
		</section>
	);
}

export function CategoryBars({ groups }: { groups: CategoryGroup[] }) {
	const { t } = useI18n();
	const scored = groups.filter((g) => g.score !== null);
	if (!scored.length) return null;
	return (
		<section aria-labelledby="by-category" className="flex-1 rounded-[18px] border border-border bg-surface p-6">
			<h2 id="by-category" className="mb-3 text-[15px] font-semibold">{t.results.byCategory}</h2>
			<dl className="space-y-3">
				{scored.map((g) => (
					<div key={g.category} className="grid grid-cols-[minmax(110px,150px)_1fr_32px] items-center gap-3">
						<dt className="text-[13px] font-medium">{t.results.categories[g.category]}</dt>
						<svg viewBox="0 0 100 8" preserveAspectRatio="none" className={`h-2 w-full ${scoreTone(g.score!)}`} aria-hidden="true">
							<rect width="100" height="8" rx="4" className="fill-surface-muted" />
							<rect width={g.score!} height="8" rx="4" fill="currentColor" />
						</svg>
						<dd className="text-right text-[13px] font-semibold">{g.score}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

const STRIPE: Record<Severity, string> = { critical: "bg-fail", major: "bg-warn", minor: "bg-muted" };
const CHIP: Record<Severity, string> = { critical: "bg-fail-soft text-fail", major: "bg-warn-soft text-warn", minor: "bg-surface-muted text-muted" };

export function FindingCard({ finding, onShowInAts, headingLevel = 3 }: { finding: FindingView; onShowInAts?(refs: string[]): void; headingLevel?: 3 | 4 }) {
	const { t } = useI18n();
	const r = t.results;
	const H = headingLevel === 3 ? "h3" : "h4";
	const located = finding.evidence.filter((e) => e.ref);
	return (
		<article className="flex overflow-hidden rounded-2xl border border-border bg-surface">
			<span className={`w-[5px] shrink-0 ${STRIPE[finding.severity]}`} aria-hidden="true" />
			<div className="min-w-0 flex-1 space-y-2.5 p-5">
				<div className="flex flex-wrap items-center gap-2.5">
					<span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${CHIP[finding.severity]}`}>{r.severity[finding.severity]}</span>
					<span className="text-[13px] font-medium text-muted">{r.categories[finding.category as Category]}</span>
					{finding.searchable ? <span className="inline-flex items-center gap-1 text-[12px] text-muted"><Icon name="search" className="size-3" />{r.searchable}</span> : null}
					<span className="ml-auto"><ProvenanceBadge kind={finding.provenance} /></span>
				</div>
				<H className="text-[17px] font-semibold">{finding.title}</H>
				<p className="text-sm leading-relaxed text-muted">{finding.why}</p>
				<p className="text-sm font-medium">{finding.fix.startsWith(r.fixLabel) ? finding.fix : `${r.fixLabel} ${finding.fix}`}</p>
				{located.length ? (
					<div className="flex flex-wrap items-center gap-3">
						{located.slice(0, 2).map((e) => (
							<span key={e.ref} className={`inline-flex max-w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-mono text-xs ${e.verified ? "bg-highlight/60" : "border border-ai/50 bg-surface-muted text-muted"}`}>
								<span className="shrink-0 text-muted">{e.ref}</span>
								<span className="truncate">{e.quote ?? ""}{e.verified ? "" : ` — ${r.notFoundOnLine}`}</span>
							</span>
						))}
						{onShowInAts && located.some((e) => e.verified) ? (
							<button type="button" onClick={() => onShowInAts(located.filter((e) => e.verified).map((e) => e.ref))} className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
								{r.showInAts}
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</article>
	);
}

export function RescanBanner({ diff }: { diff: RescanDiff }) {
	const { t } = useI18n();
	const before = diff.previous.overall;
	const after = diff.current.overall;
	const better = before !== null && after !== null ? after >= before : diff.resolved.length >= diff.added.length;
	const params = { before: before ?? "–", after: after ?? "–", resolved: diff.resolved.length, added: diff.added.length, unchanged: diff.unchanged.length };
	return (
		<div role="status" className={`flex items-center gap-3 rounded-[14px] px-[18px] py-3.5 text-sm font-medium ${better ? "bg-pass-soft text-pass" : "bg-warn-soft text-warn"}`}>
			<Icon name="trendingUp" className="size-5 shrink-0" />
			<span>{fmt(before !== null && after !== null ? t.results.rescan : t.results.rescanNoScore, params)}</span>
		</div>
	);
}

export function AllChecks({ groups, format, onShowInAts }: { groups: CategoryGroup[]; format: string; onShowInAts(refs: string[]): void }) {
	const { t } = useI18n();
	const r = t.results;
	return (
		<div className="space-y-8">
			{groups.map((g) => (
				<section key={g.category} aria-labelledby={`cat-${g.category}`} className="space-y-3">
					<h3 id={`cat-${g.category}`} className="flex items-baseline gap-3 text-lg font-bold">
						{r.categories[g.category]}
						{g.score !== null ? <span className={`text-sm font-semibold ${scoreTone(g.score)}`}>{g.score}</span> : null}
					</h3>
					{g.attention.length ? (
						<div className="space-y-3">
							<p className="text-sm font-semibold">{r.needsAttention} · {g.attention.length}</p>
							{g.attention.map((f) => <FindingCard key={f.key} finding={f} onShowInAts={onShowInAts} headingLevel={4} />)}
						</div>
					) : null}
					{g.passed.length ? (
						<details className="rounded-xl border border-border bg-surface p-4">
							<summary className="cursor-pointer text-sm font-semibold text-pass">{r.passed} · {g.passed.length}</summary>
							<ul className="mt-3 space-y-2">{g.passed.map((c) => <CheckRow key={c.type} title={c.title} source={c.source} />)}</ul>
						</details>
					) : null}
					{g.notApplicable.length ? (
						<div className="rounded-xl bg-surface-muted p-4">
							<p className="mb-2 text-sm font-semibold text-muted">{fmt(r.notApplicable, { format: format.toUpperCase() })}</p>
							<ul className="space-y-2">{g.notApplicable.map((c) => <CheckRow key={c.type} title={c.title} source={c.source} />)}</ul>
						</div>
					) : null}
					{g.notChecked.length ? (
						<div className="rounded-xl bg-surface-muted p-4">
							<p className="mb-2 text-sm font-semibold text-muted">{r.notChecked}</p>
							<ul className="space-y-2">{g.notChecked.map((c) => <CheckRow key={c.type} title={c.title} source={c.source} />)}</ul>
						</div>
					) : null}
				</section>
			))}
		</div>
	);
}

function CheckRow({ title, source }: { title: string; source: "measured" | "ai" }) {
	return (
		<li className="flex items-center justify-between gap-3 text-sm">
			<span>{title}</span>
			<ProvenanceBadge kind={source === "measured" ? "measured" : "ai"} />
		</li>
	);
}
