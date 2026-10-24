# Contract: findings catalogue, measured rules, scoring

Source of truth: `web/src/domain/findings/catalogue.ts`. This file documents it. It extends
002's catalogue (`specs/002-ats-checker-web/contracts/findings.md`).

Each entry has: `type`, `category`, `severity` (default), `source` (`measured` | `ai`),
`definition` (for the model or the rule), `why` and `fix` templates in en/es (used verbatim for
measured findings and as guidance for AI ones), and `searchable` when the defect hides the CV
from recruiter searches.

## Measured (deterministic, from layout facts, no model)

| Type | Category | Severity | Rule (all thresholds are constants in `domain/layout/rules.ts`) | Why (gist) |
|---|---|---|---|---|
| `no_text_layer` | parsing | critical | `doc_info.text_layer = "none"` → verdict `unreadable` | scanned or exported as images: an ATS reads nothing |
| `text_as_graphics` | parsing | critical if all pages, else major | a page with `graphics_pages` entry (images ≥ 1 or paths ≥ 40) **and** < 200 non-space chars | design-tool export: text drawn as graphics is invisible to parsers |
| `multi_column_layout` | parsing | critical | `side_by_side_blocks.lines ≥ 5` and `≥ 15 %` of `of_total_lines` | parsers read across columns and mix them (Workday: "J ohn D oe") |
| `table_layout` | parsing | major | `table_grid` has a grid of ≥ 3 rows × ≥ 3 columns | table cells come out in unpredictable order |
| `contact_in_header_footer` | parsing | major | an email or phone matched in `header_zone`/`footer_zone` and in no other line | header/footer text is often dropped, taking your contact with it |
| `unreadable_characters` | parsing | critical if `ratio > 0.02`, else minor if `count ≥ 1` | `unusual_characters` | fonts without a Unicode map garble letters, accented names first |
| `detached_bullets` | parsing | major | `bullet_only_lines` ≥ 2 | bullets get separated from their text |
| `detached_dates` | parsing | minor | `date_only_lines` + `right_edge_dates` ≥ 1 | the date can surface before or apart from its job |
| `hyphenated_words` | parsing | minor | `hyphen_breaks` ≥ 1 | split words are indexed as two non-words |
| `ambiguous_date_format` | dates | minor | `ambiguous_dates` ≥ 1 (`'22`, `01/02/22`, two-digit years) | parsers misread abbreviated dates and miscount experience |
| `skill_rating_graphics` | content | minor | `shape_rows` with ≥ 3 shapes on ≥ 2 lines | bars and stars carry no text: your level is invisible |
| `icon_only_contact` | contact | minor | `unlabelled_contact` ≥ 1 | an icon instead of "Email:" can make the field go unrecognised |
| `too_long` | length | minor | pages > 2 | — |

When a fact is `applicable: false`, its rule does not fire. The UI lists the check as "Not
applicable to <format>", never as passed.

## AI (the model decides, as in 002)

002's contact, sections, content, language and dates types, unchanged in definition:
`missing_email`, `missing_phone`, `missing_profile_link`, `missing_location`,
`missing_experience_section`, `missing_education_section`, `missing_skills_section`,
`unconventional_heading`, `no_measurable_results`, `duty_style_bullets`, `missing_summary`,
`first_person`, `spelling_or_grammar`, `missing_dates`, `inconsistent_date_format`.
`missing_experience_section`, `missing_education_section` and `missing_skills_section` are
`searchable`, and their why-texts say so (FR-019).

Job comparison only: `missing_requirement` (keywords, major) and `title_mismatch` (keywords,
**major**, raised from minor; see research R2).

The review prompt's `type` enum contains **only** AI types. The measured types are passed to it
as "already reported by measurement: …", so it does not repeat them.

## Provenance

- `measured`: produced by a rule above.
- `ai-verified`: AI finding with ≥ 1 evidence item verified at its line, or an absence finding
  (`missing_*`) consistent with the verified profile. The consistency guard of 002 drops any
  absence finding that contradicts it.
- `ai-unverified`: AI finding whose evidence could not be found at the cited lines.

## Scoring (unchanged from 002)

```
category score = max(0, 100 − 45·critical − 20·major − 7·minor)
overall        = weighted mean over categories: parsing 30 · contact 15 · sections 15 ·
                 content 20 · language 5 · dates 10 · length 5 (+ keywords 20 with a posting)
overall        = min(overall, 59) if not-ready; min(overall, 79) if needs-work
verdict        = unreadable | not-ready (any critical) | needs-work (any major) | ready
                 incomplete (any AI task failed: no overall)
                 measured-only (no engine: no overall, measured findings only)
```

`ai-unverified` findings count, as in 002, but are labelled.

## Fix these first

The top five findings by: severity (critical > major > minor), then the category weight above
(higher first), then provenance (measured > ai-verified > ai-unverified), then the first
evidence position (page, line), then catalogue order.

## Rescan diff

Two findings are "the same" when their `type` matches and, for `unconventional_heading`,
`spelling_or_grammar`, `first_person`, `duty_style_bullets` and `missing_requirement`, the folded
first evidence quote (or requirement text) matches too.
