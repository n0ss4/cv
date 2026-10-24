# Feature Specification: Deeper job-posting match

**Feature Branch**: `004-job-match-depth`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "The job-posting part isn't very developed; I think it lacks
content." The owner chose four additions: a match summary, exact keywords, where and how to add
missing items, and knock-out filters. Extends 003 User Story 5.

## Clarifications

### Session 2026-10-17

- Q: What should the comparison add? → A: All four: (1) a match summary with required vs
  preferred coverage and a verdict; (2) exact keywords, where the CV uses a variant a literal ATS
  search would not match; (3) for each gap, where in the CV to add it and an example phrasing
  built only from what the CV already says; (4) knock-out filters such as years, degree,
  languages, certifications, location and work authorisation.
- Q: How does it stay honest? → A: The 003 rules apply. Every result says whether it was
  measured or produced by the AI, and AI evidence is checked against the CV. Suggestions never
  invent experience, and the posting, like the CV, never leaves the device.

## Context

Recruiters rarely read every CV for a posting. They search and filter the ATS record: by the
posting's skills, by job title, and by hard requirements such as years of experience, degree,
language level or location (003 research R2). A CV fails for a posting in three ways:

1. **It lacks a requirement** the posting asks for.
2. **It has the requirement, but under another word.** Searches are mostly literal: "K8s" does
   not match "Kubernetes", and "Postgres" does not match "PostgreSQL".
3. **It falls on the wrong side of a knock-out filter** ("5+ years", "C1 English",
   "EU work permit").

Today the comparison lists requirements as matched, partial or missing. It doesn't say how good
the overall fit is, which gaps matter most, where to fix them, or which hard filters the CV
fails.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - How well do I match this job? (Priority: P1)

After pasting a posting, the user sees a match summary first. It shows how many **required**
and how many **preferred** requirements the CV covers, an overall match percentage, a one-line
verdict, and the missing required items at the top.

**Why this priority**: it answers the user's actual question ("should I apply, and what's
missing?") in five seconds.

**Independent Test**: compare the example CV with a test posting that has 4 required and 2
preferred items, two of the required missing → the summary reads "2 of 4 required · 1 of 2
preferred", the verdict says two required are missing, and those two are listed first.

**Acceptance Scenarios**:

1. **Given** a comparison, **When** results appear, **Then** the summary shows required covered /
   total, preferred covered / total, the overall match % (from a published formula), and a
   verdict.
2. **Given** missing required items, **When** the summary is shown, **Then** they are listed before
   anything else, each with its status and provenance.
3. **Given** a posting with no "preferred" items, **When** the summary is shown, **Then** only
   required coverage is shown, without "0 of 0".

---

### User Story 2 - Use the posting's exact words (Priority: P1)

For each posting keyword the CV covers under a different wording, the user sees: the posting's
term, the CV's term with its line, and the advice "use the posting's exact term (you can keep
yours in brackets)". Keywords present verbatim are marked as such, and keywords absent entirely
are marked as missing.

**Why this priority**: it is the cheapest fix with the highest effect on search visibility, and it
is mostly measurable without AI.

**Independent Test**: a CV that says "K8s" and "Postgres" against a posting that asks for
"Kubernetes" and "PostgreSQL" → both appear as *variant found*, with the CV line, and labelled
*Measured*.

**Acceptance Scenarios**:

1. **Given** a posting term and a CV that contains it literally (case- and accent-insensitive),
   **When** compared, **Then** it is shown as *exact match*, with the line, labelled *Measured*.
2. **Given** a posting term whose known variant (abbreviation, alternative spelling, spelled-out
   form) is in the CV, **When** compared, **Then** it is shown as *variant found*, with both terms
   and the line, labelled *Measured*.
3. **Given** a posting term not present in any form, **When** compared, **Then** it is shown as
   *missing*.
4. **Given** a browser without on-device AI, **When** the user pastes a posting, **Then** the exact
   keyword check still runs for the terms the page recognises on its own, and the page says the
   rest of the comparison needs the AI.

---

### User Story 3 - Where and how to add it (Priority: P2)

For each missing or partial requirement, the user sees where it belongs (skills, a specific
experience entry, the summary, or the headline) and an example phrasing. The phrasing reuses only
facts already in the CV. When the CV gives nothing to build on, the page says so plainly: "add
it only if you really have this experience" and gives no example.

**Why this priority**: a list of gaps without a next step leaves the user stuck. It is lower than
US1/US2 because it depends on the model and is advisory.

**Independent Test**: a CV with "Built dashboards in Tableau" against a posting that asks for
"data visualisation" → the suggestion targets that experience bullet, quotes it, and proposes a
phrasing that adds "data visualisation" without new facts. It is labelled as an AI suggestion.

**Acceptance Scenarios**:

1. **Given** a missing or partial requirement, **When** shown, **Then** it has a target location
   (one of: skills, experience entry X, summary, headline) and either an example phrasing or the
   "only if true" note.
2. **Given** an example phrasing, **When** shown, **Then** it cites the CV line it builds on, and
   that line is verified to exist; a phrasing whose source cannot be verified is shown as
   *AI · unverified*.
3. **Given** any suggestion, **When** shown, **Then** it is labelled as an AI suggestion, and the
   user can copy the phrasing.

---

### User Story 4 - Knock-out filters (Priority: P1)

The user sees the hard requirements the posting states (years of experience, degree, languages
with level, certifications, location / remote / work authorisation) next to what the CV says
about each: *meets*, *doesn't meet*, *not stated in your CV*, or *can't tell*.

**Why this priority**: these filters remove a CV before any human reads it. "Not stated in your
CV" is often a fixable cause.

**Independent Test**: a posting asking for "5+ years of backend experience", "English C1" and "a
degree in Computer Science" compared with the example CV → years are computed from the CV's
dated roles and shown with the computation; language and degree are matched against the
extracted profile, each citing its line.

**Acceptance Scenarios**:

1. **Given** a posting with a years requirement, **When** compared, **Then** the page computes the
   CV's years from its dated roles, shows the computation (roles and ranges, overlaps counted
   once), and states meets / doesn't meet. The computation is *Measured*; recognising the
   requirement is AI.
2. **Given** a language or certification requirement, **When** compared, **Then** it is matched
   against the profile's languages and certifications, citing the line, or shown as *not stated
   in your CV*.
3. **Given** a location or work-authorisation requirement the CV doesn't mention, **When**
   compared, **Then** it is shown as *not stated in your CV*, with the advice to state it if
   true, never as *doesn't meet*.

---

### Edge Cases

- Very long postings (more than about 6,000 characters): the posting is reduced to its
  requirement sections before analysis, and the user is told it was shortened.
- Posting in a different language from the CV: keywords are compared literally. A
  cross-language requirement such as "inglés C1" against "English C1" goes to the AI step, and
  the result is marked as such.
- A requirement listed twice: it counts once.
- Years can't be computed (no dates, or only "Present"): shown as *can't tell*, with the reason.
- Overlapping roles (two jobs at once): the overlap counts once in the years computation.
- The model fails partway: what was measured is still shown, and the AI parts say they did not
  finish.
- A new posting replaces the old comparison. Comparing several postings side by side is out of
  scope.

## Requirements *(mandatory)*

### Functional Requirements

**Summary**

- **FR-001**: The comparison MUST show required coverage, preferred coverage and an overall
  match %, computed by a published formula from statuses (matched = 1, partial = 0.5,
  missing = 0; required items weigh twice as much as preferred ones).
- **FR-002**: The verdict MUST follow from the missing required items and failed knock-outs:
  "strong match" (none missing, no knock-out failed), "close" (1 required missing or 1 knock-out
  not stated), "gaps" (otherwise). The model never sets it.
- **FR-003**: Missing required items and failed or unstated knock-outs MUST be listed first.

**Exact keywords**

- **FR-004**: The page MUST check each posting keyword literally against the CV text
  (case-, accent- and punctuation-insensitive, word-bounded), and report *exact*, *variant
  found* or *missing* with the CV line.
- **FR-005**: Variants MUST come from a reviewed, versioned list of equivalent terms shipped with
  the page (abbreviations, spellings, spelled-out forms; e.g. K8s ↔ Kubernetes, JS ↔ JavaScript,
  Postgres ↔ PostgreSQL, ML ↔ machine learning, CI/CD ↔ continuous integration). The model MUST
  NOT decide that two terms are equivalent.
- **FR-006**: Keywords MUST come from two sources, each labelled: terms in the equivalence list
  that appear in the posting (*Measured*, available without AI), and the requirement terms the
  model extracts (*AI*).

**Where and how**

- **FR-007**: Each missing or partial requirement MUST have a target location and either an
  example phrasing or the "only if true" note.
- **FR-008**: An example phrasing MUST cite the CV line it builds on. It is verified like other
  evidence. It MUST NOT add employers, dates, numbers, titles or technologies that are not on
  the cited line or in the requirement itself (checked by the page; a violating phrasing is
  dropped and replaced by the note).
- **FR-009**: Phrasings MUST be copyable and labelled as AI suggestions.

**Knock-outs**

- **FR-010**: The model MUST classify posting requirements into knock-out kinds (years,
  degree, language, certification, location/remote, work authorisation) or none. The page
  compares them with the verified profile.
- **FR-011**: Years of experience MUST be computed by the page from dated roles: ranges merged
  where they overlap, "present" as today, month precision when given and year precision
  otherwise. The computation MUST be shown.
- **FR-012**: Language levels MUST be compared on the CEFR scale (A1–C2) when both sides state
  a level; "native" and "bilingual" count as C2. Other level wording is shown as *can't tell*.
- **FR-013**: A knock-out the CV doesn't mention MUST be *not stated in your CV*, never
  *doesn't meet*.

**Carried from 003**

- **FR-014**: The posting is processed on the device only, and is not stored. Clearing the
  session removes it.
- **FR-015**: Every result carries a provenance label, the page is in English and Spanish, it is
  accessible (WCAG 2.1 AA), and it lives in the results' "Job match" tab. The job keywords
  category score of 003 uses the new match % (FR-001).
- **FR-016**: The AI log records the comparison's tool calls, as for the review.

### Key Entities

- **Posting**: the pasted text, an optional title, and a trimmed flag.
- **Requirement**: text, kind (skill / experience / education / language / certification /
  location / authorisation / other), importance (required / preferred), knock-out kind or none,
  source (measured / AI).
- **Keyword check**: posting term, status (exact / variant / missing), CV term and line,
  provenance.
- **Suggestion**: requirement, target location, phrasing or none, source line, provenance.
- **Knock-out result**: requirement, kind, CV evidence, computation (for years), outcome (meets /
  doesn't meet / not stated / can't tell).
- **Job match summary**: required and preferred coverage, match %, verdict.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the test postings, the exact-keyword check finds 100% of the planted variants
  and reports no variant that is not in the equivalence list.
- **SC-002**: Years computed from the example CV and the fixtures match a hand count exactly.
- **SC-003**: No suggested phrasing in the evaluation set introduces a fact (number, employer,
  technology, title) that is absent from its cited line and the requirement.
- **SC-004**: A user can tell within 5 seconds whether the posting is a strong match and what
  the top missing required item is (summary above the fold at 1440×900 and at 390 px).
- **SC-005**: Without on-device AI, pasting a posting still yields the exact-keyword check for
  recognised terms, with no AI result shown.
- **SC-006**: The full comparison of a typical posting (about 3,000 characters) finishes in
  under 45 s on supported hardware.

## Assumptions

- The equivalence list starts with about 150 common technical and professional terms in English
  and Spanish (programming languages, frameworks, cloud, data, methods, common degrees and
  certifications). It is reviewed like code, and extending it needs no other change.
- CEFR is the language-level reference, because most postings in the target markets use it.
- "Today" for "present" is the device date.
- One posting at a time. Saving postings or comparing several at once is out of scope.
- Builds on 003's architecture, contracts and design system, and adds no new dependencies.
