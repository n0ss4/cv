// Port: an on-device language model provider (contracts/ports.md#aiengine).
// Only Chrome's built-in model implements it today; the orchestrator depends
// on AiSession alone, so another on-device engine needs no change here.

export type EngineAvailability = "no-api" | "unavailable" | "downloadable" | "downloading" | "available";

export interface EngineLangs {
	input: string[];
	output: string;
}

/** Shown verbatim in "About the AI"; describes, never markets. */
export interface EngineFacts {
	provider: string;
	model: string;
	/** Principle II: the only value an engine may declare. */
	runsOn: "device";
	downloadSize?: string;
	diskSpace?: string;
	languages: string[];
	docsUrl: string;
}

export type JsonSchema = Record<string, unknown>;

export interface PromptMessage {
	role: "user" | "assistant";
	content: string;
	prefix?: boolean;
}

export interface AiSession {
	/** One turn. With a schema the engine constrains the reply to it where it can. */
	prompt(input: string | PromptMessage[], opts?: { schema?: JsonSchema; signal?: AbortSignal }): Promise<string>;
	/**
	 * A final, unconstrained answer turn that should start with `{`. Engines
	 * implement it the most reliable way they have (Chrome: an assistant prefix
	 * plus streaming); the reply always starts with `{`.
	 */
	promptObject(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
	clone(opts?: { signal?: AbortSignal }): Promise<AiSession>;
	destroy(): void;
	readonly contextWindow?: number;
	readonly contextUsage?: number;
}

export interface AiEngine {
	readonly id: string;
	readonly facts: EngineFacts;
	availability(langs: EngineLangs): Promise<EngineAvailability>;
	/** Download after explicit consent; must be called from a user gesture. */
	prepare(opts: { langs: EngineLangs; onProgress?: (share: number) => void; signal?: AbortSignal }): Promise<void>;
	createSession(opts: { system: string; langs: EngineLangs; signal?: AbortSignal }): Promise<AiSession>;
}
