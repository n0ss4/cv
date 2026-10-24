---
description: "Tasks for the chat with your CV (006)"
---

# Tasks: Chat with your CV (one assistant, beside the report)

Paths are relative to `web/`. Tests are required (SC-001, SC-002, SC-004).

## Phase 1: Foundational

- [X] T001 `src/domain/chat/model.ts`: page role, `PageEvent`, `Card`, `cards`, `needsPosting`, `reportId`, `Rewrite.postingMissing`; `memoryOf` skips page messages.
- [X] T002 [P] `src/domain/chat/context.ts`: `compactJob(job)` (R5 limits), `postingTermsInCv(job)`, `cardsFor(kinds, job)` (drops kinds without data); tests `tests/domain/chatContext.test.ts`.
- [X] T003 `ask` brief, answer prompt and `ASK` schema (`cards`, `needs_posting`), `TaskContext.job`; `PROMPT_VERSION` 3.3.0.
- [X] T004 `src/application/usecases/askCv.ts`: job context, cards, posting-aware guard, `postingMissing`, `reportId`; tests in `tests/application/ask.test.ts` (fit card figures equal the computation whatever the text says; K8s→Kubernetes passes; Terraform withheld with postingMissing).

## Phase 2: US1 Panel beside the report

- [X] T005 [US1] `Modal` variant `sheet` and `useWide()` in `src/ui/components/base.tsx`.
- [X] T006 [US1] `ResultsScreen`: grid with the aside, hide/show, no Ask tab; FAB + sheet below 1024 px; citations close the sheet and show the ATS view.
- [X] T007 [US1] `ChatPanel` restructured for a full-height column: header (title, New conversation, Hide), context bar, log, starters, composer.

## Phase 3: US2/US3 Posting in context, cards, tailoring

- [X] T008 [US2] State: `chat.posting`, `chatReset`, page messages on `jobDone`/`jobFailed`; `compareJob` sets the posting from both entry points.
- [X] T009 [US2] Context bar posting chip + "Add / Change posting" form in the panel; contextual starters.
- [X] T010 [US2] Cards (fit, knockouts, keywords, gaps) reusing the Job match rows; "Open Job match" link; `needsPosting` action.
- [X] T011 [US3] Rewrite card: Show line, Copy with the "paste and drop the new version" hint, posting-specific withheld message.

## Phase 4: US4 Edit loop

- [X] T012 [US4] `start` keeps the chat; `done` adds the version event; the provider re-compares the posting; stale citations as "previous version".

## Phase 5: US5 and polish

- [X] T013 [US5] No-AI panel state (posting and cards still work); i18n en/es for everything above.
- [X] T014 Tests: `tests/ui/chat.test.tsx` rewritten for the panel (desktop and sheet), posting flow, cards, edit loop, a11y; reducer cases.
- [X] T015 Design: frame "14 Results — Chat panel" (desktop) in the grafta file (v5); design README. The mobile sheet was checked in real Chrome at 390 px instead of drawn.
- [X] T016 Docs (CLAUDE.md, README); `make check && make test && make web-test`; real-Chrome check at 1440 and 390 px; commit.

## Phase 6: Design review (owner feedback)

- [X] T017 Dev-only design preview `design.html` + `src/design/main.tsx` (real app, scripted AI); never built.
- [X] T018 Measure the problems with viewport-only screenshots at 1440/1280/1024/390: composer off screen, chat covering the report at 1024, mixed type sizes.
- [X] T019 Docked full-height panel, container-query report column, full-screen dialog below 1024 px, floating button when collapsed.
- [X] T020 Panel anatomy: header, context with score/%/Change/Remove, welcome with suggestion buttons, posting editor using the whole panel, chat-style composer; "Remove" posting (`postingRemove`).
- [X] T021 Tests updated (+ remove and change); light/dark and en/es screenshots re-checked.

## Phase 7: One place for the posting

- [X] T022 Job match tab without its form: the detailed report only, shown only while a posting is in context, labelled with the match %; falls back to Overview when the posting goes.
- [X] T023 `postingRemove` restores the report of that version without the posting (`unmatched`), so the score and the "Job keywords" category go too.
- [X] T024 Tests: 004's tab tests add the posting from the chat; tab presence and removal covered.

## Phase 8: Design file

- [X] T025 grafta v6: frame 14 redrawn as the docked full-height panel; frame 10 with the report header and "Job match · 43%" tab; M6 gets the floating chat button; new M7 full-screen chat; frame 13 (Ask tab) removed.
