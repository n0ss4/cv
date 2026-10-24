// The dependency rule, enforced by reading every import (research R10):
// domain ← application ← adapters / ui ← infrastructure.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

function imports(file: string): string[] {
	const text = readFileSync(file, "utf8");
	return [...text.matchAll(/(?:^|\n)\s*(?:import|export)[^"'`]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]!);
}

// Resolves an import to the layer it lands in ("domain", "application", …) or the package name.
function target(file: string, spec: string): string {
	const alias: Record<string, string> = { "@domain/": "domain", "@app/": "application", "@adapters/": "adapters", "@infra/": "infrastructure", "@ui/": "ui" };
	for (const [prefix, layer] of Object.entries(alias)) if (spec.startsWith(prefix)) return layer;
	if (spec.startsWith(".")) {
		const resolved = relative(SRC, join(file, "..", spec));
		return resolved.split("/")[0]!;
	}
	return `pkg:${spec.split("/")[0]}`;
}

const layerOf = (file: string) => relative(SRC, file).split("/")[0]!;

const RULES: Record<string, (t: string) => boolean> = {
	domain: (t) => t === "domain",
	application: (t) => t === "domain" || t === "application",
	adapters: (t) => ["domain", "application", "adapters"].includes(t) || t === "pkg:pdfjs-dist",
	ui: (t) => ["domain", "application", "ui", "pkg:react", "pkg:react-dom"].includes(t) || t === "adapters:presenters",
	infrastructure: (t) => t !== "ui",
	eval: () => true,
	design: () => true,
};

describe("dependency rule", () => {
	const all = files(SRC);
	it("finds the sources", () => expect(all.length).toBeGreaterThan(20));

	for (const file of all) {
		const layer = layerOf(file);
		if (!(layer in RULES)) continue;
		it(`${relative(SRC, file)}`, () => {
			for (const spec of imports(file)) {
				let t = target(file, spec);
				// The UI may use presenters (view models), never readers or engines.
				if (t === "adapters" && /presenters/.test(spec)) t = "adapters:presenters";
				expect(RULES[layer]!(t), `${layer} must not import ${spec}`).toBe(true);
			}
		});
	}

	it("only main.tsx and infrastructure import infrastructure", () => {
		for (const file of all) {
			const rel = relative(SRC, file);
			if (rel.startsWith("infrastructure/") || rel === "main.tsx" || rel.startsWith("eval/") || rel.startsWith("design/")) continue;
			for (const spec of imports(file)) expect(target(file, spec), `${rel} imports ${spec}`).not.toBe("infrastructure");
		}
	});
});
