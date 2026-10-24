// Renders the whole app in jsdom with the real PDF reader (Node build of
// pdf.js) and a scripted engine -- the same wiring main.tsx does in the browser.
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import axe from "axe-core";
import { FormatRegistry } from "@app/formats/registry";
import type { AiEngine } from "@app/ports/AiEngine";
import type { DocumentReader } from "@app/ports/DocumentReader";
import { App } from "@ui/app/App";
import { AnalysisProvider } from "@ui/app/AnalysisProvider";
import { I18nProvider } from "@ui/i18n";
import { nodePdfReader } from "../support";

afterEach(cleanup);

export function renderApp(opts: { engines?: AiEngine[]; readers?: DocumentReader[]; lang?: "en" | "es" } = {}) {
	const formats = new FormatRegistry();
	for (const r of opts.readers ?? [nodePdfReader()]) formats.register(r);
	return render(
		<I18nProvider initial={opts.lang ?? "en"}>
			<AnalysisProvider services={{ formats, engines: opts.engines ?? [] }}>
				<App />
			</AnalysisProvider>
		</I18nProvider>,
	);
}

/** WCAG 2.1 AA rules axe can check without layout (contrast needs a real renderer). */
export async function a11yViolations(root: Element = document.body) {
	const result = await axe.run(root, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, rules: { "color-contrast": { enabled: false } } });
	return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

export function noInlineStyles(root: Element = document.body) {
	return [...root.querySelectorAll("[style]")].map((el) => el.outerHTML.slice(0, 80));
}
