# Contract: output schemas

All model outputs are constrained with `responseConstraint` (JSON Schema). Source of truth:
`web/js/prompts/schemas.js`; this document explains them. Every extracted value carries `refs`
(line references, `p<page>:<line>`) and is verified by the orchestrator: the referenced lines must
contain the value (accent/case/space-insensitive). Values that fail are kept but marked
`verified: false` and never used as evidence.

`null` means "not in the document". The prompts forbid inventing, inferring or normalising values
beyond trimming (an ATS files what is written).

## Extracted profile

Produced by three extraction tasks so each fits Nano's context and stays focused:

### Task `extract_contact`

```
{ name:      { value, refs } | null,
  headline:  { value, refs } | null,          // the professional title under the name
  email:     { value, refs } | null,
  phone:     { value, refs } | null,
  location:  { value, refs } | null,
  links:     [ { kind: "linkedin"|"github"|"portfolio"|"other", value, refs } ] }
```

### Task `extract_sections_experience`

```
{ sections: [ { heading, kind: "summary"|"experience"|"education"|"skills"|"languages"|
                "projects"|"certifications"|"awards"|"other", ref } ],
  experience: [ { title, organisation, location|null, start|null, end|null,
                  current: boolean, refs, bullets: [ { text, ref } ] } ] }
```

`heading` is copied exactly as written; `kind` is the model's reading of it — an unconventional
heading is still classified, and the review may flag it.

### Task `extract_education_skills`

```
{ education:      [ { qualification, institution, start|null, end|null, refs } ],
  skills:         [ { value, ref } ],          // one item per skill as written
  languages:      [ { language, level|null, ref } ],
  certifications: [ { value, ref } ] }
```

## Findings

Task `review` — input: the verified profile (compact JSON), `doc_info`, `layout_facts`; the
model may call tools to look closer. Output:

```
{ findings: [ { type,                 // from findings.md, closed enum
                severity: "critical"|"major"|"minor",
                title,                // ≤ 70 chars, interface language
                why,                  // ≤ 220 chars: what goes wrong in an ATS / for a recruiter
                fix,                  // ≤ 220 chars: a concrete action
                evidence: [ { ref, quote } ] } ],   // quote ≤ 80 chars, must be on that line
  strengths: [ string ] }             // ≤ 3, short, interface language
```

## Job requirements

Task `extract_job` (input: posting text; no tools — the posting is short):

```
{ title: string|null,
  requirements: [ { text, kind: "skill"|"experience"|"education"|"language"|"certification"|"other",
                    importance: "required"|"preferred" } ] }   // ≤ 15
```

Task `match_job` (input: requirements + verified profile; may call `search`):

```
{ title_in_cv: boolean,
  matches: [ { requirement, status: "matched"|"partial"|"missing", evidence: [ { ref, quote } ],
               suggestion|null } ] }
```
