# Contract: the `ask` task, 006

Prompt version **3.3.0**. Tools ≤ 4 calls, min 0, own clone of the base session (unchanged).

## Brief

- **Scope.** As in 005, plus *the job posting in context*, when there is one. With no posting in
  context, a question about a posting or about fit is **in scope**: answer that a posting is
  needed and set `needs_posting: true`.
- **Context.** Report summary, verified profile, last 4 exchanges, and the question. When a
  posting is in context, also `Job match (computed by the page; you cannot change it):
  compactJob(job)`.
- **Fit rule.** Whether the user is right for the job: explain the page's match. Never contradict
  its figures. A hard filter that is "not stated" means the CV doesn't say it; it doesn't mean it
  is met. Say what would change the match.

## Output schema

```
{ answer: string ≤ 600,
  out_of_scope: boolean,
  needs_posting: boolean,
  cards: ["fit" | "knockouts" | "keywords" | "gaps"] ≤ 2,
  citations: [ { ref, quote ≤ 80 } ] ≤ 4,
  rewrites: [ { source_ref, text ≤ 300 } ] ≤ 2 }
```

## Page post-processing (in addition to 005)

- **Cards** are kept only when a posting is in context, and only kinds that have data:
  - fit needs a summary;
  - knockouts need ≥ 1 knock-out;
  - keywords need ≥ 1 keyword with status missing or variant;
  - gaps need ≥ 1 requirement with status missing or partial.

  Duplicates are removed. Each card stores the `JobMatch` it renders.
- **Rewrite guard**: `guardPhrasing(text, line, postingTermsInCv(job))`. `postingMissing` = the
  added terms equal (folded) to a job keyword with status `missing`.
- `needs_posting` is ignored when a posting is in context.
- `out_of_scope` behaves as in 005 (cards, rewrites and citations are dropped).
- `reportId` = the report the question was asked against.

## Page messages (no model involved)

- `job`: "Posting added: {title} · {percent}% match · {covered}/{total} required · {n} hard
  filters not met, {m} not stated", plus "was {before}%" when re-compared. Link: Job match tab.
- `jobFailed`: "The posting couldn't be compared. Try again."
- `version`: "New version analysed: score {before} → {after} · {resolved} fixed, {added} new."
