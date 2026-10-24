# Research: Deeper job-posting match

## R1. Literal keyword search in ATS

- **Finding** (003 research R2, sources there): recruiters search the parsed record with a few
  literal terms. Several sources stress exact-term matching ("include the posting's exact
  wording"); some ATS (Ashby, Textkernel-based search) add synonym expansion, but most search UIs
  used by recruiters do not, and a CV cannot rely on it.
- **Decision**: report *exact*, *variant found* and *missing*. Advise using the posting's exact
  term, optionally keeping the CV's own term in brackets ("Kubernetes (K8s)"), which matches both
  kinds of search.

## R2. Who decides that two terms are equivalent

- **Decision**: a reviewed, versioned list (`domain/job/equivalences.ts`), never the model.
- **Rationale**: a small model asked "is X the same as Y?" over-matches ("Java" ≈ "JavaScript").
  An equivalence that is wrong would tell the user their CV matches when a recruiter's search
  would not find it, which is the most damaging error this feature could make.
- **Scope**: about 150 groups covering languages, frameworks, data and cloud platforms, methods,
  roles, degrees, certifications, and en/es spellings ("aprendizaje automático" ↔ "machine
  learning"). Each group is a set of surface forms; matching is word-bounded on a normalised form
  that keeps `+ # .` inside tokens (C++, C#, .NET, Node.js).

## R3. Years of experience

- **Decision**: computed by the page from the verified experience entries (start, end, current).
  Month precision when a month is given, otherwise the year is treated as January–December.
  Overlapping ranges are merged; "present"/current uses the device date. The total is rounded
  down to whole years and shown with the merged ranges.
- **Alternative rejected**: asking the model to compute years. It gets arithmetic wrong, and the
  result must be explainable.

## R4. Language levels

- **Decision**: CEFR A1–C2. "Native", "nativo", "bilingual", "bilingüe", "lengua materna" → C2.
  Other wording ("fluent", "fluido", "professional") is too vague to compare → *can't tell*, with
  advice to state the CEFR level. Spanish/English language names are matched through the
  equivalence list (English ↔ inglés …).

## R5. Phrasing guard

- **Decision**: a suggested phrasing is accepted only if every number, every capitalised token
  (except at sentence start), and every term from the equivalence list in it also appears in the
  cited CV line or in the requirement text. Otherwise the suggestion is replaced by "add it only
  if you really have this experience".
- **Rationale**: SC-003. It is cheap, deterministic, and errs towards saying less.

## R6. Long postings

- **Decision**: over 6,000 characters, keep the text from the first requirements-like heading
  ("Requirements", "Qualifications", "What you'll bring", "Must have", "Nice to have", "Requisitos",
  "Qué buscamos", "Se valorará", …) for 6,000 characters, otherwise the first 6,000. The user is
  told.

## R7. Match % and verdict

- **Decision**: match % = Σ(weight × credit) / Σ weight, with required weight 2 and preferred
  weight 1; matched = 1, partial = 0.5, missing = 0. Verdict: *strong* (no required missing, no
  knock-out failed or unstated), *close* (exactly one required missing or one knock-out
  unstated, none failed), *gaps* (otherwise). A failed knock-out always gives *gaps*.
- The 003 keywords category score becomes this match %.
