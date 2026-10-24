// Accepts whatever the registered readers accept (FR-011): the accept list,
// "We read: PDF" and the size limit all come from the format registry.

import { useRef, useState, type DragEvent } from "react";
import { useAnalysis } from "../app/AnalysisProvider";
import { fmt, useI18n } from "../i18n";
import { Button } from "./base";
import { Icon } from "./icons";

export const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

export function DropZone({ compact = false }: { compact?: boolean }) {
	const { t } = useI18n();
	const { services, onFile } = useAnalysis();
	const input = useRef<HTMLInputElement>(null);
	const [over, setOver] = useState(false);
	const formats = services.formats;

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		setOver(false);
		const file = e.dataTransfer.files[0];
		if (file) onFile(file);
	};

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={onDrop}
			className={`flex flex-col items-center gap-3.5 rounded-[20px] border-[1.5px] bg-surface text-center shadow-[0_8px_24px_rgb(15_31_28/0.06)] transition ${
				compact ? "px-5 py-6" : "px-5 py-10"
			} ${over ? "border-accent bg-accent-soft" : "border-accent/35"}`}
		>
			<span className="grid size-[52px] place-items-center rounded-full bg-accent-soft text-accent"><Icon name="upload" className="size-[22px]" /></span>
			<p className="text-xl font-semibold">
				{over ? t.start.dropping : <><span className="hidden sm:inline">{t.start.dropTitle}</span><span className="sm:hidden">{t.start.dropTitleTouch}</span></>}
			</p>
			<Button onClick={() => input.current?.click()}>{t.start.choose}</Button>
			<input
				ref={input}
				type="file"
				className="sr-only"
				tabIndex={-1}
				aria-hidden="true"
				accept={formats.acceptAttribute()}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) onFile(file);
					e.target.value = "";
				}}
			/>
			<p className="text-[13px] text-muted">{fmt(t.start.weRead, { formats: formats.labels().join(", "), size: megabytes(formats.maxBytes()) })}</p>
		</div>
	);
}
