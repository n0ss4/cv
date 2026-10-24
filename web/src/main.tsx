import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createContainer } from "@infra/container";
import { App } from "@ui/app/App";
import { AnalysisProvider } from "@ui/app/AnalysisProvider";
import { I18nProvider } from "@ui/i18n";
import "@ui/styles/app.css";

const services = createContainer();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<I18nProvider>
			<AnalysisProvider services={services}>
				<App />
			</AnalysisProvider>
		</I18nProvider>
	</StrictMode>,
);
