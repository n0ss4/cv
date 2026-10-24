# Contract: model output schemas

Unchanged from `specs/002-ats-checker-web/contracts/schemas.md` (extract_contact,
extract_sections_experience, extract_education_skills, review, extract_job, match_job) and
ported to `web/src/application/prompts/schemas.ts`. Each schema is a `const` typed object, with
the TypeScript result type derived from it, so prompt and parser cannot drift.

## Changes in 003

- `review.findings[].type` enum = AI types only (`findings.md#ai`). Measured types are listed
  in the review brief as already reported.
- `review.findings[].severity` stays in the schema for the model's reasoning, but it is
  **overridden** by the catalogue, as in 002. The UI never shows the model's severity.
- `prompts/VERSION` (semver string) is bumped on any change to prompts, schemas or catalogue
  definitions. The version is shown in "About the AI" and stored in every `Report`.
- Every prompt module exports `{ id, version, purpose, inputs, text(ctx) }`, so the
  "Prompts" viewer can show the exact text sent, with its purpose (FR-008).
