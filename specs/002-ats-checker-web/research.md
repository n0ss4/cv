# Research: In-Browser ATS Checker (on-device AI)

## R1. On-device model: Chrome Prompt API (Gemini Nano)

- **Decision**: use the Prompt API (`LanguageModel`) on the web, with `responseConstraint`
  (JSON Schema) for every output.
- **Facts checked (developer.chrome.com, 2026-10)**: web availability from Chrome 148; extensions
  since 138. Desktop only: Windows 10/11, macOS 13+, Linux, ChromeOS Chromebook Plus. GPU with
  > 4 GB VRAM, or CPU with 16 GB RAM and 4+ cores. ≥ 22 GB free disk; the model is removed if free
  space drops below 10 GB. Unmetered connection for the first download only. Prompt languages:
  en, es, de, fr, ja (no Catalan). `LanguageModel.availability(opts)` →
  `unavailable | downloadable | downloading | available`; `LanguageModel.create(opts)` needs a
  user gesture to start a download and reports progress through `monitor(m)` /
  `downloadprogress`. Sessions: `prompt()`, `promptStreaming()`, `append()`, `clone()`,
  `destroy()`, `contextWindow`, `contextUsage`, `measureContextUsage()`, `contextoverflow` event,
  `AbortSignal` everywhere. Not available in Web Workers. `temperature`/`topK` are
  extension-only; the web has `samplingMode` behind an origin trial.
- **Rationale**: it is the only way to run an LLM in the browser with no download managed by the
  page, no WebGPU model shipping, and no server. Inference stays on the device (Principle II).
- **Alternatives considered**: WebLLM/transformers.js with a model shipped by the page
  (hundreds of MB to GB served by us, slower, and the page would host model weights); a server
  API (violates Principle II); the previous rule-based checker (the owner chose AI).

## R2. Tool use without native tool calling

- **Finding**: the Prompt API documents no `tools` option or function calling.
- **Decision**: an orchestrator loop (`web/js/agent.js`). Each turn is constrained by a small
  "next action" schema (`contracts/tools.md`): the model names a tool and its arguments or says
  `answer`; the orchestrator runs the tool, appends the result as a user message, and loops (max 8
  calls). On `answer`, the next prompt carries the task's output schema. Results are validated;
  one retry with the validation error, then the step is marked failed.
- **Rationale**: keeps every turn schema-constrained (Nano does not have to emit free-form JSON
  inside prose), keeps tools deterministic and auditable, and works today.

## R3. Task decomposition for a small model

- **Decision**: one task per session, cloned from a base session that holds the shared system
  prompt: `extract_contact`, `extract_sections_experience`, `extract_education_skills`,
  `review`, and with a posting `extract_job`, `match_job`. `doc_info` and `outline` are pre-run and
  given in the first message.
- **Rationale**: Nano's context is small (read at runtime from `contextWindow`); short focused
  prompts with few-shot examples and constrained output are far more reliable than one long
  "analyse this CV" prompt. Splitting also lets the UI show real progress.

## R4. Grounding and verification

- **Decision**: every extracted value and every finding carries line references; the
  orchestrator checks the referenced line contains the value/quote (normalised). Unverifiable
  items are flagged, never shown as evidence.
- **Rationale**: small models hallucinate; verification turns "the AI said so" into "the AI said
  so, and here is the line". It also measures extraction quality on the eval page (SC-003).

## R5. Layout facts as tools

- **Decision**: geometry the model cannot see in text — side-by-side text blocks, header/footer
  zones, bullet-only lines, date-only and right-edge dates, hyphen breaks, unusual characters —
  is computed by `layout_facts` from pdf.js positions and handed to the model as data.
- **Rationale**: these are the defects proven to break parsers in this project; they are
  observations, not scores. The model decides whether they matter and explains them.

## R6. PDF extraction

- **Decision**: pdf.js 5.7.284, vendored (unchanged from the first plan), `disableNormalization`
  so ligature glyphs are visible as-is, `isEvalSupported:false`, no worker fetch.

## R7. Styling

- **Decision**: Tailwind CSS v4.3.3 standalone CLI (`scripts/tailwind.sh`, checksum-pinned, no
  npm); output `web/styles.css` committed. CDN Tailwind rejected: needs network and a runtime
  script, both forbidden by the CSP.

## R8. Testing a model we cannot run in CI

- **Decision**: three layers. (1) Node tests for tools, verification and scoring — deterministic.
  (2) Node tests for the orchestrator with a scripted fake `LanguageModel` (replays turns, checks
  the loop, retries, limits, schema validation, verification). (3) `web/eval.html`, run manually in
  a supported Chrome, feeds every fixture to the real model and scores the result against each
  fixture's expectations (`web/tests/fixtures/expectations.json`) — the prompt-iteration loop.
- **Rationale**: CI cannot download Gemini Nano; prompts are still tested, just on real hardware.

## R9. Determinism

- **Finding**: the web exposes no temperature; `samplingMode` needs an origin trial.
- **Decision**: request `samplingMode: "most-predictable"` when `LanguageModel.params` /
  the option is accepted, otherwise defaults; rely on constrained output, closed enums and
  verification for stability. SC on stability is measured on the eval page (two runs).
