# Data Model: In-Browser ATS Checker (on-device AI)

Everything lives in memory for one analysis (FR-003).

## Document (`extract.js`)

`{ fileName, fileSize, pages: [{ number, width, height, items: [{ str, x, y, w, h, eol }] }] }`
— pdf.js positions, origin bottom-left.

## Indexed document (`tools.js`)

`{ lines: [{ ref: "p1:12", page, index, text, y, h, segments }], byPage, stats }` — ATS-order
lines (parser view) with geometry joined from the positioned items. All tools read from it.

## Tool call (audit log)

`{ task, step, tool, args, result, ms }`

## Extracted Profile

Union of the three extraction task outputs (`contracts/schemas.md`), after verification: every
`{ value, refs }` gains `verified: boolean`.

## Finding

`{ type, category, severity, title, why, fix, evidence: [{ ref, quote, verified }] }` — `category`
is looked up from the catalogue, not asked from the model.

## Report

`{ verdict, overall, categories: { parsing, contact, sections, content, language, dates, length,
keywords? }, findings, strengths, profile, log, failedTasks }`

## UI state

`checking-support → idle | unsupported`; `idle → downloading → analysing(step) → results | error`;
results tabs: `review | profile | ats | job`. Language `en | es`, in memory only.
