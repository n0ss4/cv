// Design preview: the real app with a scripted on-device AI, so screens that
// need the model (the review, the chat, the job match) can be looked at and
// screenshotted in any browser. Development only: served by `make web` at
// /design.html, never built or deployed (tests/build.test.ts).

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createContainer } from "@infra/container";
import { App } from "@ui/app/App";
import { AnalysisProvider } from "@ui/app/AnalysisProvider";
import { I18nProvider } from "@ui/i18n";
import { fakeEngine } from "../../tests/fakes/fakeEngine";
import { jobScript } from "../../tests/ui/scripts";
import "@ui/styles/app.css";

// One reply per question, in order; the last one repeats.
const ANSWERS = [
	{
		answer: "Mostly yes. You cover the required skills and your experience is long enough, but your CV doesn't state your English level, which the posting treats as a hard filter. Adding it would remove that doubt.",
		cards: ["fit", "knockouts"],
		citations: [{ ref: "p1:2", quote: "Data Engineer" }],
		rewrites: [],
	},
	{
		answer: "Two quick wins: name Kubernetes exactly as the posting does, and turn your first bullet into a result. Here is a rewrite that only uses what your CV already says:",
		cards: ["keywords"],
		citations: [{ ref: "p1:12", quote: "Cloud & Tools" }],
		rewrites: [{ source_ref: "p1:6", text: "Data engineer with 6 years of experience designing batch and streaming pipelines for retail and logistics." }],
	},
	{ answer: "Your most recent role is Senior Data Engineer at Lumen Analytics, from 2022 to the present. An ATS files it first because it is the first entry under Experience.", cards: [], citations: [{ ref: "p1:14", quote: "Senior Data Engineer" }], rewrites: [] },
];

const base = jobScript();
const engine = fakeEngine(
	{
		...base,
		ask: (run) => [{ next: "read_lines", page: 1, from: 1, to: 20 }, { next: "answer" }, { out_of_scope: false, needs_posting: false, ...ANSWERS[Math.min(run, ANSWERS.length - 1)] }],
	},
	{ delay: 350 },
).engine;

const services = { ...createContainer(), engines: [engine] };

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<I18nProvider>
			<AnalysisProvider services={services}>
				<App />
			</AnalysisProvider>
		</I18nProvider>
	</StrictMode>,
);
