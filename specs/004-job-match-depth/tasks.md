---
description: "Tasks for the deeper job match (004)"
---

# Tasks: Deeper job-posting match

**Input**: `specs/004-job-match-depth/` (spec, plan, research, data-model, contracts/job-match.md)

**Tests**: required (measured rules are the core of the feature; SC-001…SC-003 are test-checked).
All paths are relative to `web/`.

## Phase 1: Setup

- [X] T001 Add test postings (invented companies, `example.com`) in `tests/fixtures/postings/`: `backend.txt` (4 required incl. Kubernetes, PostgreSQL, 5+ years, English C1; 2 preferred), `data-es.txt` (Spanish posting with "inglés B2", "aprendizaje automático"), `long.txt` (> 6,000 chars with a "Requirements" heading).

## Phase 2: Foundational (domain/job, measured)

- [X] T002 [P] `src/domain/job/equivalences.ts`: ~150 reviewed groups (`id`, `forms[]`), with `EQUIVALENCES_VERSION`.
- [X] T003 [P] `src/domain/job/terms.ts`: `normaliseForTerms`, word-bounded `findForm(text, form)`, `postingTerms(posting)`.
- [X] T004 `src/domain/job/keywords.ts`: `checkKeywords(postingTerms, index, extraTerms)` → `KeywordCheck[]` (exact / variant / missing, line ref).
- [X] T005 [P] `src/domain/job/years.ts`: date parsing (en/es/ca/fr/de/pt months, `MM/YYYY`, `YYYY-MM`, years, present), interval merge, `computeYears(experience, today)`.
- [X] T006 [P] `src/domain/job/cefr.ts`: `parseLevel`, `compareLevel`.
- [X] T007 `src/domain/job/knockouts.ts`: `evaluateKnockouts(requirements, profile, index, today)` → `KnockoutResult[]`.
- [X] T008 [P] `src/domain/job/phrasing.ts`: `guardPhrasing(phrasing, sourceLine, requirement)`.
- [X] T009 [P] `src/domain/job/posting.ts`: `trimPosting(text)` → `{ text, trimmed }`.
- [X] T010 [P] `src/domain/job/summary.ts`: `summarise(requirements, knockouts)` → `JobSummary`.
- [X] T011 Update `JobMatch` in `src/domain/report/report.ts` per data-model.md, and make `withJob` use the summary's percent for the keywords category.
- [X] T012 Tests `tests/domain/job.test.ts`: equivalence matching (word bounds, C++/C#/.NET), keywords on fixture text, years (overlap, present, year-only, undated), CEFR (native, B2 < C1, vague → unknown), knock-outs (not stated never fails), guard (numbers, proper nouns, list terms), trimming, summary formula and verdicts.

## Phase 3: US2 + US4 — measured check and knock-outs, end to end (P1)

- [X] T013 [US2] Extend `extract_job` and `match_job` in `src/application/prompts/{schemas,tasks}.ts` per the contract; bump `PROMPT_VERSION` to 3.1.0.
- [X] T014 [US2] Rewrite `src/application/usecases/compareJob.ts`: trim → measured keywords (always) → when an engine is given, extract_job + match_job → knock-outs → guarded suggestions → summary → findings (missing required, title mismatch, failed knock-outs) → `withJob`.
- [X] T015 [US2] Export `measureJob(posting, measured)` for the no-AI path.
- [X] T016 [US2] Tests `tests/application/job.test.ts` with the fake engine on `postings/backend.txt` against the example CV and a K8s/Postgres fixture text.

## Phase 4: US1 + US3 — summary and suggestions in the UI (P1/P2)

- [X] T017 [US1] Presenter `src/adapters/presenters/job.ts` (ordering: missing required, failed/unstated knock-outs first).
- [X] T018 [US1] UI `src/ui/components/job/` (JobSummary, Knockouts, Keywords, Requirements with Suggestion + Copy); replace `JobMatch` in `evidence.tsx`; the no-AI path in the provider (`compareJob` without engine).
- [X] T019 [US3] i18n strings en/es for all of the above.
- [X] T020 [US1] UI tests `tests/ui/job.test.tsx`: summary order, variant keyword shown, years computation visible, phrasing copy button, no-AI path, axe and no inline styles.

## Phase 5: Polish

- [X] T021 Design: add the frame "10 Results — Job match" to the grafta file (summary card, knock-outs, keywords, suggestion card) as `specs/003-react-ats-checker/design/ats-checker-v3.fig` (replacing v2), and update the design README.
- [X] T022 Update 003 docs that mention the job match (spec 003 US5 note, CLAUDE.md line on job match). (The eval page evaluates CV fixtures only; evaluating postings with the real model is left to the chat/eval follow-up.)
- [X] T023 `make check DATA=example/cv.toml && make test && make web-test`; real-Chrome screenshots of the tab (no-AI path).

## Dependencies

Phase 1 → Phase 2 (T002/T003 before T004; T005/T006 before T007) → Phase 3 → Phase 4 → Phase 5.
