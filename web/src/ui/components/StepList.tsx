import { AI_STEPS, type AiStep } from "@app/usecases/analyseCv";
import type { Step } from "../app/analysis";
import { fmt, useI18n } from "../i18n";
import type { Strings } from "../i18n/en";
import { Icon } from "./icons";
import { ProvenanceBadge } from "./ProvenanceBadge";

function detailText(t: Strings, step: Step): string | null {
	if (step.status === "skipped") return step.skipReason === "declined" ? t.analysing.skippedDeclined : t.analysing.skippedNoAi;
	if (!step.detail) return step.status === "pending" ? t.analysing.status.pending : null;
	const [group, key] = step.detail.key.includes(".") ? step.detail.key.split(".") : [null, step.detail.key];
	const table = (group === "tool" ? t.analysing.tool : t.analysing) as unknown as Record<string, string>;
	const template = table[key!];
	return template ? fmt(template, step.detail.params) : null;
}

const STATUS_STYLE: Record<Step["status"], string> = {
	done: "bg-pass-soft text-pass",
	running: "bg-ai-soft text-ai ring-2 ring-inset ring-ai",
	failed: "bg-fail-soft text-fail",
	pending: "bg-surface-muted text-muted",
	skipped: "bg-surface-muted text-muted",
};

export function StepList({ steps }: { steps: Step[] }) {
	const { t } = useI18n();
	const current = steps.find((s) => s.status === "running");
	return (
		<>
			<p className="sr-only" aria-live="polite">{current ? `${t.analysing.steps[current.id]}: ${detailText(t, current) ?? ""}` : ""}</p>
			<ol className="overflow-hidden rounded-[18px] border border-border bg-surface py-2">
				{steps.map((step) => {
					const ai = AI_STEPS.includes(step.id as AiStep);
					const muted = step.status === "pending" || step.status === "skipped";
					const detail = detailText(t, step);
					return (
						<li key={step.id} className={`flex items-center gap-3.5 px-5 py-3 ${step.status === "running" ? "bg-ai-soft/50" : ""}`}>
							<span className={`grid size-7 shrink-0 place-items-center rounded-full ${STATUS_STYLE[step.status]}`} aria-hidden="true">
								{step.status === "done" ? <Icon name="check" className="size-3.5" strokeWidth={2.5} /> : null}
								{step.status === "failed" ? <Icon name="x" className="size-3.5" strokeWidth={2.5} /> : null}
								{step.status === "running" ? <span className="size-2 animate-pulse rounded-full bg-ai" /> : null}
							</span>
							<div className="min-w-0 flex-1">
								<p className={`text-[15px] font-semibold ${muted ? "text-muted" : ""}`}>
									{t.analysing.steps[step.id]}
									<span className="sr-only"> — {t.analysing.status[step.status]}</span>
								</p>
								{detail ? <p className={`text-[13px] ${step.status === "running" && ai ? "text-ai" : "text-muted"}`}>{detail}</p> : null}
							</div>
							{step.id === "download" ? null : ai ? <ProvenanceBadge kind="ai" /> : <ProvenanceBadge kind="measured" />}
						</li>
					);
				})}
			</ol>
		</>
	);
}
