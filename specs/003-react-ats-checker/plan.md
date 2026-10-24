# Implementation Plan: ATS Checker 2 — rebuilt app, extensible formats, transparent AI

**Branch**: `003-react-ats-checker` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-react-ats-checker/spec.md`

## Summary

Rebuild the in-browser ATS checker (spec 002) as a React + TypeScript app in a Clean
Architecture. The rebuild keeps 002's guarantees: on-device AI only, no outbound connections,
tools that return data, verified evidence, and a published scoring formula. It moves the logic
into layers whose dependencies point inwards:

- the **domain** holds the document model, findings catalogue, scoring, verification and rescan
  diff, as pure TypeScript;
- the **application** holds the use cases, the agent orchestrator, the document tools and the
  versioned prompts, and talks to the outside only through ports (`DocumentReader`, `AiEngine`);
- the **adapters** implement those ports (a pdf.js reader, the Chrome Prompt API engine) and map
  reports to view models;
- the **UI** is React, driven by a single analysis state machine.

File formats become pluggable readers in a registry, so Word is one adapter away. Parsing
defects that can be measured are now measured deterministically and labelled *Measured*, and the
model concentrates on extraction and content review. The UI is redesigned in a new grafta file,
with privacy status, "About the AI", provenance labels and the AI log as first-class elements.

## Technical Context

**Language/Version**: TypeScript 7.0.2 (`strict`, `noUncheckedIndexedAccess`), ES2023 target;
Node ≥ 22 for development and CI only.

**Primary Dependencies** (exact versions, lockfile-pinned, each released ≥ 2 weeks before
2026-10-17; see research R1):
runtime: react 19.3.0, react-dom 19.3.0, pdfjs-dist 6.3.289.
build/test: vite 8.3.2, @vitejs/plugin-react 6.1.1, tailwindcss 4.3.3 + @tailwindcss/vite 4.3.3,
vitest 5.0.3, jsdom 30.1.1, @testing-library/react 16.3.3, @testing-library/user-event 14.6.7,
axe-core 4.13.0, @types/react 19.3.0, @types/react-dom 19.3.0.

**Storage**: none (FR-002). Session state lives in memory only.

**Testing**: Vitest. Domain and application are tested in Node. The orchestrator runs with the
scripted fake model ported from 002, and the PDF reader runs on fixture PDFs built by tectonic.
UI components are tested in jsdom with Testing Library and an axe-core check per screen. A build
test checks the CSP and same-origin assets in `dist/`. `eval.html` stays the real-model
evaluation, run by hand.

**Target Platform**: evergreen browsers. AI features need desktop Chrome with the built-in model
(spec Assumptions); everything else works without it.

**Project Type**: static single-page web app inside the existing repository (`web/`).

**Performance Goals**: first step indicator < 1 s after drop; full review of a 2-page CV < 60 s
with the model present (SC-006); initial JS ≤ 250 kB gzip excluding the pdf.js worker, which loads
lazily on the first file.

**Constraints**: CSP `connect-src 'none'` in the built page; no storage APIs; all assets
same-origin; WCAG 2.1 AA; en/es; usable at 390 px; dark mode follows the system.

**Scale/Scope**: about 10 screens and states, 2 locales, about 30 finding types, 1 format (PDF)
and 1 engine (Chrome built-in), each with an extension point.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Privacy by default | ✅ | No user data in the repo. Fixtures stay fictional (`example.com`). The Pages artifact is built from tracked files only. |
| II. Local-first | ✅ | Inference is on the device, the CSP forbids connections, nothing is stored. The static page is allowed on Pages by II. |
| III. ATS-readable output | ✅ | The builder is untouched, and `make check` and `make test` still gate. |
| IV. Data, not code | ✅ | Not affected. |
| V. One build path, minimal dependencies | ⚠️ → amendment | An npm toolchain for `web/` is not allowed today. **Amendment 1.3.0** (MINOR, as for pdf.js and Tailwind before) will allow a lockfile-pinned npm dependency set for `web/` only, installed with `npm ci`, run only through `make web*` targets, and never needed to build a CV. It replaces the vendored pdf.js and the Tailwind standalone CLI (`scripts/tailwind.sh` is removed). Adding a package still needs an amendment-listed reason in `research.md`. |
| VI. Fork-friendly simplicity | ✅ | Clone to first PDF stays at three commands, because the web app is optional. |

Post-design re-check (after Phase 1): still ✅, provided the amendment lands in the same PR as the
toolchain. The added CI deployment job publishes the tool only (`contents: read`,
`pages: write`, `id-token: write`, on `main` only), which is consistent with II. CLAUDE.md's "CI
publishes nothing" line is updated to "CI publishes the static checker only, never a CV".

## Project Structure

### Documentation (this feature)

```text
specs/003-react-ats-checker/
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── ports.md         # DocumentReader, AiEngine, presenters: the extension points
│   ├── tools.md         # document tools (002) + new layout facts
│   ├── findings.md      # catalogue (002 + research-driven types), measured rules, scoring, fix-first, rescan
│   ├── schemas.md       # model output schemas (002, unchanged unless noted)
│   └── ui.md            # screens, analysis state machine, transparency content
├── design/
│   ├── README.md        # frames, tokens
│   └── ats-checker-v2.fig
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code

```text
web/
├── package.json  package-lock.json  tsconfig.json  vite.config.ts
├── index.html                    # app entry; CSP injected at build (see research R4)
├── eval.html                     # real-model evaluation entry
├── public/favicon.svg
├── src/
│   ├── domain/                   # pure: no imports outside domain/
│   │   ├── document/             # Document, Line, PositionedItem; parser-order + geometric lines; line index
│   │   ├── layout/               # LayoutFacts and the measurement functions
│   │   ├── findings/             # catalogue, Finding, Severity, Category, Provenance
│   │   ├── profile/              # ExtractedProfile, evidence verification
│   │   ├── scoring/              # category score, overall, verdict, cap, fix-first ordering
│   │   └── rescan/               # report diff
│   ├── application/              # imports domain/ only
│   │   ├── ports/                # DocumentReader, AiEngine, AiSession, Clock
│   │   ├── formats/              # FormatRegistry
│   │   ├── tools/                # doc_info, outline, read_lines, search, layout_facts
│   │   ├── agent/                # orchestrator loop, JSON parse/repair/validate, task runner
│   │   ├── prompts/              # system, tasks, schemas, catalogue text (versioned)
│   │   └── usecases/             # readDocument, measureLayout, analyseCv, compareJob, checkEngine, prepareEngine, compareRescan
│   ├── adapters/                 # imports application/ + domain/
│   │   ├── readers/pdf/          # PdfReader (pdfjs-dist) → Document
│   │   ├── ai/chrome/            # ChromeBuiltInEngine (LanguageModel)
│   │   └── presenters/           # Report → ReportViewModel, profile & log view models
│   ├── infrastructure/           # composition root: builds the registry and engine, pdf.js worker URL
│   │   └── container.ts
│   └── ui/                       # React; imports application/ (use cases, types) + presenters, never adapters directly
│       ├── app/                  # App, AnalysisProvider (state machine), routes-less screen switch
│       ├── components/           # Header, PrivacyStatus, DropZone, StepList, Verdict, ScoreBreakdown, FixFirst, FindingCard, ProvenanceBadge, ProfileView, AtsView, JobMatch, RescanDiff, AiLog, panels
│       ├── i18n/                 # en.ts, es.ts, useT()
│       └── styles/               # tailwind entry + design tokens (@theme)
├── tests/
│   ├── domain/ application/ adapters/ ui/   # mirrors src/
│   ├── architecture.test.ts      # enforces the dependency rule by scanning imports
│   ├── build.test.ts             # CSP + same-origin on dist/
│   ├── fakes/                    # fake AiEngine (scripted, port of fake-model.mjs), test-only TextReader
│   └── fixtures/                 # .tex sources + expectations.json (moved from 002)
└── dist/                         # build output, gitignored
```

**Structure Decision**: a single Vite project in `web/`, with layers as directories and the
dependency rule (`domain ← application ← adapters/ui ← infrastructure`) enforced by
`tests/architecture.test.ts`, without an extra lint dependency. `infrastructure/container.ts` is
the only module that imports concrete adapters. The UI receives use cases through a React
context. The old `web/js`, `web/vendor`, `web/styles.css`, `web/src/tailwind.css`,
`web/tests/*.mjs` and `scripts/tailwind.sh` are removed once their behaviour is ported, and their
tests are ported first.

### Make targets

| Target | Does |
|---|---|
| `web-deps` | `npm ci` in `web/` when `package-lock.json` is newer than `node_modules` |
| `web` | Vite dev server on `127.0.0.1:$(WEB_PORT)` (dev CSP allows Vite's HMR socket only) |
| `web-build` | type-check + `vite build` → `web/dist/` with the production CSP |
| `web-preview` | serves `web/dist/` on loopback, which is what Pages serves |
| `web-test` | `web-fixtures` + `vitest run` (all layers, architecture, build test) |
| `web-eval` | `web-fixtures`, copy fixture PDFs to `web/public/eval-fixtures/` (gitignored), dev server; open `/eval.html` |
| `web-fixtures` | unchanged from 002 (tectonic builds the fixture PDFs) |

### CI

- `build.yml`: add a `web` job (Node 22, `make web-test web-build`) next to the existing one.
- New `pages.yml`: on push to `main` (and manual dispatch), runs `make privacy web-test
  web-build`, then `actions/upload-pages-artifact` with `web/dist` and `actions/deploy-pages`.
  It has `pages: write`, `id-token: write` and `contents: read` permissions, and the build never
  reads `mycv/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| npm toolchain in `web/` (Principle V) | The user asked for React + TypeScript. TSX needs a compiler and bundler, and pdf.js and Tailwind come from npm anyway. | Vendored builds without a bundler (002's approach) cannot compile TSX. A CDN violates the CSP and Principle II. |
| Five layers for a small app | The user asked for Clean Architecture, and the extension points (formats, engines) are real requirements (FR-011, FR-014). | Feature folders without ports would bring back 002's problem, where a new format touches everything. |
