// The only build definition for the web checker (constitution V: `make web*` calls this).
//
// The privacy guarantee is a Content-Security-Policy, not a promise:
// connect-src 'none' blocks every fetch, XHR, WebSocket and beacon, so a CV
// cannot leave the page even if a future change tried to send it. GitHub Pages
// cannot set headers, so the policy is a <meta> tag. The dev server needs one
// relaxation -- Vite's hot-reload WebSocket on loopback -- and only there.
// tests/build.test.ts fails if the built policy differs from PRODUCTION_CSP.

import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export const PRODUCTION_CSP = [
	"default-src 'none'",
	"script-src 'self'",
	"worker-src 'self'",
	"style-src 'self'",
	"img-src 'self' data:",
	"font-src 'self'",
	"connect-src 'none'",
	"form-action 'none'",
	"base-uri 'none'",
].join("; ");

// Dev only (loopback): Vite's client talks over a WebSocket, React Refresh
// needs an inline preamble, and the prompt-evaluation page (eval.html, never
// built or deployed) fetches fixture PDFs from this same server.
const DEV_CSP = PRODUCTION_CSP
	.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*")
	.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
	.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");

function csp(): Plugin {
	let policy = PRODUCTION_CSP;
	return {
		name: "csp",
		configResolved(config) {
			if (config.command === "serve" && config.mode !== "preview") policy = DEV_CSP;
		},
		transformIndexHtml: (html) => html.replace("%CSP%", policy),
	};
}

const src = (dir: string) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss(), csp()],
	resolve: {
		alias: {
			"@domain": src("domain"),
			"@app": src("application"),
			"@adapters": src("adapters"),
			"@infra": src("infrastructure"),
			"@ui": src("ui"),
		},
	},
	build: {
		target: "es2023",
		// Inlined assets would become data: URLs for scripts, which the CSP rejects.
		assetsInlineLimit: 0,
		// Only the checker is built. eval.html (`make web-eval`, fetches fixtures)
		// and design.html (a scripted AI for looking at screens) are development
		// tools served by the dev server; they never ship.
		rollupOptions: { input: { main: fileURLToPath(new URL("./index.html", import.meta.url)) } },
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.{ts,tsx}"],
		testTimeout: 30000,
	},
});
