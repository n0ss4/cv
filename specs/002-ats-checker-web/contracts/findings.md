# Contract: findings catalogue and scoring

The model may only report these finding types (closed enum in the review schema). The catalogue
is what "ATS level" means here: it encodes the defects this project's builder guards against
(`scripts/verify-cv.sh`) plus what commercial checkers score (keywords, impact, language,
profile completeness). The review prompt lists each type with its definition and default severity.

| Category | Type | Definition (as given to the model) | Default severity |
|---|---|---|---|
| parsing | `multi_column_layout` | `layout_facts.side_by_side_blocks` shows text blocks side by side on many lines | critical |
| parsing | `contact_in_header_footer` | email or phone appears only in `header_zone` / `footer_zone` | major |
| parsing | `detached_bullets` | `bullet_only_lines` is not empty | major |
| parsing | `detached_dates` | `date_only_lines` or `right_edge_dates` separate dates from their roles | minor |
| parsing | `hyphenated_words` | `hyphen_breaks` splits words across lines | minor |
| parsing | `unreadable_characters` | `unusual_characters.ratio` is noticeable or examples look like broken glyphs | critical |
| contact | `missing_email` | profile.email is null | critical |
| contact | `missing_phone` | profile.phone is null | major |
| contact | `missing_profile_link` | no LinkedIn/GitHub/portfolio link | minor |
| contact | `missing_location` | no city/country | minor |
| sections | `missing_experience_section` | no section of kind experience | critical |
| sections | `missing_education_section` | no section of kind education | major |
| sections | `missing_skills_section` | no section of kind skills | major |
| sections | `unconventional_heading` | a heading whose wording an ATS would not recognise ("Where I've worked") | major |
| content | `no_measurable_results` | few or no bullets state a number, percentage or amount | major |
| content | `duty_style_bullets` | bullets describe responsibilities ("Responsible for…") rather than achievements | minor |
| content | `missing_summary` | no summary/profile section | minor |
| language | `first_person` | bullets or summary use "I", "my", "yo", "mi" | minor |
| language | `spelling_or_grammar` | a clear spelling or grammar error, quoted | minor |
| dates | `missing_dates` | an experience entry has no dates | major |
| dates | `inconsistent_date_format` | dates use different formats across entries | minor |
| length | `too_long` | more than 2 pages | minor |
| keywords | `missing_requirement` | a required job requirement is missing (job comparison only) | major |
| keywords | `title_mismatch` | the target job title does not appear (job comparison only) | minor |

`no_text_layer` is raised by the orchestrator, not the model: with no text there is nothing to
review, and the model is not called.

## Scoring (transparent, not model-generated)

```
category score = max(0, 100 − 45·critical − 20·major − 7·minor)      // findings in that category
overall        = weighted mean of category scores present:
                 parsing 30 · contact 15 · sections 15 · content 20 · language 5 · dates 10 · length 5
                 (+ keywords 20 when a job posting was compared)
overall        = min(overall, 59) if verdict is not-ready; min(overall, 79) if needs-work
                 (the number must never contradict the verdict)
verdict        = "unreadable"  if no text layer
                 "not-ready"   if any critical finding
                 "needs-work"  if any major finding
                 "ready"       otherwise
```

Findings whose evidence fails verification still count, but are shown as "unverified".
