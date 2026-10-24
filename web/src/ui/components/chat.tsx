// The chat with your CV (specs 005, 006): one panel docked beside the report
// (full screen on narrow screens). Anatomy, top to bottom: header, context
// (the CV and the posting it talks about), the conversation (the only part
// that scrolls), and the composer, always in view.
//
// Three voices, each labelled: the user, the on-device AI (citations verified
// or not), and the page (computed messages and cards, never written by the
// model). The posting in context is shared with the Job match tab.

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Card, ChatMessage, PageEvent, Rewrite } from "@domain/chat/model";
import type { JobMatch } from "@domain/job/model";
import { useAnalysis } from "../app/AnalysisProvider";
import { fmt, useI18n } from "../i18n";
import type { Strings } from "../i18n/en";
import { Button } from "./base";
import { Icon, type IconName } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

type Show = (refs: string[]) => void;
type ChatStrings = Strings["chat"];

export interface ChatActions {
	/** Show CV lines in the report's ATS view. */
	onShow: Show;
	/** Open the Job match tab. */
	onOpenJob(): void;
}

const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const chip = "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold";
const OUTCOME = { meets: "bg-pass-soft text-pass", fails: "bg-fail-soft text-fail", "not-stated": "bg-warn-soft text-warn", unknown: "bg-surface-muted text-muted" } as const;
const STATUS = { matched: "bg-pass-soft text-pass", partial: "bg-warn-soft text-warn", missing: "bg-fail-soft text-fail" } as const;
const VERDICT = { strong: "bg-pass-soft text-pass", close: "bg-warn-soft text-warn", gaps: "bg-fail-soft text-fail" } as const;
const CARD_ROWS = 5;
const linkButton = "text-[13px] font-semibold text-accent underline-offset-4 hover:underline";
const iconButton = "grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-40";

function CopyText({ text }: { text: string }) {
	const { t } = useI18n();
	const [done, setDone] = useState(false);
	return (
		<div className="space-y-1">
			<Button variant="secondary" className="min-h-8 px-3 py-1 text-[13px]" onClick={() => void navigator.clipboard?.writeText(text).then(() => setDone(true))}>
				<Icon name={done ? "check" : "copy"} className="size-3.5" />{done ? t.chat.copied : t.chat.copy}
			</Button>
			{done ? <p role="status" className="text-xs text-muted">{t.chat.copiedHint}</p> : null}
		</div>
	);
}

/** The frame every card in a message shares. */
function Block({ title, badge, action, children }: { title: string; badge?: ReactNode; action?: ReactNode; children: ReactNode }) {
	return (
		<div className="space-y-2.5 rounded-xl border border-border bg-bg p-3">
			<div className="flex items-center gap-2">
				<p className="text-[13px] font-semibold">{title}</p>
				<span className="ml-auto flex items-center gap-2">{action}{badge}</span>
			</div>
			{children}
		</div>
	);
}

function RewriteCard({ r, current, onShow }: { r: Rewrite; current: boolean; onShow: Show }) {
	const { t } = useI18n();
	const c = t.chat;
	const withheld = r.added.includes("source")
		? c.withheldSource
		: r.postingMissing.length
			? fmt(c.withheldPosting, { terms: r.postingMissing.join(", ") })
			: fmt(c.withheld, { added: r.added.join(", ") });
	const show = r.sourceRef && current
		? <button type="button" onClick={() => onShow([r.sourceRef!])} className={`inline-flex items-center gap-1 ${linkButton}`}><Icon name="locate" className="size-3.5" />{c.showLine}</button>
		: null;
	return (
		<Block title={c.rewriteTitle} action={show}>
			{r.sourceRef ? (
				<p className="text-xs leading-5 text-muted">
					{fmt(c.original, { ref: r.sourceRef })} {r.sourceLine}{current ? "" : ` (${c.previousVersion})`}
				</p>
			) : null}
			{r.text ? (
				<>
					<p className="rounded-lg border border-ai/25 bg-surface px-3 py-2 text-sm leading-6">{r.text}</p>
					<CopyText text={r.text} />
				</>
			) : (
				<p className="text-[13px] leading-5 text-muted">{withheld}</p>
			)}
		</Block>
	);
}

function More({ n }: { n: number }) {
	const { t } = useI18n();
	return n > 0 ? <p className="text-xs text-muted">{fmt(t.chat.card.more, { n })}</p> : null;
}

/** A card the page renders from its own comparison; the model only chose the kind. */
function PageCard({ card, onOpenJob }: { card: Card; onOpenJob(): void }) {
	const { t } = useI18n();
	const k = t.chat.card;
	const j = t.job;
	const job: JobMatch = card.job;
	const frame = (title: string, body: ReactNode) => (
		<Block title={title} badge={<ProvenanceBadge kind="measured" />}>
			{body}
			<button type="button" onClick={onOpenJob} className={linkButton}>{t.chat.openJob} →</button>
		</Block>
	);
	const knockoutRow = (x: JobMatch["knockouts"][number], i: number) => (
		<li key={i} className="flex items-start gap-2"><span className={`${chip} ${OUTCOME[x.outcome]}`}>{j.outcome[x.outcome]}</span><span className="min-w-0">{x.requirement.text}</span></li>
	);
	if (card.kind === "fit" && job.summary) {
		const s = job.summary;
		return frame(k.fit, (
			<>
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<p className="text-[28px] font-bold leading-none">{s.percent}<span className="text-base">%</span></p>
					<span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${VERDICT[s.verdict]}`}>{j.verdict[s.verdict]}</span>
				</div>
				<ul className="space-y-1.5 text-[13px] leading-5">
					<li>{fmt(j.required, { covered: fmtN(s.required.covered), total: s.required.total })}{s.preferred.total ? ` · ${fmt(j.preferred, { covered: fmtN(s.preferred.covered), total: s.preferred.total })}` : ""}</li>
					{job.knockouts.filter((x) => x.outcome !== "meets").map(knockoutRow)}
				</ul>
			</>
		));
	}
	if (card.kind === "knockouts") {
		return frame(k.knockouts, (
			<>
				<ul className="space-y-1.5 text-[13px] leading-5">{job.knockouts.slice(0, CARD_ROWS).map(knockoutRow)}</ul>
				<More n={job.knockouts.length - CARD_ROWS} />
			</>
		));
	}
	if (card.kind === "keywords") {
		// Differently worded terms first: they are the cheapest fix.
		const rows = [...job.keywords.filter((x) => x.status === "variant"), ...job.keywords.filter((x) => x.status === "missing")];
		return frame(k.keywords, (
			<>
				<ul className="space-y-1.5 text-[13px] leading-5">
					{rows.slice(0, CARD_ROWS).map((x) => (
						<li key={x.term} className="flex items-start gap-2">
							<span className={`${chip} ${x.status === "variant" ? STATUS.partial : STATUS.missing}`}>{j.keywordStatus[x.status]}</span>
							<span className="min-w-0">{x.status === "variant" ? fmt(k.variant, { term: x.term, cv: x.cvTerm ?? "" }) : x.term}</span>
						</li>
					))}
				</ul>
				<More n={rows.length - CARD_ROWS} />
			</>
		));
	}
	if (card.kind === "gaps") {
		const rows = job.requirements.filter((r) => r.status !== "matched").sort((a, b) => (a.requirement.importance === "required" ? 0 : 1) - (b.requirement.importance === "required" ? 0 : 1));
		return frame(k.gaps, (
			<>
				<ul className="space-y-1.5 text-[13px] leading-5">
					{rows.slice(0, CARD_ROWS).map((r, i) => (
						<li key={i} className="flex items-start gap-2">
							<span className={`${chip} ${STATUS[r.status]}`}>{j.status[r.status]}</span>
							<span className="min-w-0">{r.requirement.text} <span className="text-muted">· {j.importance[r.requirement.importance]}</span></span>
						</li>
					))}
				</ul>
				<More n={rows.length - CARD_ROWS} />
			</>
		));
	}
	return null;
}

function eventText(e: PageEvent, c: ChatStrings): { icon: IconName; title: string; details: string[] } {
	const ev = c.event;
	if (e.kind === "jobFailed") return { icon: "alert", title: ev.jobFailed, details: [] };
	if (e.kind === "jobRemoved") return { icon: "briefcase", title: ev.jobRemoved, details: [] };
	if (e.kind === "version") {
		const details = [fmt(ev.versionChanges, { resolved: e.resolved, added: e.added })];
		if (e.scoreBefore !== null && e.scoreAfter !== null) details.unshift(fmt(ev.versionScore, { before: e.scoreBefore, after: e.scoreAfter }));
		return { icon: "trendingUp", title: ev.version, details };
	}
	const details: string[] = [];
	if (e.percent !== null) details.push(fmt(ev.jobPercent, { percent: e.percent }) + (e.before !== null && e.before !== e.percent ? ` (${fmt(ev.jobBefore, { before: e.before })})` : ""));
	if (e.required) details.push(fmt(ev.jobRequired, { covered: fmtN(e.required.covered), total: e.required.total }));
	if (e.fails) details.push(fmt(ev.jobFails, { n: e.fails }));
	if (e.notStated) details.push(fmt(ev.jobNotStated, { n: e.notStated }));
	if (e.missingKeywords) details.push(fmt(ev.jobKeywords, { n: e.missingKeywords }));
	if (e.percent === null) details.push(ev.jobNoAi);
	if (e.trimmed) details.push(ev.jobTrimmed);
	return { icon: "briefcase", title: fmt(ev.job, { title: e.title || c.postingUntitled }), details };
}

/** What the page itself says: computed, never from the model. */
function PageMessage({ m, onOpenJob }: { m: ChatMessage; onOpenJob(): void }) {
	const { t } = useI18n();
	const { icon, title, details } = eventText(m.event!, t.chat);
	return (
		<li className="flex gap-2.5 rounded-xl bg-surface-muted/70 px-3 py-2.5">
			<Icon name={icon} className="mt-0.5 size-4 shrink-0 text-muted" />
			<div className="min-w-0 flex-1 space-y-1 text-[13px] leading-5">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<p className="font-semibold">{title}</p>
					<span className="ml-auto"><ProvenanceBadge kind="measured" /></span>
				</div>
				{details.length ? <p className="text-muted">{details.join(" · ")}</p> : null}
				{m.event!.kind === "job" ? <button type="button" onClick={onOpenJob} className={linkButton}>{t.chat.openJob} →</button> : null}
			</div>
		</li>
	);
}

function Avatar({ small = false }: { small?: boolean }) {
	return (
		<span className={`grid shrink-0 place-items-center rounded-full bg-ai-soft text-ai ${small ? "size-6" : "size-8"}`} aria-hidden="true">
			<Icon name="sparkles" className={small ? "size-3.5" : "size-4"} strokeWidth={1.75} />
		</span>
	);
}

function Message({ m, actions, onAddPosting }: { m: ChatMessage; actions: ChatActions; onAddPosting(): void }) {
	const { t } = useI18n();
	const { state } = useAnalysis();
	const c = t.chat;
	if (m.role === "page") return <PageMessage m={m} onOpenJob={actions.onOpenJob} />;
	if (m.role === "user") {
		return (
			<li className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm leading-6 text-on-accent">
				<span className="sr-only">{c.you}: </span>{m.text}
			</li>
		);
	}
	const current = m.reportId === state.report?.id;
	const status = state.chat.status;
	const tool = status ? fmt((t.analysing.tool as Record<string, string>)[status.key.replace("tool.", "")] ?? "", status.params) : null;
	const done = m.status === "done";
	return (
		<li className="space-y-2.5">
			<div className="flex items-center gap-2">
				<Avatar small />
				<span className="text-xs font-semibold text-ai">{c.assistant}</span>
				{done && !m.outOfScope ? <span className="ml-auto"><ProvenanceBadge kind={m.unverified ? "ai-unverified" : "ai-verified"} /></span> : null}
			</div>
			{m.status === "pending" ? <p className="flex items-center gap-2 text-sm text-ai"><span className="size-2 animate-pulse rounded-full bg-ai" aria-hidden="true" />{tool || c.thinking}</p> : null}
			{m.status === "error" ? <p className="text-sm text-fail">{c.error}</p> : null}
			{m.status === "cancelled" ? <p className="text-sm text-muted">{c.cancelled}</p> : null}
			{done && m.outOfScope ? <p className="text-sm leading-6">{c.refusal}</p> : null}
			{done && !m.outOfScope ? (
				<>
					<p className="whitespace-pre-wrap text-sm leading-6">{m.text}</p>
					{m.unverified ? <p className="text-[13px] text-warn" role="note">{c.unverified}</p> : null}
					{m.cards.map((card) => <PageCard key={card.kind} card={card} onOpenJob={actions.onOpenJob} />)}
					{m.needsPosting && !state.chat.posting ? (
						<Button variant="secondary" className="min-h-8 px-3 py-1 text-[13px]" onClick={onAddPosting}><Icon name="plus" className="size-3.5" />{c.needsPosting}</Button>
					) : null}
					{m.rewrites.map((r, i) => <RewriteCard key={i} r={r} current={current} onShow={actions.onShow} />)}
					{m.citations.length ? (
						<div className="flex flex-wrap items-center gap-1.5 text-xs">
							<span className="text-muted">{c.basedOn}</span>
							{m.citations.map((ct, i) =>
								ct.verified && current ? (
									<button key={i} type="button" onClick={() => actions.onShow([ct.ref])} className="rounded-md bg-highlight/60 px-1.5 py-0.5 font-mono hover:bg-highlight" title={ct.quote}>{ct.ref}</button>
								) : (
									<span key={i} className="rounded-md border border-border px-1.5 py-0.5 font-mono text-muted" title={ct.quote}>{ct.ref}{ct.verified ? "" : " ?"}</span>
								),
							)}
							{!current ? <span className="text-muted">({c.previousVersion})</span> : null}
						</div>
					) : null}
				</>
			) : null}
		</li>
	);
}

/** Adding or changing the posting takes the whole conversation area: pasting needs room. */
function PostingEditor({ onDone }: { onDone(): void }) {
	const { t } = useI18n();
	const { compareJob, state } = useAnalysis();
	const c = t.chat;
	const posting = state.chat.posting;
	const [text, setText] = useState(posting?.text ?? "");
	const [title, setTitle] = useState(posting?.title ?? "");
	const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal focus:border-accent";
	return (
		<form
			className="flex min-h-full flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (!text.trim() || state.chat.running) return;
				compareJob(text, title);
				onDone();
			}}
		>
			<div className="space-y-1">
				<p className="text-base font-semibold">{posting ? c.changeTitle : c.addTitle}</p>
				<p className="text-[13px] leading-5 text-muted">{c.postingHelp}</p>
			</div>
			<label className="block space-y-1 text-[13px] font-medium">
				<span>{c.postingTitle}</span>
				<input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
			</label>
			<label className="flex min-h-56 flex-1 flex-col gap-1 text-[13px] font-medium">
				<span>{c.postingText}</span>
				<textarea value={text} onChange={(e) => setText(e.target.value)} required className={`${field} flex-1 resize-none leading-6`} />
			</label>
			<div className="flex gap-2">
				<Button type="submit" className="min-h-10 flex-1" disabled={!text.trim() || state.chat.running}>{c.compare}</Button>
				<Button variant="secondary" className="min-h-10" onClick={onDone}>{c.cancel}</Button>
			</div>
		</form>
	);
}

function ContextBar({ onEdit }: { onEdit(): void }) {
	const { t } = useI18n();
	const { state, removePosting } = useAnalysis();
	const c = t.chat;
	const posting = state.chat.posting;
	const comparing = state.job.status === "running";
	const score = state.report?.overall ?? null;
	return (
		<div role="group" aria-label={c.context} className="shrink-0 space-y-2 border-b border-border px-4 py-3">
			<div className="flex items-center gap-2.5 text-[13px]">
				<Icon name="file" className="size-4 shrink-0 text-muted" />
				<span className="min-w-0 flex-1 truncate" title={state.file?.name}>{fmt(c.cvChip, { name: state.file?.name ?? "" })}</span>
				{score !== null ? <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold">{fmt(c.score, { score })}</span> : null}
			</div>
			{comparing ? (
				<p className="flex items-center gap-2.5 text-[13px] text-muted"><span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />{c.comparing}</p>
			) : posting ? (
				<div className="flex items-center gap-2.5 text-[13px]">
					<Icon name="briefcase" className="size-4 shrink-0 text-accent" />
					<span className="min-w-0 flex-1 truncate font-medium" title={posting.title}>{fmt(c.postingChip, { title: posting.title || c.postingUntitled })}</span>
					{posting.percent !== null ? <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">{posting.percent}%</span> : null}
					<button type="button" onClick={onEdit} className={`shrink-0 ${linkButton}`}>{c.changePosting}</button>
					<button type="button" onClick={removePosting} className="shrink-0 text-[13px] text-muted underline-offset-4 hover:underline">{c.removePosting}</button>
				</div>
			) : (
				<button type="button" onClick={onEdit} className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-accent/50 px-3 py-2 text-left text-[13px] hover:bg-accent-soft/50">
					<Icon name="plus" className="size-4 shrink-0 text-accent" />
					<span className="font-semibold text-accent">{c.addPosting}</span>
					<span className="ml-auto truncate text-xs text-muted">{c.addPostingHint}</span>
				</button>
			)}
		</div>
	);
}

/**
 * The panel; the screen docks it beside the report or shows it full screen.
 * `onClose` collapses the docked panel or closes the full-screen one.
 */
export function ChatPanel({ actions, onClose, closeKind = "collapse", titleId }: { actions: ChatActions; onClose(): void; closeKind?: "collapse" | "close"; titleId?: string }) {
	const { t } = useI18n();
	const { state, engine, ask, stopAsk, newConversation } = useAnalysis();
	const [draft, setDraft] = useState("");
	const [editing, setEditing] = useState(false);
	const end = useRef<HTMLLIElement>(null);
	const ownId = useId();
	const headingId = titleId ?? ownId;
	const c = t.chat;
	const { messages, posting, running } = state.chat;
	const canAsk = Boolean(engine && state.report?.profile);
	const starters = posting ? [...c.postingStarters, ...c.starters] : c.starters;
	const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
	const followUps = starters.filter((q) => !asked.has(q)).slice(0, 2);

	useEffect(() => {
		end.current?.scrollIntoView?.({ block: "end" });
	}, [messages.length, running]);

	const send = (text: string) => {
		if (!text.trim() || running || !canAsk) return;
		ask(text);
		setDraft("");
	};
	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		send(draft);
	};
	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send(draft);
		}
	};

	return (
		<section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col bg-surface">
			<div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
				<Avatar />
				<div className="min-w-0 flex-1">
					<h2 id={headingId} className="truncate text-[15px] font-semibold leading-5">{c.title}</h2>
					<p className="truncate text-xs text-muted">{c.subtitle}</p>
				</div>
				<button type="button" onClick={newConversation} disabled={!messages.length} title={c.newConversation} aria-label={c.newConversation} className={iconButton}>
					<Icon name="rotate" className="size-4" />
				</button>
				<button type="button" onClick={onClose} title={closeKind === "close" ? c.close : c.hide} aria-label={closeKind === "close" ? c.close : c.hide} className={iconButton}>
					<Icon name={closeKind === "close" ? "x" : "panelClose"} className="size-4" />
				</button>
			</div>

			<ContextBar onEdit={() => setEditing(true)} />

			{editing ? (
				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					<PostingEditor onDone={() => setEditing(false)} />
				</div>
			) : (
				<>
					<div role="log" aria-live="polite" aria-label={c.title} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<ol className="flex flex-col gap-5">
							{messages.length === 0 ? (
								<li className="space-y-4">
									<div className="space-y-1.5">
										<p className="text-base font-semibold">{c.welcome}</p>
										<p className="text-[13px] leading-5 text-muted">{c.introShort}</p>
									</div>
									{canAsk ? (
										<div className="space-y-2">
											<p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.tryAsking}</p>
											<ul className="space-y-2">
												{starters.slice(0, 4).map((q) => (
													<li key={q}>
														<button type="button" onClick={() => send(q)} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-ai/50 hover:bg-ai-soft/40">
															<Icon name="message" className="size-4 shrink-0 text-ai" />{q}
														</button>
													</li>
												))}
											</ul>
										</div>
									) : null}
								</li>
							) : null}
							{messages.map((m) => <Message key={m.id} m={m} actions={actions} onAddPosting={() => setEditing(true)} />)}
							<li ref={end} aria-hidden="true" />
						</ol>
					</div>

					<div className="shrink-0 space-y-2 border-t border-border px-3 pb-3 pt-2.5">
						{canAsk ? (
							<>
								{messages.length && !running && followUps.length ? (
									<div role="group" aria-label={c.followUps} className="flex flex-wrap gap-1.5">
										{followUps.map((q) => (
											<button key={q} type="button" onClick={() => send(q)} className="max-w-full truncate rounded-full border border-ai/30 bg-ai-soft/40 px-3 py-1 text-[13px] text-ai hover:bg-ai-soft">
												{q}
											</button>
										))}
									</div>
								) : null}
								<form onSubmit={onSubmit} className="flex items-end gap-2 rounded-2xl border border-border bg-bg py-1.5 pl-3.5 pr-1.5 focus-within:border-accent">
									<label className="min-w-0 flex-1">
										<span className="sr-only">{c.label}</span>
										<textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} rows={1} placeholder={c.placeholder} className="block max-h-40 min-h-9 w-full resize-none bg-transparent py-1.5 text-sm leading-6 outline-none [field-sizing:content]" />
									</label>
									{running ? (
										<button type="button" onClick={stopAsk} aria-label={c.stop} title={c.stop} className="grid size-9 shrink-0 place-items-center rounded-xl bg-text text-surface">
											<Icon name="stop" className="size-4" />
										</button>
									) : (
										<button type="submit" disabled={!draft.trim()} aria-label={c.send} title={c.send} className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent disabled:opacity-35">
											<Icon name="send" className="size-4" />
										</button>
									)}
								</form>
								<p className="text-center text-[11px] text-muted">{c.memoryNote}</p>
							</>
						) : (
							<p className="flex gap-2 rounded-xl bg-accent-soft/60 p-3 text-[13px] leading-5"><Icon name="info" className="mt-0.5 size-4 shrink-0 text-accent" />{engine ? c.unavailableNoProfile : c.unavailableNoAi}</p>
						)}
					</div>
				</>
			)}
		</section>
	);
}
