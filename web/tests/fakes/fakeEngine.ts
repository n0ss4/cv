// A scripted stand-in for an on-device engine, so the orchestrator and the UI
// can be tested where no model exists. A script maps each task (recognised
// from its brief) to the replies the "model" gives, in order; the last reply
// is the final answer. A reply is a value (JSON-encoded for you), a raw string,
// or an Error, which the "engine" throws (a session the browser ended).

import type { AiEngine, AiSession, EngineAvailability, PromptMessage } from "@app/ports/AiEngine";

const TASK_MARKERS: Record<string, string> = {
	extract_contact: "TASK: find the candidate's contact details",
	extract_sections_experience: "TASK: list the CV's section headings",
	extract_education_skills: "TASK: extract education, skills",
	review: "TASK: review this CV",
	extract_job: "TASK: extract the requirements of this job posting",
	match_job: "TASK: check each job requirement",
	ask: "TASK: answer the user's question",
};

/** Replies per task; a function receives how many times that task has started (0, 1, …). */
export type Script = Record<string, unknown[] | ((run: number) => unknown[])>;

export interface RecordedPrompt {
	task: string | undefined;
	text: string;
	schema: unknown;
	final: boolean;
}

/** `failCreate`: how many createSession calls fail before one succeeds (Infinity: all). */
export function fakeEngine(script: Script, opts: { availability?: EngineAvailability; delay?: number; failCreate?: number } = {}) {
	const prompts: RecordedPrompt[] = [];
	const runs: Record<string, number> = {};
	let prepared = 0;
	let creates = 0;

	const aborted = (signal?: AbortSignal) => {
		if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
	};
	const wait = () => (opts.delay ? new Promise((r) => setTimeout(r, opts.delay)) : Promise.resolve());

	const makeSession = (): AiSession => {
		let task: string | undefined;
		let turn = 0;
		let run = 0;
		const reply = (text: string, final: boolean) => {
			if (!task) {
				task = Object.keys(TASK_MARKERS).find((k) => text.includes(TASK_MARKERS[k]!));
				// A task's tool session and its answer clone count as one run.
				run = final ? Math.max(0, (runs[task ?? ""] ?? 1) - 1) : (runs[task ?? ""] = (runs[task ?? ""] ?? 0) + 1) - 1;
			}
			const entry = script[task ?? ""] ?? [];
			const replies = typeof entry === "function" ? entry(run) : entry;
			const value = final ? replies[replies.length - 1] : replies[Math.min(turn++, replies.length - 1)];
			if (value instanceof Error) throw value;
			return typeof value === "string" ? value : JSON.stringify(value ?? {});
		};
		return {
			async prompt(input: string | PromptMessage[], o = {}) {
				aborted(o.signal);
				await wait();
				aborted(o.signal);
				const text = Array.isArray(input) ? input.map((m) => m.content).join("\n") : input;
				const final = text.includes("FINAL_RESULT_PHASE");
				prompts.push({ task, text, schema: o.schema, final });
				const out = reply(text, final);
				prompts[prompts.length - 1]!.task = task;
				return out;
			},
			async promptObject(input: string, o = {}) {
				aborted(o.signal);
				await wait();
				aborted(o.signal);
				prompts.push({ task, text: input, schema: undefined, final: true });
				const out = reply(input, true);
				prompts[prompts.length - 1]!.task = task;
				return out.trimStart().startsWith("{") ? out : `{${out}`;
			},
			clone: async () => makeSession(),
			destroy() {},
		};
	};

	const engine: AiEngine = {
		id: "fake",
		facts: { provider: "Test", model: "Scripted fake", runsOn: "device", languages: ["en", "es"], docsUrl: "https://example.com" },
		availability: async () => opts.availability ?? "available",
		prepare: async ({ onProgress }) => {
			prepared++;
			onProgress?.(0.5);
			onProgress?.(1);
		},
		createSession: async () => {
			if (creates++ < (opts.failCreate ?? 0)) throw Object.assign(new Error("Other generic failures occurred."), { name: "UnknownError" });
			return makeSession();
		},
	};
	return { engine, prompts, prepared: () => prepared, creates: () => creates };
}
