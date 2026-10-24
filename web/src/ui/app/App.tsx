import { useState } from "react";
import { Header, type Panel } from "../components/Header";
import { AboutAiPanel, AiLogDrawer, PrivacyPanel, PromptsViewer } from "../components/transparency";
import { useI18n } from "../i18n";
import { AnalysingScreen, ConsentDialog, ErrorScreen, ResultsScreen, StartScreen } from "../screens/screens";
import { useAnalysis } from "./AnalysisProvider";

export function App() {
	const { t } = useI18n();
	const { state, clear } = useAnalysis();
	const [panel, setPanel] = useState<Panel>(null);
	const close = () => setPanel(null);

	let screen;
	if (state.phase === "done" && state.report) screen = <ResultsScreen report={state.report} onPanel={setPanel} onFormula={() => setPanel("about")} />;
	else if (state.phase === "failed") screen = <ErrorScreen />;
	else if (state.phase === "idle" || state.phase === "cancelled") screen = <StartScreen onPanel={setPanel} />;
	else screen = <AnalysingScreen onPanel={setPanel} />;

	return (
		<>
			<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">{t.app.skip}</a>
			<Header onPanel={setPanel} onHome={() => (state.phase === "idle" ? undefined : clear())} />
			<main id="main">{screen}</main>
			<ConsentDialog />
			<PrivacyPanel open={panel === "privacy"} onClose={close} />
			<AboutAiPanel open={panel === "about"} onClose={close} onPrompts={() => setPanel("prompts")} />
			<PromptsViewer open={panel === "prompts"} onClose={close} />
			<AiLogDrawer open={panel === "log"} onClose={close} />
		</>
	);
}
