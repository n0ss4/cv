// What the ATS will file (the extracted profile), the raw ATS view with
// highlighted evidence, and the job comparison.

import { useEffect, useRef, useState } from "react";
import type { IndexedLine } from "@domain/document/lineIndex";
import type { ExtractedProfile, Field } from "@domain/profile/types";
import { fmt, useI18n } from "../i18n";
import { Button, Notice } from "./base";
import { Icon } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

type Show = (refs: string[]) => void;

function RefLink({ refs, onShow }: { refs: string[]; onShow: Show }) {
	const { t } = useI18n();
	const ref = refs[0];
	if (!ref) return null;
	return (
		<button type="button" onClick={() => onShow(refs)} className="font-mono text-xs text-accent underline-offset-4 hover:underline">
			{fmt(t.profile.line, { ref })}
		</button>
	);
}

function Row({ label, field, onShow }: { label: string; field: Field | null; onShow: Show }) {
	const { t } = useI18n();
	return (
		<div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[140px_1fr_auto] sm:items-center sm:gap-4">
			<dt className="text-sm font-medium text-muted">{label}</dt>
			<dd className={`text-[15px] ${field ? "" : "italic text-muted"}`}>{field ? field.value : t.profile.notFound}</dd>
			{field ? (
				<dd className="flex items-center gap-3">
					<RefLink refs={field.refs} onShow={onShow} />
					<ProvenanceBadge kind={field.verified === false ? "ai-unverified" : "ai-verified"} />
				</dd>
			) : <dd />}
		</div>
	);
}

function ListSection({ title, searchable, children, empty }: { title: string; searchable?: boolean; children: React.ReactNode; empty: boolean }) {
	const { t } = useI18n();
	return (
		<section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
			<h3 className="flex flex-wrap items-center gap-3 font-semibold">
				{title}
				{searchable ? <span className="inline-flex items-center gap-1 text-xs font-medium text-muted"><Icon name="search" className="size-3" />{t.results.searchable}</span> : null}
			</h3>
			{empty ? <p className="text-sm italic text-muted">{t.profile.notFound}</p> : children}
		</section>
	);
}

export function ProfileView({ profile, onShow }: { profile: ExtractedProfile | null; onShow: Show }) {
	const { t } = useI18n();
	const f = t.profile.fields;
	if (!profile) return <Notice title={t.profile.needsAi} />;
	const badge = (verified?: boolean) => <ProvenanceBadge kind={verified === false ? "ai-unverified" : "ai-verified"} />;
	return (
		<div className="space-y-5">
			<p className="text-sm text-muted">{t.profile.intro}</p>
			<dl className="rounded-2xl border border-border bg-surface px-5">
				<Row label={f.name} field={profile.name} onShow={onShow} />
				<Row label={f.headline} field={profile.headline} onShow={onShow} />
				<Row label={f.email} field={profile.email} onShow={onShow} />
				<Row label={f.phone} field={profile.phone} onShow={onShow} />
				<Row label={f.location} field={profile.location} onShow={onShow} />
			</dl>
			<ListSection title={f.experience} searchable empty={!profile.experience.length}>
				<ul className="space-y-4">
					{profile.experience.map((e, i) => (
						<li key={i} className="space-y-1">
							<div className="flex flex-wrap items-center gap-3">
								<p className="font-semibold">{e.title ?? t.profile.notFound}{e.organisation ? ` · ${e.organisation}` : ""}</p>
								<RefLink refs={e.refs} onShow={onShow} />
								{badge(e.verified)}
							</div>
							<p className="text-sm text-muted">{[e.start, e.current ? t.profile.current : e.end].filter(Boolean).join(" – ") || t.profile.notFound}{e.location ? ` · ${e.location}` : ""}</p>
						</li>
					))}
				</ul>
			</ListSection>
			<ListSection title={f.education} searchable empty={!profile.education.length}>
				<ul className="space-y-2">
					{profile.education.map((e, i) => (
						<li key={i} className="flex flex-wrap items-center gap-3 text-sm">
							<span><strong>{e.qualification}</strong>{e.institution ? ` · ${e.institution}` : ""}{e.end ? ` · ${e.end}` : ""}</span>
							<RefLink refs={e.refs} onShow={onShow} />{badge(e.verified)}
						</li>
					))}
				</ul>
			</ListSection>
			<ListSection title={f.skills} searchable empty={!profile.skills.length}>
				<ul className="flex flex-wrap gap-2">
					{profile.skills.map((s, i) => (
						<li key={i}>
							<button type="button" onClick={() => onShow([s.ref])} className={`rounded-full px-3 py-1 text-sm ${s.verified === false ? "border border-ai text-ai" : "bg-surface-muted"}`}>{s.value}</button>
						</li>
					))}
				</ul>
			</ListSection>
			<div className="grid gap-5 sm:grid-cols-2">
				<ListSection title={f.languages} empty={!profile.languages.length}>
					<ul className="space-y-1 text-sm">{profile.languages.map((l, i) => <li key={i}>{l.language}{l.level ? ` — ${l.level}` : ""}</li>)}</ul>
				</ListSection>
				<ListSection title={f.certifications} searchable empty={!profile.certifications.length}>
					<ul className="space-y-1 text-sm">{profile.certifications.map((c, i) => <li key={i}>{c.value}</li>)}</ul>
				</ListSection>
			</div>
			<ListSection title={f.links} empty={!profile.links.length}>
				<ul className="space-y-1 text-sm">{profile.links.map((l, i) => <li key={i} className="flex items-center gap-3"><span className="font-mono">{l.value}</span>{badge(l.verified)}</li>)}</ul>
			</ListSection>
		</div>
	);
}

export function AtsView({ lines, highlight }: { lines: IndexedLine[]; highlight: string[] }) {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);
	const first = useRef<HTMLLIElement>(null);
	const marked = new Set(highlight);
	useEffect(() => {
		first.current?.scrollIntoView?.({ block: "center" });
	}, [highlight]);
	let seenFirst = false;
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="max-w-3xl text-sm text-muted">{t.ats.intro}</p>
				<Button
					variant="secondary"
					onClick={() => {
						void navigator.clipboard?.writeText(lines.map((l) => l.text).join("\n")).then(() => setCopied(true));
					}}
				>
					<Icon name="copy" />{copied ? t.ats.copied : t.ats.copy}
				</Button>
			</div>
			<ol className="overflow-x-auto rounded-2xl border border-border bg-surface py-3 font-mono text-[13px]">
				{lines.map((l) => {
					const hit = marked.has(l.ref);
					const isFirst = hit && !seenFirst;
					if (hit) seenFirst = true;
					return (
						<li key={l.ref} ref={isFirst ? first : undefined} className={`flex gap-5 px-5 py-1 ${hit ? "bg-highlight" : ""}`} aria-current={hit ? "true" : undefined}>
							<span className="w-11 shrink-0 select-none text-right text-muted">{l.ref}</span>
							<span className="whitespace-pre-wrap">{l.text}</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
