// AiEngine over Chrome's built-in Prompt API (`LanguageModel`, Gemini Nano).
//
// Lessons carried over from 002, each learned on real Chrome builds:
// - availability() and create() must receive the same options; an extra
//   option (such as probing samplingMode) can make an available model fail
//   with an opaque DOMException.
// - The structured-output decoder gets only the portable JSON Schema core;
//   length, pattern and validation-only keywords caused kErrorUnknown failures
//   and are enforced by the orchestrator's validator instead.
// - Long final objects are most reliable with an assistant "{" prefix and the
//   streaming path; a few builds reject streaming after a context overflow, so
//   a plain prompt is the fallback.

import type { AiEngine, AiSession, EngineAvailability, EngineFacts, EngineLangs, JsonSchema, PromptMessage } from "@app/ports/AiEngine";

// The subset of the Prompt API this adapter uses (developer.chrome.com/docs/ai/prompt-api).
interface LanguageModelSession {
	prompt(input: string | PromptMessage[], opts?: { responseConstraint?: unknown; signal?: AbortSignal }): Promise<string>;
	promptStreaming?(input: string | PromptMessage[], opts?: { signal?: AbortSignal }): AsyncIterable<string>;
	clone(opts?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
	destroy(): void;
	contextWindow?: number;
	contextUsage?: number;
}
export interface LanguageModelApi {
	availability(opts: unknown): Promise<string>;
	create(opts: unknown): Promise<LanguageModelSession>;
}

const VALIDATION_ONLY = new Set(["pattern", "maxLength", "minimum", "maximum", "maxItems", "additionalProperties"]);

export function decoderSchema(schema: unknown): unknown {
	if (Array.isArray(schema)) return schema.map(decoderSchema);
	if (!schema || typeof schema !== "object") return schema;
	return Object.fromEntries(Object.entries(schema).filter(([k]) => !VALIDATION_ONLY.has(k)).map(([k, v]) => [k, decoderSchema(v)]));
}

const modelOptions = (langs: EngineLangs) => ({
	expectedInputs: [{ type: "text", languages: langs.input }],
	expectedOutputs: [{ type: "text", languages: [langs.output] }],
});

const isAbort = (err: unknown) => (err as { name?: string } | null)?.name === "AbortError";

class ChromeSession implements AiSession {
	constructor(private readonly s: LanguageModelSession) {}

	get contextWindow() {
		return this.s.contextWindow;
	}
	get contextUsage() {
		return this.s.contextUsage;
	}

	prompt(input: string | PromptMessage[], opts: { schema?: JsonSchema; signal?: AbortSignal } = {}) {
		return this.s.prompt(input, { signal: opts.signal, ...(opts.schema ? { responseConstraint: decoderSchema(opts.schema) } : {}) });
	}

	async promptObject(input: string, opts: { signal?: AbortSignal } = {}) {
		let raw: string;
		try {
			const messages: PromptMessage[] = [
				{ role: "user", content: input },
				{ role: "assistant", content: "{", prefix: true },
			];
			if (this.s.promptStreaming) {
				raw = "";
				for await (const chunk of this.s.promptStreaming(messages, { signal: opts.signal })) raw += chunk;
			} else {
				raw = await this.s.prompt(messages, { signal: opts.signal });
			}
		} catch (err) {
			if (isAbort(err)) throw err;
			raw = await this.s.prompt(`${input}\nReturn compact JSON only. Do not use Markdown fences or commentary.`, { signal: opts.signal });
		}
		return raw.trimStart().startsWith("{") ? raw : `{${raw}`;
	}

	async clone(opts: { signal?: AbortSignal } = {}) {
		return new ChromeSession(await this.s.clone({ signal: opts.signal }));
	}

	destroy() {
		this.s.destroy();
	}
}

export class ChromeBuiltInEngine implements AiEngine {
	readonly id = "chrome-built-in";
	readonly facts: EngineFacts = {
		provider: "Google Chrome",
		model: "Gemini Nano",
		runsOn: "device",
		downloadSize: "≈ 2 GB",
		diskSpace: "22 GB",
		languages: ["en", "es", "de", "fr", "ja"],
		docsUrl: "https://developer.chrome.com/docs/ai/prompt-api",
	};

	constructor(private readonly api: () => LanguageModelApi | undefined = () => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel) {}

	async availability(langs: EngineLangs): Promise<EngineAvailability> {
		const api = this.api();
		if (!api?.availability) return "no-api";
		try {
			const value = await api.availability(modelOptions(langs));
			return (["unavailable", "downloadable", "downloading", "available"] as const).find((v) => v === value) ?? "unavailable";
		} catch {
			return "unavailable";
		}
	}

	async prepare({ langs, onProgress, signal }: { langs: EngineLangs; onProgress?: (share: number) => void; signal?: AbortSignal }) {
		// create() from a user gesture is what lets Chrome start the download.
		const session = await this.create(langs, "", signal, onProgress);
		session.destroy();
	}

	async createSession({ system, langs, signal }: { system: string; langs: EngineLangs; signal?: AbortSignal }): Promise<AiSession> {
		return new ChromeSession(await this.create(langs, system, signal));
	}

	private create(langs: EngineLangs, system: string, signal?: AbortSignal, onProgress?: (share: number) => void) {
		const api = this.api();
		if (!api) throw new Error("The Prompt API is not available in this browser.");
		return api.create({
			...modelOptions(langs),
			...(system ? { initialPrompts: [{ role: "system", content: system }] } : {}),
			signal,
			monitor(m: EventTarget) {
				m.addEventListener("downloadprogress", (e) => onProgress?.((e as Event & { loaded: number }).loaded));
			},
		});
	}
}
