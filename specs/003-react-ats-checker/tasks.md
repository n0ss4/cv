---
description: "Tasks for ATS Checker 2 (React + TS, Clean Architecture)"
---

# Tasks: ATS Checker 2 — rebuilt app, extensible formats, transparent AI

**Input**: `specs/003-react-ats-checker/` (plan, spec, research, data-model, contracts, quickstart)

**Tests**: required. The spec asks for them: FR-027 (fake-model end to end), SC-007 (second
format), SC-009 (a11y), and the CSP and architecture guards. All paths are relative to the repo
root, and `web/` is the app.

**Porting rule**: 002's behaviour is the reference. When a task says "port X", it means: move
the logic of `web/js/X` into TypeScript, keep the algorithm and constants, and port the
matching tests from `web/tests/*.mjs` first.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Amend `.specify/memory/constitution.md` to 1.3.0: Principle V allows a lockfile-pinned npm toolchain for `web/` only (install with `npm ci`, run via `make web*`, never needed to build a CV), replacing vendored pdf.js and the Tailwind standalone CLI. CI may deploy the static checker to Pages. Update the Sync Impact Report.
- [X] T002 Create `web/package.json` (private, `"type": "module"`, exact versions from plan Technical Context, scripts `dev`, `build`, `preview`, `test`, `typecheck`) and generate `web/package-lock.json` with `npm install`.
- [X] T003 [P] Create `web/tsconfig.json` (strict, `noUncheckedIndexedAccess`, `jsx: react-jsx`, `moduleResolution: bundler`, paths `@domain/*`, `@app/*`, `@adapters/*`, `@infra/*`, `@ui/*`).
- [X] T004 [P] Create `web/vite.config.ts`: react + tailwind plugins, the path aliases, two HTML inputs (`index.html`, `eval.html`), the `csp` plugin from research R4 (production policy at build, HMR-only relaxation in dev), and a vitest config (node env by default, jsdom for `tests/ui/**`).
- [X] T005 [P] Update `.gitignore`: `web/node_modules/`, `web/dist/`, `web/public/eval-fixtures/`.
- [X] T006 Rewrite the web targets in `Makefile` per plan "Make targets" (`web-deps`, `web`, `web-build`, `web-preview`, `web-test`, `web-eval`, `web-fixtures`). Remove `web-css`.

## Phase 2: Design (FR-025, before UI implementation)

- [X] T007 Create `specs/003-react-ats-checker/design/ats-checker-v2.fig` with grafta: a Theme variable collection (Light/Dark) evolved from 002's teal tokens, text styles, the components in `contracts/ui.md#components` with variants, and frames for screens 1–15 on desktop (1440) plus mobile (390) for 1, 5, 6, 9 and 11, with Results Overview also in Dark. Render each frame to check it.
- [X] T008 Write `specs/003-react-ats-checker/design/README.md`: frame list, token table (Light/Dark), type scale, spacing, and component variants. It is the source for `web/src/ui/styles/tokens.css`.

## Phase 3: Foundational (blocks every story)

### Domain (pure)

- [X] T009 [P] Port the document types and line reconstruction into `web/src/domain/document/{types,lines,index}.ts` (`Document`, `PositionedItem`, `atsLines`, `geometricLines`, `indexDocument`, `fold`) per data-model.md. Pages with `lines` bypass reconstruction.
- [X] T010 [P] Port the layout facts into `web/src/domain/layout/facts.ts`, with applicability, and add the new facts (`table_grid`, `graphics_pages`, `shape_rows`, `ambiguous_dates`, `unlabelled_contact`) per `contracts/tools.md`.
- [X] T011 [P] Create the catalogue in `web/src/domain/findings/catalogue.ts` (all types of `contracts/findings.md`, with source, category, severity, definition, why/fix in en/es, searchable) and `web/src/domain/findings/types.ts`.
- [X] T012 Implement the measured rules in `web/src/domain/layout/rules.ts` (facts → measured `Finding[]`, thresholds as named constants) per `contracts/findings.md#measured`.
- [X] T013 [P] Port scoring into `web/src/domain/scoring/score.ts` (category score, weights, overall, cap, verdict incl. `incomplete`/`measured-only`) and `fixFirst()`, ordered per contract.
- [X] T014 [P] Port verification into `web/src/domain/profile/verify.ts` (`verifyValue`, `verifyProfile`, `verifyEvidence`), plus `provenanceOf(finding, profile)`.
- [X] T015 [P] Implement the rescan diff in `web/src/domain/rescan/diff.ts` per `contracts/findings.md#rescan-diff`.
- [X] T016 [P] Tests in `web/tests/domain/*.test.ts`: lines/index (ported), layout facts on every fixture PDF (ported, plus a new fixture per new fact), rules (each rule fires on its fixture and never on the example CV), scoring and verdict (ported), fix-first ordering, verify (ported), rescan diff.

### Application

- [X] T017 [P] Ports in `web/src/application/ports/{DocumentReader,AiEngine}.ts` exactly as `contracts/ports.md`. `FormatRegistry` in `web/src/application/formats/registry.ts`.
- [X] T018 [P] Port the tools into `web/src/application/tools/tools.ts` (`docInfo` adds format/capabilities, `outline`, `readLines`, `search`, `layoutFacts` serialising non-applicable facts as `"not applicable for <format>"`, `runTool`).
- [X] T019 [P] Port the prompts into `web/src/application/prompts/{system,tasks,schemas,VERSION}.ts`, each exporting `{ id, version, purpose, inputs, text }`. The review enum and brief carry AI types only, and list the measured findings as already reported.
- [X] T020 Port the orchestrator into `web/src/application/agent/{json,validate,orchestrator}.ts` (parse/salvage/repair/validate, `runTask`, consistency guard, `forModel` clipping) against the `AiSession` port. Log entries follow `ToolCall` (kinds tool/prompt/retry/failure, with `at`).
- [X] T021 Use cases in `web/src/application/usecases/`: `readDocument.ts`, `measureLayout.ts`, `checkEngine.ts`, `prepareEngine.ts`, `analyseCv.ts` (measured + AI merge, report build, progress events), `compareJob.ts`, `compareRescan.ts`.
- [X] T022 [P] Port the scripted fake engine into `web/tests/fakes/fakeEngine.ts` (implements `AiEngine`/`AiSession`).
- [X] T023 Tests in `web/tests/application/*.test.ts`: tools (ported), validate/repair/salvage (ported), orchestrator loop/limits/retry/abort (ported), and `analyseCv` end to end with the fake engine and the real PDF reader on the fixtures (FR-027).

### Adapters and infrastructure

- [X] T024 [P] `PdfReader` in `web/src/adapters/readers/pdf/PdfReader.ts`: pdfjs module injected, 002's options, `sniff` `%PDF-`, errors mapped to `ReadError`, `PageGraphics` from operator lists (research R5), lazy import in the browser.
- [X] T025 [P] `ChromeBuiltInEngine` in `web/src/adapters/ai/chrome/ChromeBuiltInEngine.ts`, porting `web/js/ai.js` and the engine-specific parts of `agent.js` (decoder schema reduction, assistant-prefix, streaming fallback), with `facts` per `contracts/ports.md`.
- [X] T026 [P] Presenters in `web/src/adapters/presenters/{report,profile,log}.ts` (`ReportViewModel` incl. grouped checks: attention / passed / not applicable).
- [X] T027 Composition root `web/src/infrastructure/container.ts` (registry with `PdfReader`, engine list, `runsOn` assertion) and `web/src/main.tsx`.
- [X] T028 [P] Tests: `web/tests/adapters/pdfReader.test.ts` (fixtures, encrypted/corrupt/not-pdf), `web/tests/adapters/chromeEngine.test.ts` (against a stub `LanguageModel`), `web/tests/adapters/presenters.test.ts`.
- [X] T029 [P] Architecture guard `web/tests/architecture.test.ts` per research R10.

### UI shell

- [X] T030 [P] Tokens and base styles in `web/src/ui/styles/{tokens.css,app.css}` from design README (Tailwind `@theme`, light/dark via `prefers-color-scheme`).
- [X] T031 [P] i18n in `web/src/ui/i18n/{en,es,index}.ts` (typed keys, `useT`, browser default, in-memory switch).
- [X] T032 Analysis state machine in `web/src/ui/app/analysis.ts` (reducer + actions per `contracts/ui.md`) and `web/src/ui/app/AnalysisProvider.tsx` (wires use cases, AbortController per run). Reducer tests in `web/tests/ui/analysis.test.ts`.
- [X] T033 Base components in `web/src/ui/components/base/` (Button, Notice, Dialog, Drawer, Tabs, Badge), plus `web/src/ui/app/App.tsx` with Header and a screen switch.

**Checkpoint**: `make web-test` is green on domain/application/adapters, and the app shell renders.

## Phase 4: User Story 1 — Check a CV, know what to fix first (P1) 🎯 MVP

Independent test: example CV → *ready*, and the fix-first list has no critical or major item.
Two-column → fix-first[0] = `multi_column_layout`.

- [X] T034 [P] [US1] `DropZone` in `web/src/ui/components/DropZone.tsx` (accept from registry, drag, keyboard, error state).
- [X] T035 [P] [US1] `StepList` in `web/src/ui/components/StepList.tsx` (statuses, live region, Cancel).
- [X] T036 [P] [US1] `VerdictCard`, `ScoreRing` (SVG, no inline style), `CategoryBar` in `web/src/ui/components/results/`.
- [X] T037 [P] [US1] `FindingCard` + `FixFirst` in `web/src/ui/components/results/`.
- [X] T038 [US1] Screens `StartScreen`, `AnalysingScreen`, `ResultsScreen` (Overview + All checks tabs), `ErrorScreen` in `web/src/ui/screens/`.
- [X] T039 [US1] UI tests `web/tests/ui/us1.test.tsx`: drop → steps → results with the fake engine; cancel; second drop cancels; scanned → unreadable without prompts; axe has no violations.

## Phase 5: User Story 2 — Trust: privacy and AI transparency (P1)

Independent test: privacy chip on every screen. Panels show the content in `contracts/ui.md`
(11–13). Every finding has a provenance badge.

- [X] T040 [P] [US2] `PrivacyStatus` chip + `PrivacyPanel` in `web/src/ui/components/transparency/` (CSP quoted from the live `<meta>`, "Check it yourself" steps).
- [X] T041 [P] [US2] `AboutAiPanel` (engine facts, limits, language quality note, prompt version) and `PromptsViewer` (exact texts from `application/prompts`).
- [X] T042 [P] [US2] `ProvenanceBadge` (3 kinds, tooltip + sr-only text) used by FindingCard and the profile.
- [X] T043 [P] [US2] `AiLogDrawer` (live entries by task, tool, args, result preview, ms, retries/failures).
- [X] T044 [US2] "Clear" action: resets the state machine and drops the report, previous report and log. It confirms via a Notice.
- [X] T045 [US2] UI tests `web/tests/ui/us2.test.tsx` (chip present on every screen, panel contents, badges, log during a run, Clear empties everything).

## Phase 6: User Story 3 — What the ATS will file (P1)

- [X] T046 [P] [US3] `ProfileView` + `ProfileField` (found / not found / unverified, searchable marker, line links) in `web/src/ui/components/profile/`.
- [X] T047 [P] [US3] `AtsView` (numbered lines, highlight + scroll to evidence, Copy) in `web/src/ui/components/AtsView.tsx`.
- [X] T048 [US3] Wire the Profile and ATS view tabs. Finding → "Show in ATS view". Tests in `web/tests/ui/us3.test.tsx`.

## Phase 7: User Story 6 — Browser capability, consent, measured-only (P1)

- [X] T049 [US6] Start-screen notices for `downloadable` / `no-api` / `unavailable` and the `ConsentDialog` (screens 2–4) in `web/src/ui/screens/`.
- [X] T050 [US6] Measured-only results (screen 15). Download progress in the step list and the privacy chip (`downloading-model`).
- [X] T051 [US6] Tests `web/tests/ui/us6.test.tsx`: no-api → measured findings only, no score or profile; consent declined → measured-only; consent accepted → progress → analysis continues.

## Phase 8: User Story 4 — Rescan comparison (P2)

- [X] T052 [US4] Keep `previous` in the state machine. `RescanBanner` in `web/src/ui/components/results/RescanBanner.tsx` with resolved / new / unchanged.
- [X] T053 [US4] Test `web/tests/ui/us4.test.tsx`: two-column then the example → column finding resolved, score up. Clear removes previous.

## Phase 9: User Story 5 — Job match (P2)

- [X] T054 [US5] `JobMatch` tab in `web/src/ui/components/JobMatch.tsx` (posting + title, chips with evidence, rescored report, keyword-omitted note).
- [X] T055 [US5] Test `web/tests/ui/us5.test.tsx` with the fake engine's job scripts.

## Phase 10: User Story 7 — New formats without a rewrite (P2)

- [X] T056 [US7] Test-only `TextReader` in `web/tests/fakes/TextReader.ts` (`capabilities: { positions: false, pages: false, graphics: false, structure: false }`).
- [X] T057 [US7] `web/tests/application/formats.test.ts`: registering TextReader → registry accept/help text includes it; a `.txt` CV is analysed end to end with the fake engine; positional facts report not applicable and their rules do not fire (SC-007, US7-3).
- [X] T058 [US7] `web/src/adapters/readers/README.md`: how to add a reader (Word notes from research R6).

## Phase 11: Polish and cross-cutting

- [X] T059 Port the evaluation page: `web/eval.html` + `web/src/eval/main.tsx` (fixtures from `public/eval-fixtures/`, expectations from `web/tests/fixtures/expectations.json`; measured types are checked deterministically, AI types with the real model).
- [X] T060 [P] Move the fixtures: `web/tests/fixtures/*.tex` stay, and add `.tex` fixtures for `table_layout`, `text_as_graphics`, `skill_rating_graphics`, `ambiguous_date_format`, `icon_only_contact` with entries in `expectations.json`.
- [X] T061 [P] Build guard `web/tests/build.test.ts` (runs after `vite build`: exact CSP, no absolute asset URLs, no `style=` in HTML, worker emitted same-origin).
- [X] T062 Remove 002's implementation: `web/js/`, `web/vendor/`, `web/styles.css`, `web/src/tailwind.css`, `web/tests/*.mjs`, `scripts/tailwind.sh`.
- [X] T063 CI: add the `web` job to `.github/workflows/build.yml`, and create `.github/workflows/pages.yml` per plan "CI".
- [X] T064 [P] Docs: update `CLAUDE.md` (project tree, web build, Clean Architecture layers, CI publishes the checker only) and `README.md` (web section).
- [X] T065 Run `make check DATA=example/cv.toml && make test && make web-test && make web-build`, then quickstart scenarios 1–12 that can run without the real model. Note any that need the user's Chrome.

## Dependencies

- Setup (T001–T006) → Design (T007–T008) → Foundational (T009–T033).
- Domain T009 → T010 → T012. Domain tests T016 follow T009–T015.
- T017 → T018/T020/T021. T020 → T021. T024/T025 need T017.
- UI tokens T030 need T008. Every story phase needs the Foundational phase.
- US1 → US2/US3 (they add to Results). US6 and US7 are independent of US2–US5. US4 and US5
  need US1.
- Polish last. T062 only after every ported test passes on the new code.

## Parallel examples

- Foundational: T009, T011, T013, T014, T015 together. Then T017, T018, T019, T022 together.
  Then T024, T025, T026, T029, T030, T031.
- US1: T034–T037 together, then T038 and T039.
- US2: T040–T043 together.

## Implementation strategy

MVP = Setup + Design + Foundational + US1 (the drop → fix-first flow with measured + AI
findings). Then US2 and US3 (the transparency and the evidence the user asked for), then US6,
US4, US5, US7, then Polish. Each phase ends with a green `make web-test`.
