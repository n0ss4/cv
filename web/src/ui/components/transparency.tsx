// The transparency panels (contracts/ui.md 11–13): where the CV goes and how
// that is enforced, what the AI is and is not, the exact prompts, and the live
// log of every look the AI took at the document.

import { CATALOGUE_ENTRIES } from "@domain/findings/catalogue";
import { SYSTEM_PROMPT } from "@app/prompts/system";
import { TASKS, type TaskContext } from "@app/prompts/tasks";
import { PROMPT_VERSION } from "@app/prompts/version";
import type { ToolCall } from "@domain/report/report";
import { useAnalysis } from "../app/AnalysisProvider";
import { fmt, useI18n } from "../i18n";
import { Button, Modal } from "./base";
import { SOURCE_URL } from "./Header";
import { Icon } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

function liveCsp(): string {
	return document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? "";
}

export function PrivacyPanel({ open, onClose }: { open: boolean; onClose(): void }) {
	const { t } = useI18n();
	const p = t.privacy;
	return (
		<Modal open={open} onClose={onClose} title={p.title} footer={<>{SOURCE_URL ? <a href={SOURCE_URL} rel="noreferrer" className="text-sm font-semibold text-accent">{p.sourceLink}</a> : <span />}<Button variant="secondary" onClick={onClose}>{t.app.close}</Button></>}>
			<div className="space-y-6 text-[15px]">
				<p className="text-muted">{p.lede}</p>
				<ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
					{p.rows.map((r) => (
						<li key={r.what} className="grid gap-2 bg-surface p-4 sm:grid-cols-[150px_160px_1fr] sm:items-center sm:gap-4">
							<span className="text-sm font-semibold">{r.what}</span>
							<span className="w-fit rounded-xl bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{r.where}</span>
							<span className="text-[13px] leading-relaxed text-muted">{r.kept}</span>
						</li>
					))}
				</ul>
				<section className="space-y-3">
					<h3 className="font-semibold">{p.enforcedTitle}</h3>
					<p className="text-sm leading-relaxed text-muted">{p.enforcedBody}</p>
					<pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-muted p-3.5 font-mono text-xs leading-relaxed text-accent">{liveCsp().split(";").map((s) => s.trim()).join(";\n")}</pre>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">{p.exceptionTitle}</h3>
					<p className="text-sm leading-relaxed text-muted">{p.exceptionBody}</p>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">{p.checkTitle}</h3>
					<ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{p.checkSteps.map((s) => <li key={s}>{s}</li>)}</ol>
				</section>
			</div>
		</Modal>
	);
}

export function AboutAiPanel({ open, onClose, onPrompts }: { open: boolean; onClose(): void; onPrompts(): void }) {
	const { t, lang } = useI18n();
	const { state, engine, services } = useAnalysis();
	const a = t.about;
	const facts = (engine ?? services.engines[0])?.facts;
	const cvLang = state.measured?.cvLanguage ?? null;
	const names = t.languageNames as Record<string, string>;
	const supported = facts?.languages ?? [];
	return (
		<Modal open={open} onClose={onClose} title={a.title} footer={<><button type="button" onClick={onPrompts} className="text-sm font-semibold text-ai">{a.viewPrompts}</button><Button variant="secondary" onClick={onClose}>{t.app.close}</Button></>}>
			<div className="space-y-6 text-[15px]">
				{facts ? (
					<div className="space-y-1.5 rounded-2xl bg-ai-soft p-4">
						<p className="text-[17px] font-semibold text-ai">{facts.model} · {facts.provider}</p>
						<p className="text-[13px] font-medium">
							{a.runsOn} · {fmt(a.status, { status: a.statusValues[state.engine.availability] })} · {fmt(a.promptsVersion, { version: PROMPT_VERSION })}
						</p>
					</div>
				) : null}
				<section className="space-y-2">
					<h3 className="font-semibold">{a.doesTitle}</h3>
					<ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{a.does.map((s) => <li key={s}>{s}</li>)}</ul>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">{a.doesntTitle}</h3>
					<ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{a.doesnt.map((s) => <li key={s}>{s}</li>)}</ul>
				</section>
				<section className="space-y-3">
					<h3 className="font-semibold">{a.wrongTitle}</h3>
					<p className="text-sm leading-relaxed text-muted">{a.wrongBody}</p>
					<div className="flex flex-wrap gap-2.5"><ProvenanceBadge kind="ai-verified" /><ProvenanceBadge kind="ai-unverified" /><ProvenanceBadge kind="measured" /></div>
				</section>
				<div className="space-y-1 rounded-xl bg-surface-muted p-3.5">
					{cvLang ? (
						<p className="text-sm font-semibold">
							{fmt(a.languageTitle, { language: names[cvLang] ?? cvLang })} {supported.includes(cvLang) ? a.languageSupported : a.languageUnsupported}
						</p>
					) : (
						<p className="text-sm font-semibold">{a.languageUnknown}</p>
					)}
					<p className="text-[13px] leading-relaxed text-muted">
						{fmt(a.languages, { list: new Intl.ListFormat(lang, { type: "conjunction" }).format(supported.map((l) => names[l] ?? l)) })}
					</p>
				</div>
				<section className="space-y-2">
					<h3 className="font-semibold">{a.formulaTitle}</h3>
					<p className="text-sm leading-relaxed text-muted">{a.formula}</p>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">{a.requirementsTitle}</h3>
					<p className="text-sm leading-relaxed text-muted">{a.requirements}</p>
				</section>
			</div>
		</Modal>
	);
}

// Placeholders that print as such, so a template reads as the real prompt.
const SAMPLE_CTX = {
	lang: "en",
	docInfo: "‹doc_info›",
	outline: "‹outline›",
	layoutFacts: "‹layout_facts›",
	measured: [],
	compactProfile: "‹verified profile›",
	jobText: "‹job posting›",
	jobTitle: "‹job title›",
	requirements: "‹requirements›",
} as unknown as TaskContext;

export function PromptsViewer({ open, onClose }: { open: boolean; onClose(): void }) {
	const { t, lang } = useI18n();
	const p = t.prompts;
	const block = "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-muted p-3.5 font-mono text-xs leading-relaxed";
	return (
		<Modal open={open} onClose={onClose} title={p.title} footer={<span />}>
			<div className="space-y-6">
				<p className="text-sm text-muted">{fmt(p.intro, { version: PROMPT_VERSION })}</p>
				<section className="space-y-2">
					<h3 className="font-semibold">{p.system}</h3>
					<pre className={block}>{SYSTEM_PROMPT}</pre>
				</section>
				{Object.values(TASKS).map((task) => (
					<section key={task.id} className="space-y-2">
						<h3 className="font-mono text-sm font-semibold text-ai">{task.id}</h3>
						<p className="text-sm"><strong>{p.purpose}:</strong> {task.purpose}</p>
						<p className="text-sm"><strong>{p.inputs}:</strong> {task.inputs}</p>
						<pre className={block}>{task.brief({ ...SAMPLE_CTX, lang })}{"\n\n— — —\n\n"}{task.answer({ ...SAMPLE_CTX, lang })}</pre>
					</section>
				))}
				<section className="space-y-2">
					<h3 className="font-semibold">{p.measuredRules}</h3>
					<ul className="space-y-1.5 text-sm">
						{CATALOGUE_ENTRIES.filter((c) => c.source === "measured").map((c) => (
							<li key={c.type}><code className="font-mono text-xs text-accent">{c.type}</code> — {c.definition}</li>
						))}
					</ul>
				</section>
			</div>
		</Modal>
	);
}

function LogEntry({ entry }: { entry: ToolCall }) {
	const { t, lang } = useI18n();
	const l = t.log;
	const task = entry.task === "setup" ? l.setup : (t.analysing.steps as Record<string, string>)[entry.task] ?? entry.task;
	const tone = entry.kind === "failure" ? "bg-fail-soft" : entry.kind === "retry" ? "bg-warn-soft" : entry.task === "setup" ? "bg-accent-soft/60" : "bg-surface-muted";
	const meta = entry.kind === "tool" ? `${task} · ${entry.task === "setup" ? "" : `${fmt(l.call, { n: entry.step })} · `}${fmt(l.ms, { ms: entry.ms })}`
		: entry.kind === "prompt" ? `${task} · ${l.answer}`
		: entry.kind === "retry" ? `${task} · ${fmt(l.retry, { message: entry.message ?? "" })}`
		: `${task} · ${fmt(l.failure, { message: entry.message ?? "" })}`;
	const result = entry.result === undefined ? "" : JSON.stringify(entry.result);
	return (
		<li className={`space-y-1 rounded-[10px] p-3 ${tone}`}>
			<p className="text-[11px] font-medium text-muted">{meta} <time className="sr-only">{new Date(entry.at).toLocaleTimeString(lang)}</time></p>
			{entry.tool ? <p className="font-mono text-xs font-medium text-ai">{entry.tool} {JSON.stringify(entry.args ?? {})}</p> : null}
			{result ? <p className="line-clamp-3 break-all font-mono text-xs">→ {result.length > 240 ? `${result.slice(0, 240)}…` : result}</p> : null}
		</li>
	);
}

export function AiLogDrawer({ open, onClose }: { open: boolean; onClose(): void }) {
	const { t } = useI18n();
	const { state } = useAnalysis();
	return (
		<Modal open={open} onClose={onClose} title={t.log.title} variant="drawer">
			<p className="mb-4 text-[13px] leading-relaxed text-muted">{t.log.intro}</p>
			{state.log.length ? (
				<ol className="space-y-3" aria-live="polite">{state.log.map((e, i) => <LogEntry key={i} entry={e} />)}</ol>
			) : (
				<p className="flex items-center gap-2 text-sm text-muted"><Icon name="info" />{t.log.empty}</p>
			)}
		</Modal>
	);
}
