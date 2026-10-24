// The Chrome adapter against a stub LanguageModel: option parity between
// availability() and create(), decoder schema reduction, the assistant-prefix
// answer path and its fallback.
import { describe, expect, it } from "vitest";
import { ChromeBuiltInEngine, decoderSchema, type LanguageModelApi } from "@adapters/ai/chrome/ChromeBuiltInEngine";
import { TURN } from "@app/prompts/schemas";

function stub(opts: { availability?: string; streaming?: "ok" | "throws" | "none" } = {}) {
	const calls: { kind: string; arg: unknown; opts?: unknown }[] = [];
	const session = {
		async prompt(input: unknown, o?: unknown) {
			calls.push({ kind: "prompt", arg: input, opts: o });
			return Array.isArray(input) ? '"a":1}' : '{"next":"answer"}';
		},
		...(opts.streaming === "none" ? {} : {
			async *promptStreaming(input: unknown) {
				calls.push({ kind: "stream", arg: input });
				if (opts.streaming === "throws") throw new Error("kErrorUnknown");
				yield '"a":';
				yield "1}";
			},
		}),
		clone: async () => session,
		destroy() {},
	};
	const api: LanguageModelApi = {
		availability: async (o) => (calls.push({ kind: "availability", arg: o }), opts.availability ?? "available"),
		create: async (o) => (calls.push({ kind: "create", arg: o }), session),
	};
	return { api, calls };
}

describe("ChromeBuiltInEngine", () => {
	it("reports no-api without LanguageModel, and normalises unknown values", async () => {
		expect(await new ChromeBuiltInEngine(() => undefined).availability({ input: ["en"], output: "en" })).toBe("no-api");
		expect(await new ChromeBuiltInEngine(() => stub({ availability: "readily" }).api).availability({ input: ["en"], output: "en" })).toBe("unavailable");
	});

	it("passes the same language options to availability() and create()", async () => {
		const { api, calls } = stub();
		const engine = new ChromeBuiltInEngine(() => api);
		const langs = { input: ["en", "es"], output: "es" };
		await engine.availability(langs);
		await engine.createSession({ system: "sys", langs });
		const a = calls.find((c) => c.kind === "availability")!.arg as Record<string, unknown>;
		const c = calls.find((c) => c.kind === "create")!.arg as Record<string, unknown>;
		expect(c.expectedInputs).toEqual(a.expectedInputs);
		expect(c.expectedOutputs).toEqual(a.expectedOutputs);
		expect(c).not.toHaveProperty("samplingMode");
		expect(c.initialPrompts).toEqual([{ role: "system", content: "sys" }]);
	});

	it("sends only the portable schema core to the decoder", async () => {
		const reduced = JSON.stringify(decoderSchema(TURN));
		for (const k of ["pattern", "maxLength", "minimum", "maximum", "additionalProperties"]) expect(reduced).not.toContain(`"${k}"`);
		expect(reduced).toContain('"enum"');
		const { api, calls } = stub();
		const s = await new ChromeBuiltInEngine(() => api).createSession({ system: "", langs: { input: ["en"], output: "en" } });
		await s.prompt("turn", { schema: TURN as unknown as Record<string, unknown> });
		expect((calls.find((c) => c.kind === "prompt")!.opts as { responseConstraint: unknown }).responseConstraint).toEqual(decoderSchema(TURN));
	});

	it.each(["ok", "throws", "none"] as const)("answers objects with a { prefix (streaming %s)", async (streaming) => {
		const { api } = stub({ streaming });
		const s = await new ChromeBuiltInEngine(() => api).createSession({ system: "", langs: { input: ["en"], output: "en" } });
		const out = await s.promptObject("give the object");
		expect(out.startsWith("{")).toBe(true);
		expect(() => JSON.parse(out)).not.toThrow();
	});

	it("declares itself as running on the device", () => {
		expect(new ChromeBuiltInEngine().facts.runsOn).toBe("device");
	});
});
