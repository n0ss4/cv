---
description: "Tasks for the chat (005)"
---

# Tasks: Ask about your CV (chat)

Paths are relative to `web/`. Tests are required (SC-001, SC-002).

## Phase 1: Foundational

- [X] T001 `src/domain/chat/model.ts` per data-model.md.
- [X] T002 Orchestrator: frame tool results as document data, for all tasks; system prompt rule 7.
- [X] T003 `ask` task + `ASK` schema in `src/application/prompts/`; `TaskContext` gains `question`, `history`, `reportSummary`; `PROMPT_VERSION` 3.2.0.
- [X] T004 `src/application/usecases/askCv.ts` (run, verify, guard, refusal, memory of 4).
- [X] T005 Tests `tests/application/ask.test.ts` (fake engine; includes an injection line in a text CV).

## Phase 2: US1–US4 UI

- [X] T006 [US1] Chat state and actions in `src/ui/app/analysis.ts`, and an `ask()` / `stopAsk()` pair in `AnalysisProvider` (log updates, abort).
- [X] T007 [US1] `src/ui/components/chat.tsx`: intro, starters, message log (polite live region), composer with Send/Stop, live tool status, citations → ATS view, rewrite cards with Copy, unverified and refusal states.
- [X] T008 [US1] Ask tab in `ResultsScreen`; unavailable states (no AI / no profile).
- [X] T009 [US1] i18n en/es.
- [X] T010 [US1] Tests `tests/ui/chat.test.tsx` + reducer cases.

## Phase 3: Polish

- [X] T011 Design: "13 Results — Ask" frame in the grafta file (v4) and design README.
- [X] T012 Docs (CLAUDE.md, README) and full `make check && make test && make web-test`; real-Chrome screenshot of the unavailable state.
