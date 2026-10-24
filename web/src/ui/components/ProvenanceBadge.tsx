// Who produced a result: measured by the page (teal), or the on-device AI
// (violet), verified against the CV or not. Never colour alone: each kind has
// its own icon and label, and its explanation is available to screen readers
// and on hover/focus.

import type { Provenance } from "@domain/findings/types";
import { useI18n } from "../i18n";
import { Icon } from "./icons";

const STYLE: Record<Provenance | "ai", string> = {
	measured: "bg-accent-soft text-accent",
	"ai-verified": "bg-ai-soft text-ai",
	"ai-unverified": "border border-ai bg-surface text-ai",
	ai: "bg-ai-soft text-ai",
};

export function ProvenanceBadge({ kind, label }: { kind: Provenance | "ai"; label?: string }) {
	const { t } = useI18n();
	const text = kind === "ai" ? { label: label ?? t.start.aiBadge, explain: "" } : t.provenance[kind];
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[kind]}`}
			title={text.explain || undefined}
			tabIndex={text.explain ? 0 : undefined}
		>
			<Icon name={kind === "measured" ? "ruler" : "sparkles"} className="size-3.5" strokeWidth={1.75} />
			<span>{text.label}</span>
			{kind === "ai-verified" ? <Icon name="check" className="size-3" /> : null}
			{kind === "ai-unverified" ? <Icon name="help" className="size-3" /> : null}
			{text.explain ? <span className="sr-only">: {text.explain}</span> : null}
		</span>
	);
}
