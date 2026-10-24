// Small building blocks: buttons, notices, modal dialog / drawer, tabs.

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "secondary" | "ghost";

const BUTTON: Record<Variant, string> = {
	primary: "bg-accent text-on-accent hover:opacity-90",
	secondary: "border border-border bg-surface text-text hover:bg-surface-muted",
	ghost: "text-accent hover:underline underline-offset-4",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
	return (
		<button
			type="button"
			{...props}
			className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
		/>
	);
}

const NOTICE = {
	info: { box: "bg-accent-soft border-accent/25", icon: "text-accent", name: "info" as IconName },
	warning: { box: "bg-warn-soft border-warn/30", icon: "text-warn", name: "info" as IconName },
	error: { box: "bg-fail-soft border-fail/30", icon: "text-fail", name: "alert" as IconName },
};

export function Notice({ tone = "info", title, children, role }: { tone?: keyof typeof NOTICE; title: string; children?: ReactNode; role?: "status" | "alert" }) {
	const s = NOTICE[tone];
	return (
		<div role={role} className={`flex gap-3 rounded-2xl border p-4 ${s.box}`}>
			<span className={`mt-0.5 shrink-0 ${s.icon}`}><Icon name={s.name} className="size-5" /></span>
			<div className="space-y-1">
				<p className="font-semibold">{title}</p>
				{children ? <div className="text-sm leading-relaxed text-muted">{children}</div> : null}
			</div>
		</div>
	);
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * True at widths where the chat sits beside the report (spec 006). Where
 * matchMedia is missing (tests, old engines) the wide layout is assumed.
 */
export function useWide(query = "(min-width: 1024px)"): boolean {
	const get = () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true);
	const [wide, setWide] = useState(get);
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const list = window.matchMedia(query);
		const on = () => setWide(list.matches);
		list.addEventListener("change", on);
		return () => list.removeEventListener("change", on);
	}, [query]);
	return wide;
}

/**
 * A modal dialog (centred), drawer (right side, full screen on mobile) or
 * full screen (the chat on narrow screens: its content brings its own header
 * and close button, named by `labelledBy`). Esc closes; focus is trapped and
 * returned.
 */
export function Modal({ open, onClose, title, children, variant = "dialog", footer, labelledBy }: {
	open: boolean;
	onClose(): void;
	title: string;
	children: ReactNode;
	variant?: "dialog" | "drawer" | "fullscreen";
	footer?: ReactNode;
	labelledBy?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const id = useId();
	useEffect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
		return () => previous?.focus?.();
	}, [open]);
	if (!open) return null;

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.stopPropagation();
			onClose();
		}
		if (e.key !== "Tab" || !ref.current) return;
		const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
		const first = items[0];
		const last = items[items.length - 1];
		if (!first || !last) return;
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};

	if (variant === "fullscreen") {
		return (
			<div ref={ref} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} className="fixed inset-0 z-50 flex flex-col bg-surface" onKeyDown={onKeyDown}>
				{children}
			</div>
		);
	}
	const panel = variant === "drawer"
		? "fixed inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-border bg-surface shadow-2xl"
		: "relative mx-auto my-8 flex max-h-[calc(100dvh-4rem)] w-[min(680px,calc(100vw-2rem))] flex-col rounded-[20px] bg-surface shadow-2xl";
	return (
		<div className="fixed inset-0 z-50 overflow-y-auto bg-text/45" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={panel} onKeyDown={onKeyDown}>
				<div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
					<h2 id={id} className="text-2xl font-bold">{title}</h2>
					<button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-muted" aria-label="Close">
						<Icon name="x" className="size-5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">{children}</div>
				{footer ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-8">{footer}</div> : null}
			</div>
		</div>
	);
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange(id: T): void; label: string }) {
	const onKeyDown = (e: KeyboardEvent, i: number) => {
		const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
		if (next === null) return;
		e.preventDefault();
		const tab = tabs[(next + tabs.length) % tabs.length]!;
		onChange(tab.id);
		document.getElementById(`tab-${tab.id}`)?.focus();
	};
	return (
		<div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:gap-7 sm:px-0">
			{tabs.map((tab, i) => {
				const selected = tab.id === value;
				return (
					<button
						key={tab.id}
						id={`tab-${tab.id}`}
						role="tab"
						type="button"
						aria-selected={selected}
						aria-controls={`panel-${tab.id}`}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(tab.id)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm sm:rounded-none sm:border-b-2 sm:px-0 sm:pb-2.5 sm:text-[15px] ${
							selected ? "bg-accent font-semibold text-on-accent sm:border-accent sm:bg-transparent sm:text-accent" : "bg-surface-muted font-medium text-text sm:border-transparent sm:bg-transparent sm:text-muted"
						}`}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
