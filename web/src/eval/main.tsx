// Prompt evaluation against the real on-device model (SC-004, SC-005).
// Development only: `make web-eval` copies the fixture PDFs to web/eval-fixtures/
// (ignored) and serves this page on loopback. It is
// never built or deployed, because it has to fetch those fixtures.

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { analyseCv } from "@app/usecases/analyseCv";
import { checkEngine, prepareEngine } from "@app/usecases/engine";
import { measureLayout } from "@app/usecases/measureLayout";
import { readDocument } from "@app/usecases/readDocument";
import type { Lang } from "@domain/findings/types";
import type { Report } from "@domain/report/report";
import { createContainer } from "@infra/container";
import expectations from "../../tests/fixtures/expectations.json";
import "@ui/styles/app.css";

interface Expectation {
	file: string;
	expect?: string[];
	forbid?: string[];
	noSeverity?: string[];
	verdict?: string;
	profile?: Record<string, unknown>;
}

interface Row {
	file: string;
	report?: Report;
	problems: string[];
	profileProblems: string[];
	seconds: number;
	error?: string;
}

function judge(exp: Expectation, report: Report) {
	const types = new Set(report.findings.map((f) => f.type));
	const problems: string[] = [];
	if (exp.verdict && report.verdict !== exp.verdict) problems.push(`verdict ${report.verdict} ≠ ${exp.verdict}`);
	if (exp.expect && !exp.expect.some((t) => types.has(t))) problems.push(`missing ${exp.expect.join(" | ")}`);
	for (const t of exp.forbid ?? []) if (types.has(t)) problems.push(`should not report ${t}`);
	for (const s of exp.noSeverity ?? []) if (report.findings.some((f) => f.severity === s)) problems.push(`has ${s}`);
	const p = report.profile;
	const profileProblems: string[] = [];
	for (const [k, v] of Object.entries(exp.profile ?? {})) {
		const got = k === "experienceCount" ? p?.experience.length ?? 0 : k === "educationCount" ? p?.education.length ?? 0 : (p?.[k as "email"] as { value?: string } | null)?.value ?? null;
		if (got !== v) profileProblems.push(`${k}: ${JSON.stringify(got)} ≠ ${JSON.stringify(v)}`);
	}
	return { problems, profileProblems };
}

function Eval() {
	const [lang, setLang] = useState<Lang>("en");
	const [status, setStatus] = useState("Idle.");
	const [rows, setRows] = useState<Row[]>([]);
	const [running, setRunning] = useState(false);
	const services = createContainer();

	const run = async () => {
		setRunning(true);
		setRows([]);
		try {
			const choice = await checkEngine(services.engines, lang);
			if (!choice.engine) throw new Error(`On-device AI ${choice.availability} in this browser.`);
			if (choice.availability === "downloadable") {
				setStatus("Downloading the model…");
				await prepareEngine(choice.engine, lang, { onProgress: (p) => setStatus(`Downloading the model… ${Math.round(p * 100)}%`) });
			}
			const out: Row[] = [];
			for (const exp of expectations.fixtures as Expectation[]) {
				setStatus(`Running ${exp.file}…`);
				const started = performance.now();
				try {
					const res = await fetch(`/eval-fixtures/${exp.file}`);
					if (!res.ok) throw new Error("fixture not found: run `make web-eval`");
					const file = new File([await res.arrayBuffer()], exp.file.split("/").pop()!, { type: "application/pdf" });
					const { doc } = await readDocument(services.formats, file);
					const report = await analyseCv({ measured: measureLayout(doc, lang), engine: choice.engine, lang });
					out.push({ file: exp.file, report, ...judge(exp, report), seconds: (performance.now() - started) / 1000 });
				} catch (err) {
					out.push({ file: exp.file, problems: [], profileProblems: [], seconds: 0, error: err instanceof Error ? err.message : String(err) });
				}
				setRows([...out]);
			}
			setStatus("Done.");
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err));
		} finally {
			setRunning(false);
		}
	};

	const passed = rows.filter((r) => !r.error && !r.problems.length && !r.profileProblems.length).length;
	const total = (expectations.fixtures as Expectation[]).length;
	return (
		<main className="mx-auto max-w-6xl space-y-6 p-8">
			<h1 className="text-2xl font-bold">Prompt evaluation</h1>
			<p className="text-sm text-muted">Runs every fixture through the real on-device model and compares with tests/fixtures/expectations.json. Target: ≥ 90 % pass.</p>
			<div className="flex items-center gap-3">
				<select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-border bg-surface px-3 py-2">
					<option value="en">English</option>
					<option value="es">Spanish</option>
				</select>
				<button type="button" disabled={running} onClick={() => void run()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent disabled:opacity-50">Run evaluation</button>
				<span className="text-sm" role="status">{status}</span>
			</div>
			{rows.length ? <p className="font-semibold">{passed} of {total} fixtures pass ({Math.round((100 * passed) / total)} %).</p> : null}
			<table className="w-full text-left text-sm">
				<thead><tr className="border-b border-border"><th className="py-2">Fixture</th><th>Verdict</th><th>Findings</th><th>Expectations</th><th>Profile</th><th>Verified</th><th>Time</th></tr></thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.file} className="border-b border-border align-top">
							<td className="py-2 font-mono text-xs">{r.file}</td>
							{r.error ? <td colSpan={6} className="text-fail">{r.error}</td> : (
								<>
									<td>{r.report!.verdict} · {r.report!.overall ?? "–"}</td>
									<td className="text-xs">{r.report!.findings.map((f) => `${f.type} (${f.severity}, ${f.provenance})`).join("\n") || "—"}{r.report!.failed.length ? `\nfailed: ${r.report!.failed.map((f) => f.task).join(", ")}` : ""}</td>
									<td className={r.problems.length ? "text-fail" : "text-pass"}>{r.problems.join("; ") || "✓"}</td>
									<td className={`text-xs ${r.profileProblems.length ? "text-fail" : "text-pass"}`}>{r.profileProblems.join("; ") || "✓"}</td>
									<td>{Math.round(r.report!.verifiedShare * 100)}%</td>
									<td>{r.seconds.toFixed(1)} s</td>
								</>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</main>
	);
}

createRoot(document.getElementById("root")!).render(<StrictMode><Eval /></StrictMode>);
