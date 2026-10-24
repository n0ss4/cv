# Implementation Plan: Deeper job-posting match

**Branch**: `004-job-match-depth` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-job-match-depth/spec.md`

## Summary

The job match grows from a requirement list into four parts: a summary (coverage, match %,
verdict), an exact-keyword check, where and how to add each gap, and knock-out filters. Following
003's split, the page **measures** what it can: variant detection from a reviewed equivalence
list, the years computation, CEFR comparison, the summary formula, and a guard that rejects
suggested phrasings which add facts. The model only **classifies** the posting (requirements,
importance, knock-out kind), judges coverage, and **drafts** phrasings.

## Technical Context

**Language/Version**: TypeScript 7.0.2 (as 003).

**Primary Dependencies**: none new.

**Storage**: none.

**Testing**: Vitest. The domain rules are tested against hand-made cases and the fixture CVs, the
use case with the scripted fake engine, and the UI in jsdom with axe. New test postings live in
`web/tests/fixtures/postings/`.

**Target Platform / Project Type**: as 003 (static app in `web/`).

**Performance Goals**: full comparison < 45 s on supported hardware (SC-006). The measured
keyword check runs in under 50 ms for a 6,000-character posting.

**Constraints**: on-device only, no storage, provenance on every result, en/es, WCAG 2.1 AA,
no inline styles (CSP).

**Scale/Scope**: about 150 equivalence groups; 6 knock-out kinds; one posting at a time.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Privacy by default | ✅ | Test postings are invented and use `example.com`. |
| II. Local-first | ✅ | The posting stays in memory; the CSP still forbids connections. |
| III. ATS-readable output | ✅ | The builder is untouched. |
| IV / VI | ✅ | Not affected. |
| V. Minimal dependencies | ✅ | No new package. The equivalence list is data in the repo. |

Post-design re-check: ✅.

## Project Structure

### Documentation

```text
specs/004-job-match-depth/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/job-match.md     # equivalences, formulas, schemas, guard, UI
└── tasks.md
```

### Source Code (additions to 003's layout)

```text
web/src/domain/job/
├── equivalences.ts   # reviewed equivalence groups (data) + version
├── terms.ts          # normalisation, word-bounded literal search, posting term discovery
├── keywords.ts       # exact / variant / missing per posting term
├── years.ts          # date parsing (en/es/ca/fr/de/pt), interval merge, total
├── cefr.ts           # level parsing + comparison
├── knockouts.ts      # posting knock-out vs profile → meets / fails / not stated / can't tell
├── phrasing.ts       # guard: a suggestion may not add facts
├── posting.ts        # trimming long postings to their requirement sections
└── summary.ts        # coverage, match %, verdict
web/src/application/
├── prompts/schemas.ts, tasks.ts   # extract_job + match_job extended; VERSION 3.1.0
└── usecases/compareJob.ts         # measured part always; AI part when an engine exists
web/src/adapters/presenters/job.ts  # JobMatch → view model
web/src/ui/components/job/          # Summary, Keywords, Knockouts, Requirements (+ Suggestion)
```

**Structure Decision**: a new `domain/job` module; nothing outside the job feature changes,
except the keywords score in `withJob` (it now uses the match %) and the design file.

## Complexity Tracking

None.
