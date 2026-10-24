# Contract: ports (extension points)

These are the interfaces that let a file format or an AI engine be added without touching the
domain, use cases, prompts or UI. They live in `web/src/application/ports/`. Adapters implement
them, and `web/src/infrastructure/container.ts` is the only place that picks implementations.

## DocumentReader: one per file format

```ts
interface DocumentReader {
  readonly format: FormatId;                    // "pdf"
  readonly label: string;                       // "PDF" (shown in "We read: PDF")
  readonly accept: { mime: string[]; extensions: string[] };   // drives <input accept> and drop validation
  readonly maxBytes: number;                    // 10 MB for PDF
  readonly capabilities: ReaderCapabilities;    // positions / pages / graphics / structure

  /** Cheap check on the first bytes, before the full read (e.g. "%PDF-"). */
  sniff(head: Uint8Array): boolean;

  /** Bytes → Document. Never touches the network. Reports per-page progress. */
  read(input: { bytes: Uint8Array; fileName: string }, opts: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  }): Promise<Document>;
}

class ReadError extends Error {
  code: "unsupported" | "too-large" | "encrypted" | "corrupt" | "empty";
}
```

Rules:

- `read` MUST produce a `Document` that satisfies `data-model.md#document` for its declared
  capabilities.
- A reader MUST NOT import from `ui/` or another reader.
- Registering a reader: one line in `container.ts` (`registry.register(new PdfReader(pdfjs))`).
  `FormatRegistry.match(file)` picks a reader by extension and MIME type, then confirms with
  `sniff`.

## FormatRegistry (application)

```ts
interface FormatRegistry {
  register(reader: DocumentReader): void;
  readers(): readonly DocumentReader[];
  match(file: { name: string; type: string; head: Uint8Array }): DocumentReader | null;
  acceptAttribute(): string;                    // ".pdf,application/pdf"
}
```

## AiEngine: one per on-device model provider

```ts
type EngineAvailability = "no-api" | "unavailable" | "downloadable" | "downloading" | "available";

interface EngineFacts {                         // shown in "About the AI"
  provider: string;                             // "Google Chrome"
  model: string;                                // "Gemini Nano"
  runsOn: "device";                             // the only accepted value (Principle II)
  downloadSize?: string;                        // shown in the consent dialog
  requirements: string[];                       // human-readable; localised by key
  languages: string[];                          // officially supported, e.g. ["en","es","ja","de","fr"]
  docsUrl: string;                              // shown as text, not fetched
}

interface AiEngine {
  readonly id: string;                          // "chrome-built-in"
  readonly facts: EngineFacts;
  availability(langs: { input: string[]; output: string }): Promise<EngineAvailability>;
  /** Must be called from a user gesture after consent; resolves when the model is ready. */
  prepare(opts: { langs: { input: string[]; output: string }; onProgress?: (p: number) => void; signal?: AbortSignal }): Promise<void>;
  createSession(opts: { system: string; langs: { input: string[]; output: string }; signal?: AbortSignal }): Promise<AiSession>;
}

interface AiSession {
  prompt(input: string | PromptMessage[], opts?: { schema?: JsonSchema; signal?: AbortSignal }): Promise<string>;
  // Final answer turn whose reply must start with "{" -- each engine does this
  // its most reliable way (Chrome: assistant prefix + streaming + fallback).
  promptObject(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  clone(opts?: { signal?: AbortSignal }): Promise<AiSession>;
  destroy(): void;
  readonly contextWindow?: number;
  readonly contextUsage?: number;
}

type PromptMessage = { role: "user" | "assistant"; content: string; prefix?: boolean };
```

Rules:

- The orchestrator depends on `AiSession` only. Engine quirks (decoder schema reduction, the
  assistant-prefix trick, the streaming fallback) live in the adapter, unless they are about
  validating output, which is the orchestrator's job.
- An engine whose `facts.runsOn` is not `"device"` MUST NOT be registered. The container asserts
  this.
- Several engines may be registered. The UI uses the first that reports `available`, then
  `downloadable`.

## Use cases (application/usecases), what the UI calls

| Use case | Input | Output / events |
|---|---|---|
| `readDocument` | `File` | `Document` or `ReadError`; progress `{ step: "read", page, pages }` |
| `measureLayout` | `Document` | `{ index, docInfo, outline, facts, measuredFindings }` (no AI) |
| `checkEngine` | ui lang, CV lang | `{ engine, availability }` |
| `prepareEngine` | engine | progress 0..1. Only after consent. |
| `analyseCv` | measured result, engine, lang, signal | `Report`; events per step/tool call |
| `compareJob` | report, posting, title | `Report` with `job`; events |
| `compareRescan` | previous, current report | `RescanDiff` |

## Presenters (adapters/presenters)

`presentReport(report, t) → ReportViewModel` converts domain data to display-ready data:
localised labels, provenance badge kind, evidence links, fix-first, and grouped checks including
passed and not-applicable ones. The React components render view models and hold no domain
logic.
