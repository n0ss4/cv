# Tasks: In-Browser ATS Checker (on-device AI)

## Phase 1: Setup

- [x] T001 Vendor pdfjs-dist 5.7.284 into `web/vendor/pdfjs/` (integrity recorded)
- [x] T002 `scripts/tailwind.sh` (Tailwind 4.3.3 standalone, checksums per platform); `make web-css`
- [x] T003 Makefile: `web`, `web-css`, `web-test`; gitignore Tailwind DS reference file
- [x] T004 Constitution 1.2.0: on-device model download; build-time Tailwind CLI

## Phase 2: Foundational

- [x] T005 `extract.js` (pdf.js → Document, typed errors)
- [x] T006 `lines.js` (parser-order and geometric lines)
- [x] T007 `tools.js`: doc_info, outline, read_lines, search, layout_facts per contracts/tools.md
- [x] T008 `verify.js`, `report.js` (catalogue lookup, scoring, verdict)
- [x] T009 Remove rule-based `analyze.js`, `headings.js`, `keywords.js`; keep fixtures
- [x] T010 Tests: tools/layout facts on fixture PDFs, verification, scoring

## Phase 3: US1 + US2 — AI review and extracted profile (P1) 🎯

- [x] T011 `prompts/schemas.js`, `prompts/findings.js` (sources of truth for the contracts)
- [x] T012 `prompts/system.js`, `prompts/tasks.js` — task prompts with few-shot examples
- [x] T013 `ai.js`: availability, user-gesture download with progress, base session, clone per task
- [x] T014 `agent.js`: turn schema, tool loop (max 8), answer phase, validation + 1 retry, abort
- [x] T015 Orchestrator tests with `tests/fake-model.mjs`
- [x] T016 Design update (grafta): model download, AI unavailable, analysing steps, profile tab, audit log
- [x] T017 `index.html`, `src/tailwind.css`, `app.js`: upload, support states, progress, results
  (review with breakdown, profile, ATS view, audit log)

## Phase 4: US4 — No built-in AI (P1)

- [x] T018 Unsupported notice above the fold; ATS-view-only flow

## Phase 5: US3 — Job comparison (P2)

- [ ] T019 `extract_job` + `match_job` tasks and the Job tab

## Phase 6: US5 + Polish

- [x] T020 `eval.html` + `tests/fixtures/expectations.json`
- [x] T021 Static tests: CSP, no external URLs, i18n completeness; CI: node, web-test, web-css check, Pages
- [ ] T022 README/CLAUDE.md; manual quickstart V2–V3 in supported Chrome
