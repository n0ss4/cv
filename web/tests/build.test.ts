// The built page: exact production CSP, nothing from another origin, no inline
// styles or scripts. Runs after `vite build` (make web-test builds first).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRODUCTION_CSP } from "../vite.config";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const built = existsSync(`${DIST}index.html`);

describe.skipIf(!built)("built page", () => {
	const pages = readdirSync(DIST).filter((f) => f.endsWith(".html"));

	it("ships the checker only (the eval page is a dev tool)", () => expect(pages).toEqual(["index.html"]));

	for (const page of pages) {
		const html = readFileSync(`${DIST}${page}`, "utf8");
		it(`${page} carries exactly the production CSP`, () => {
			const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
			expect(csp).toBe(PRODUCTION_CSP);
			expect(csp).toContain("connect-src 'none'");
		});
		it(`${page} loads nothing from another origin`, () => {
			expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
		});
		it(`${page} has no inline script or style`, () => {
			expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
			expect(html).not.toMatch(/<style|style="/);
		});
	}

	it("ships the pdf.js worker as a same-origin asset", () => {
		expect(readdirSync(`${DIST}assets`).some((f) => /^pdf\.worker.*\.mjs$/.test(f))).toBe(true);
	});

	it("no bundle phones home", () => {
		const js = readdirSync(`${DIST}assets`).filter((f) => f.endsWith(".js") && !f.startsWith("pdf.worker")).map((f) => readFileSync(`${DIST}assets/${f}`, "utf8")).join("\n");
		for (const api of ["navigator.sendBeacon", "new WebSocket", "localStorage.setItem", "indexedDB.open", "document.cookie="]) expect(js, api).not.toContain(api);
	});
});

it("the build test ran against a build", () => {
	expect(built, "run `make web-build` (make web-test does it first)").toBe(true);
});
