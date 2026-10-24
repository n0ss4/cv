# Contract: job match

## Measured (no model)

| Part | Source | Rule |
|---|---|---|
| Posting terms | `domain/job/equivalences.ts` | every group with a surface form present (word-bounded) in the trimmed posting |
| Keyword status | CV line index | *exact* if the posting's own form is in a CV line; *variant* if another form of the group is; else *missing* |
| AI-only terms | requirement texts of kind skill/certification not covered by a group | literal search only: *exact* or *missing* |
| Years | verified experience entries | R3 of research.md |
| Language | profile languages + CEFR (R4) | meets if CV level ≥ required; not-stated if the language is absent; unknown if either level can't be parsed |
| Degree / certification | profile education / certifications, equivalence list | meets if the term or an equivalent is present; not-stated otherwise |
| Location / authorisation | CV text search for the posting's place / authorisation terms | meets if found; **not-stated** otherwise (never fails) |
| Summary | requirement statuses + knock-outs | R7 of research.md |
| Phrasing guard | phrasing vs cited line + requirement | R5 of research.md |

## Model tasks (prompts version 3.1.0)

`extract_job` (no tools). Output per requirement:

```
{ text, kind: skill|experience|education|language|certification|location|authorisation|other,
  importance: required|preferred,
  knockout: none|years|degree|language|certification|location|authorisation,
  years: integer 0–40 (0 when not a years requirement),
  level: string ("" when none) }
```

`match_job` (tools: search, read_lines). Output per requirement:

```
{ requirement, status: matched|partial|missing, evidence: [{ ref, quote }],
  target: skills|experience|summary|headline|none,
  phrasing: string ≤ 200 ("" when none),
  source_ref: "" or a line ref the phrasing builds on }
```

The prompt instructs the model: phrasing only for partial or missing requirements; reuse words
from the source line; never add employers, numbers, dates, titles or technologies not on that line
or in the requirement; leave the phrasing empty when no line supports it.

## UI (Job match tab)

Order: summary card → missing required + failed/unstated knock-outs → knock-outs → exact keywords
→ all requirements with suggestions. Each element carries a provenance badge. Phrasings have a
Copy button. Without AI: the posting form plus the keyword check (measured terms only) and a
notice that the rest needs on-device AI.
