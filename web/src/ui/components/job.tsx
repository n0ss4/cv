// The Job match tab (specs 004, 006): the detailed report for the posting in
// the chat's context. Summary → fix first → hard filters → exact keywords →
// every requirement with where and how to add it. It exists only while a
// posting is in context.

import { useMemo, useState } from "react";
import { presentJob, type Priority } from "@adapters/presenters/job";
import type { KeywordCheck, KnockoutResult, RequirementMatch } from "@domain/job/model";
import type { Report } from "@domain/report/report";
import { useAnalysis } from "../app/AnalysisProvider";
import { fmt, useI18n } from "../i18n";
import { Button, Notice } from "./base";
import { Icon } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

type Show = (refs: string[]) => void;

const OUTCOME = { meets: "bg-pass-soft text-pass", fails: "bg-fail-soft text-fail", "not-stated": "bg-warn-soft text-warn", unknown: "bg-surface-muted text-muted" } as const;
const STATUS = { matched: "bg-pass-soft text-pass", partial: "bg-warn-soft text-warn", missing: "bg-fail-soft text-fail" } as const;
const KEYWORD = { exact: "bg-pass-soft text-pass", variant: "bg-warn-soft text-warn", missing: "bg-fail-soft text-fail" } as const;
const VERDICT = { strong: "bg-pass-soft text-pass", close: "bg-warn-soft text-warn", gaps: "bg-fail-soft text-fail" } as const;

const chip = "shrink-0 rounded-md px-2 py-0.5 text-xs font-bold";
const card = "rounded-2xl border border-border bg-surface p-5";
const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function RefButton({ refs, onShow }: { refs: string[]; onShow: Show }) {
	if (!refs[0]) return null;
	return <button type="button" onClick={() => onShow(refs)} className="shrink-0 font-mono text-xs text-accent underline-offset-4 hover:underline">{refs[0]}</button>;
}

function Bar({ value, total, tone }: { value: number; total: number; tone: string }) {
	const pct = total ? (100 * value) / total : 0;
	return (
		<svg viewBox="0 0 100 8" preserveAspectRatio="none" className={`h-2 w-full ${tone}`} aria-hidden="true">
			<rect width="100" height="8" rx="4" className="fill-surface-muted" />
			<rect width={pct} height="8" rx="4" fill="currentColor" />
		</svg>
	);
}

function Summary({ report }: { report: Report }) {
	const { t } = useI18n();
	const j = t.job;
	const job = report.job!;
	const s = job.summary!;
	return (
		<section aria-labelledby="job-summary" className={`${card} grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center`}>
			<div className="text-center sm:pr-4">
				<p className="text-5xl font-bold">{s.percent}<span className="text-2xl">%</span></p>
				<p className="text-xs font-medium text-muted">{j.match}</p>
			</div>
			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-3">
					<h3 id="job-summary" className="text-lg font-bold">{j.summaryTitle}</h3>
					<span className={`rounded-xl px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${VERDICT[s.verdict]}`}>{j.verdict[s.verdict]}</span>
					<ProvenanceBadge kind="measured" />
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					<div className="space-y-1">
						<p className="text-sm font-medium">{fmt(j.required, { covered: fmtN(s.required.covered), total: s.required.total })}</p>
						<Bar value={s.required.covered} total={s.required.total} tone={s.required.covered === s.required.total ? "text-pass" : "text-warn"} />
					</div>
					{s.preferred.total ? (
						<div className="space-y-1">
							<p className="text-sm font-medium">{fmt(j.preferred, { covered: fmtN(s.preferred.covered), total: s.preferred.total })}</p>
							<Bar value={s.preferred.covered} total={s.preferred.total} tone="text-accent" />
						</div>
					) : null}
				</div>
				{job.title && job.titleInCv !== null ? <p className="text-sm">{job.titleInCv ? j.titleIn : fmt(j.titleNotIn, { title: job.title })}</p> : null}
				<p className="text-xs text-muted">{j.formula}</p>
			</div>
		</section>
	);
}

function KnockoutRow({ k, onShow }: { k: KnockoutResult; onShow: Show }) {
	const { t } = useI18n();
	const j = t.job;
	const detail = fmt((j.detail as Record<string, string>)[k.detail.key] ?? "", k.detail.params);
	return (
		<li className="space-y-2 rounded-xl border border-border bg-surface p-4">
			<div className="flex flex-wrap items-center gap-3">
				<span className={`${chip} ${OUTCOME[k.outcome]}`}>{j.outcome[k.outcome]}</span>
				<span className="text-xs font-medium text-muted">{j.kind[k.kind]}</span>
				<p className="min-w-0 flex-1 font-medium">{k.requirement.text}</p>
				<RefButton refs={k.evidence.map((e) => String(e.ref))} onShow={onShow} />
				<ProvenanceBadge kind="measured" />
			</div>
			<p className="text-sm text-muted">{detail}</p>
			{k.years && k.years.ranges.length ? (
				<div className="text-xs text-muted">
					<p>{j.yearsHow}</p>
					<ul className="mt-1 flex flex-wrap gap-2 font-mono">{k.years.ranges.map((r) => <li key={r.from} className="rounded bg-surface-muted px-2 py-0.5">{r.from} → {r.to}</li>)}</ul>
					{k.years.undated ? <p className="mt-1">{fmt(j.undatedRoles, { n: k.years.undated })}</p> : null}
				</div>
			) : null}
		</li>
	);
}

function KeywordRow({ k, onShow }: { k: KeywordCheck; onShow: Show }) {
	const { t } = useI18n();
	const j = t.job;
	return (
		<li className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0">
			<span className={`${chip} ${KEYWORD[k.status]}`}>{j.keywordStatus[k.status]}</span>
			<span className="font-semibold">{k.term}</span>
			<span className="text-xs text-muted">{j.importance[k.importance]}</span>
			<span className="min-w-0 flex-1 text-sm text-muted">{k.status === "variant" ? fmt(j.variantAdvice, { cv: k.cvTerm ?? "", term: k.term }) : ""}</span>
			{k.ref ? <RefButton refs={[k.ref]} onShow={onShow} /> : null}
			<ProvenanceBadge kind={k.provenance} />
		</li>
	);
}

function CopyButton({ text }: { text: string }) {
	const { t } = useI18n();
	const [done, setDone] = useState(false);
	return (
		<Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => void navigator.clipboard?.writeText(text).then(() => setDone(true))}>
			<Icon name="copy" className="size-3.5" />{done ? t.job.copied : t.job.copy}
		</Button>
	);
}

function RequirementRow({ m, onShow }: { m: RequirementMatch; onShow: Show }) {
	const { t } = useI18n();
	const j = t.job;
	const s = m.suggestion;
	const verified = m.evidence.filter((e) => e.verified).map((e) => String(e.ref));
	return (
		<li className="space-y-3 rounded-xl border border-border bg-surface p-4">
			<div className="flex flex-wrap items-center gap-3">
				<span className={`${chip} ${STATUS[m.status]}`}>{j.status[m.status]}</span>
				<span className="text-xs font-medium text-muted">{j.importance[m.requirement.importance]}</span>
				<p className="min-w-0 flex-1 font-medium">{m.requirement.text}</p>
				<RefButton refs={verified} onShow={onShow} />
				<ProvenanceBadge kind={m.status === "missing" || verified.length ? "ai-verified" : "ai-unverified"} />
			</div>
			{s ? (
				<div className="space-y-2 rounded-xl bg-ai-soft/60 p-3.5">
					<div className="flex flex-wrap items-center gap-2">
						{s.target ? <p className="text-sm font-semibold">{j.target[s.target]}</p> : null}
						<span className="ml-auto"><ProvenanceBadge kind={s.provenance} /></span>
					</div>
					{s.phrasing ? (
						<>
							{s.sourceRef ? (
								<p className="text-xs text-muted">
									{fmt(j.basedOn, { ref: s.sourceRef })} <span className="font-mono">{s.sourceLine}</span>
								</p>
							) : null}
							<div className="flex flex-wrap items-start gap-3">
								<p className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-sm"><span className="sr-only">{j.suggestion}: </span>{s.phrasing}</p>
								<CopyButton text={s.phrasing} />
							</div>
						</>
					) : (
						<p className="text-sm text-muted">
							{s.rejected.length && !s.rejected.includes("source") ? `${fmt(j.withheld, { added: s.rejected.join(", ") })} ` : ""}{j.onlyIfTrue}
						</p>
					)}
				</div>
			) : null}
		</li>
	);
}

function PriorityRow({ p, onShow }: { p: Priority; onShow: Show }) {
	return p.kind === "knockout" ? <KnockoutRow k={p.result} onShow={onShow} /> : <RequirementRow m={p.match} onShow={onShow} />;
}

/** The detailed report for the posting in context; the posting itself is added, changed and removed in the chat. */
export function JobMatch({ report, onShow }: { report: Report; onShow: Show }) {
	const { t } = useI18n();
	const { state } = useAnalysis();
	const j = t.job;
	const view = useMemo(() => (report.job ? presentJob(report.job) : null), [report.job]);
	if (!view) return null;
	const title = state.chat.posting?.title || view.job.title || t.chat.postingUntitled;

	return (
		<div className="space-y-6" aria-live="polite">
			<div className="space-y-1">
				<h2 className="text-[22px] font-bold">{fmt(j.reportTitle, { title })}</h2>
				<p className="text-sm text-muted">{j.reportIntro}</p>
			</div>
			{view.job.aiRan ? null : <Notice tone="warning" title={j.noAi} />}
			{view.job.trimmed ? <Notice title={j.trimmed} /> : null}
			{view.job.summary ? <Summary report={report} /> : null}
			{view.job.aiRan ? (
				<section className="space-y-3" aria-labelledby="job-priorities">
					<h3 id="job-priorities" className="text-lg font-bold">{j.prioritiesTitle}</h3>
					{view.priorities.length ? <ul className="space-y-3">{view.priorities.map((p) => <PriorityRow key={p.key} p={p} onShow={onShow} />)}</ul> : <p className="text-sm text-muted">{j.prioritiesEmpty}</p>}
				</section>
			) : null}
			{view.job.knockouts.length ? (
				<section className="space-y-3" aria-labelledby="job-knockouts">
					<div>
						<h3 id="job-knockouts" className="text-lg font-bold">{j.knockoutsTitle}</h3>
						<p className="text-sm text-muted">{j.knockoutsIntro}</p>
					</div>
					<ul className="space-y-3">{view.job.knockouts.map((k, i) => <KnockoutRow key={i} k={k} onShow={onShow} />)}</ul>
				</section>
			) : null}
			{view.job.keywords.length ? (
				<section className="space-y-3" aria-labelledby="job-keywords">
					<div>
						<h3 id="job-keywords" className="text-lg font-bold">{j.keywordsTitle}</h3>
						<p className="text-sm text-muted">{j.keywordsIntro}</p>
					</div>
					<ul className={card}>{view.job.keywords.map((k) => <KeywordRow key={`${k.group ?? ""}-${k.term}`} k={k} onShow={onShow} />)}</ul>
				</section>
			) : null}
			{view.requirements.length ? (
				<section className="space-y-3" aria-labelledby="job-requirements">
					<h3 id="job-requirements" className="text-lg font-bold">{j.requirementsTitle}</h3>
					<ul className="space-y-3">{view.requirements.map((m, i) => <RequirementRow key={i} m={m} onShow={onShow} />)}</ul>
				</section>
			) : null}
		</div>
	);
}
