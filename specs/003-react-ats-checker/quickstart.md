# Quickstart / validation: ATS Checker 2

## Prerequisites

Node ≥ 22, plus tectonic and poppler, which build the fixture PDFs (as in 002). For the AI
scenarios: desktop Chrome with the built-in model (spec Assumptions).

## Run

```bash
make web            # dev server on http://127.0.0.1:8000
make web-test       # fixtures + all Vitest suites (domain, application, adapters, ui, architecture, build)
make web-build      # production bundle in web/dist with the strict CSP
make web-preview    # serve web/dist on loopback, which is exactly what Pages serves
make web-eval       # real-model evaluation: open /eval.html in a Chrome with built-in AI
```

## Validation scenarios

| # | Scenario | Expected | Covers |
|---|---|---|---|
| 1 | `make web-test` | all suites pass, including `architecture.test.ts` and `build.test.ts` | FR-011, FR-027, R4, R10 |
| 2 | Supported Chrome, drop `build/web-fixtures/example/CV_Jane_Doe_EN.pdf` | verdict *ready*; "Fix these first" holds no critical or major item; profile: Jane Doe, jane.doe@example.com, +1 555 0100, 2 roles, 1 education | US1, US3, SC-004/005 |
| 3 | Drop `two-column.pdf` | the first fix-first item is `multi_column_layout`, labelled *Measured*, with evidence lines highlighted in the ATS view | US1, FR-018 |
| 4 | Then drop the example CV in the same tab | rescan banner: column issue *resolved*, score up | US4 |
| 5 | Firefox (no AI): drop `two-column.pdf` | "no on-device AI" notice before the drop; after it, measured checks + ATS view; no score, no profile | US6, SC-008 |
| 6 | Load the page, turn the network off (DevTools → Offline), analyse | works; the Network panel shows no request after load | US2, SC-001 |
| 7 | Open Privacy status → "Check it yourself" and follow it | the steps match what DevTools shows | US2-3 |
| 8 | Open About the AI | model, on-device, limits, prompt version; "View prompts" shows the exact texts | US2-5, FR-008 |
| 9 | Open the AI log during an analysis | entries appear live, with tool, args, result and timing | FR-007 |
| 10 | Drop `scanned.pdf` | *unreadable* without any model call (the log has no prompt entries) | US1-4 |
| 11 | Drop a `.docx` or `.png` | "We read: PDF" error, no model call | US7-2 |
| 12 | Keyboard only: Tab through the start → drop (Enter on the zone) → results → tabs → finding → ATS view | complete without a mouse; focus is visible throughout | SC-009 |
| 13 | `/eval.html` with the real model | ≥ 90 % of fixtures pass expectations | SC-004 |

## Adding a format later (maintainer check)

1. Create `web/src/adapters/readers/<format>/<Format>Reader.ts` implementing `DocumentReader`
   (`contracts/ports.md`).
2. Register it in `web/src/infrastructure/container.ts`.
3. Add fixtures under `web/tests/fixtures/<format>/` and a reader test.
4. `make web-test`. Nothing else should need to change, as the test-only `TextReader` already
   proves (SC-007).
