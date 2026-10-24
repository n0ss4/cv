# Feature Specification: Local, Privacy-First CV Builder

**Feature Branch**: `001-local-cv-builder`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "For GDPR reasons I must remove my exposed personal data. I want the CV
project to become a tool anyone can use to create their CV, but used locally to avoid these
problems, and so anyone can fork it."

## Context

Today the repository is one person's public CV: name, phone, email, photo, employers and full
career history are in the source, in every commit since the first, and in more than ten public
releases whose attached PDFs are downloadable by anyone. The template itself — an ATS-readable,
multi-language layout with text-layer verification — is valuable and generic. This feature
separates the two: the tool stays public, the person's data leaves the public internet and
lives only on the owner's machine.

## Clarifications

### Session 2026-10-17

- Q: Remote cleanup — delete and recreate the repository, or rewrite history in place? → A:
  Delete and recreate. Rewriting leaves old commits reachable by hash until the host purges
  them; a new repository from a fresh root commit guarantees nothing survives.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner removes their personal data from the public internet (Priority: P1)

The owner needs every copy of their personal data that this project published to stop being
publicly reachable: the current files, the git history, the release PDFs, and build artifacts.
They still need their own CV afterwards, built locally exactly as before.

**Why this priority**: it is a legal obligation and the reason the feature exists. Everything
else is optional; this is not.

**Independent Test**: after completion, searching the public repository (files, full history,
releases, tags, workflow artifacts) for the owner's name, phone, email, and photo returns zero
results, and the owner can still produce their own CV PDF on their machine.

**Acceptance Scenarios**:

1. **Given** the public repository with personal data in files, history and releases, **When**
   the cleanup is complete, **Then** no public commit, tag, release, release asset, or workflow
   artifact contains the owner's personal data.
2. **Given** the cleanup is complete, **When** the owner builds their CV locally, **Then** they
   get a PDF with the same content they had before, from data that exists only on their machine.
3. **Given** the cleanup is complete, **When** anyone opens a previously shared
   `releases/latest/download/...` link, **Then** it no longer returns the owner's CV.

---

### User Story 2 - A new user creates their own CV locally (Priority: P1)

Someone finds the project, makes their own copy, fills in their details in one plain-text file,
and gets an ATS-friendly PDF — without learning LaTeX and without their data ever being
committed or uploaded.

**Why this priority**: this is what turns a personal repository into a tool for everyone.

**Independent Test**: on a clean machine with the documented prerequisites, a person follows the
README, replaces the example content with their own, builds, and gets a PDF; `git status` shows
none of their files as candidates for commit.

**Acceptance Scenarios**:

1. **Given** a fresh copy of the project, **When** the user runs the documented build without
   having created their own data yet, **Then** the fictional example CV is built so they can
   see the result immediately.
2. **Given** a fresh copy, **When** the user runs the documented "start my CV" command, **Then**
   a personal data file is created from the example in a location git ignores.
3. **Given** the user has edited their personal data file, **When** they build, **Then** their
   PDF is produced and the example is not.
4. **Given** the user's data contains characters that are special to the typesetting engine
   (`&`, `%`, `$`, `#`, `_`, accented letters, `C#`, `R&D`), **When** they build, **Then** the
   text appears in the PDF exactly as written.
5. **Given** the user's data is invalid (missing required field, wrong type, malformed file),
   **When** they build, **Then** they get a message naming the field and file location, not a
   typesetting engine log.

---

### User Story 3 - The user's data cannot be published by accident (Priority: P1)

The user should not have to know about `.gitignore`, public forks, or CI pipelines to stay safe.

**Why this priority**: Principle I of the constitution; the owner's own GDPR problem came from
exactly this kind of accident.

**Independent Test**: try to commit personal data and built PDFs with ordinary commands
(`git add .`, `git commit -a`); nothing personal is staged. Force-add a file anyway and push to
a copy of the project; the automated checks fail.

**Acceptance Scenarios**:

1. **Given** a user with personal data and built PDFs, **When** they run `git add .`, **Then**
   none of those files are staged.
2. **Given** a user force-adds a personal file and pushes, **When** the project's automated
   checks run, **Then** they fail with a message explaining what was found and how to remove it.
3. **Given** a user reading the README, **When** they look for how to get their own copy,
   **Then** the first option shown produces a private copy, and the README states plainly that
   forks of a public repository are public.
4. **Given** the automated pipeline runs on any copy of the project, **When** it finishes,
   **Then** it has built only the fictional example and has published nothing.

---

### User Story 4 - One data file, several languages (Priority: P2)

A user applying in several countries writes their CV once and gets a PDF per language. Dates,
company names, and links are written once; only the text that differs is translated.

**Why this priority**: preserves the main strength of the existing template, but a single
language is already a complete product.

**Independent Test**: a data file declaring two languages builds two PDFs whose headings,
labels, and translated text are in the right language while shared facts are identical.

**Acceptance Scenarios**:

1. **Given** a data file that declares languages English and Spanish, **When** the user builds,
   **Then** two PDFs are produced, one per language, with conventional section headings for
   each language.
2. **Given** a field written once without translations, **When** building any language, **Then**
   that value appears unchanged in every PDF.
3. **Given** a field translated for some languages but not for one declared language, **When**
   building, **Then** the build fails naming the field and the missing language.
4. **Given** a language without built-in headings, **When** the user provides headings in their
   data file, **Then** the build uses them.

---

### User Story 5 - The user verifies their CV is ATS-readable (Priority: P2)

After building, the user runs one command that checks the PDF's text layer the way an applicant
tracking system would read it, using their own data as the reference.

**Why this priority**: the verification suite is what makes this template better than a generic
one, but it is useful only once a PDF exists.

**Independent Test**: build any valid CV, run the verify command, see all checks pass; introduce
a known defect (e.g. a page overflow beyond the expected page count) and see the matching check
fail.

**Acceptance Scenarios**:

1. **Given** a built CV, **When** the user runs verify, **Then** the checks confirm their own
   name, email, and phone survive extraction, headings are present, reading order is correct,
   bullets and dates are attached to their entries.
2. **Given** the user's data declares an expected page count, **When** the PDF has a different
   count, **Then** verify fails and says so.

---

### Edge Cases

- User has no photo, or does not want one (photos are discouraged in some countries): the CV
  builds without a photo slot and without a broken image.
- User omits an optional section (awards, languages, summary): the heading is not printed.
- User has only one job, or no education: builds correctly; verify does not demand a minimum
  number of entries that the data itself does not contain.
- An entry is current ("2024 – present"): the "present" word is localised per language.
- Very long content: build succeeds; verify reports the page count mismatch rather than the
  build failing.
- User clones the project for the second time after an update: their data folder is untouched by
  pulling updates, because no tracked file lives inside it.
- Owner's old CV links already circulating (LinkedIn, emails): they stop resolving; the owner
  must update them to wherever they now share the CV privately.

## Requirements *(mandatory)*

### Functional Requirements

**Data removal (owner)**

- **FR-001**: The public repository MUST end up with no commit, branch, tag, release, release
  asset, or retained workflow artifact containing the owner's personal data.
- **FR-002**: Before anything public is removed, the owner's current data (content, photo, and
  last built PDFs) MUST be preserved in the local, ignored data location so nothing is lost.
- **FR-003**: Repository documentation, assistant instructions, and licence MUST NOT name the
  owner as the CV subject; authorship credit for the tool itself is allowed.
- **FR-004**: Remote cleanup strategy: the existing public repository is deleted (taking its
  releases, tags, and artifacts with it) and a new public repository with the same name is
  created from a single fresh commit containing only the generic tool. No old object may be
  pushed to the new repository.

**Creating a CV (any user)**

- **FR-005**: A user MUST be able to describe a complete CV in one plain-text data file:
  header (name, headline, contact items, optional photo), summary, skills groups, experience
  entries with bullets, education entries with optional note, awards, and spoken languages.
- **FR-006**: Users MUST NOT need to write typesetting markup or escape special characters; the
  tool MUST escape all user text.
- **FR-007**: The project MUST ship a complete fictional example data file and placeholder photo
  that build out of the box.
- **FR-008**: A single command MUST create the user's personal data file from the example inside
  the ignored data location, refusing to overwrite an existing one.
- **FR-009**: The build MUST use the user's data when it exists and fall back to the example
  otherwise; the user MUST be able to select a different data file explicitly.
- **FR-010**: Invalid data MUST produce an error naming the file, the field path, and the problem.
- **FR-011**: Optional sections and the photo MUST be omittable without leaving empty headings or
  layout gaps.
- **FR-012**: Output file names MUST be derived from the user's name and language (e.g.
  `CV_Doe_Jane_EN.pdf`), and output MUST go to an ignored build location.

**Multi-language**

- **FR-013**: A data file MUST declare its languages; one PDF is produced per language.
- **FR-014**: Any text field MAY be given either as one value for all languages or as one value
  per language; a missing translation for a declared language MUST fail the build.
- **FR-015**: Built-in section headings and fixed labels MUST exist for at least English,
  Spanish, and Catalan; the data file MAY override or add headings for any language.

**Privacy guards**

- **FR-016**: The ignored locations (personal data, build output) MUST be ignored by default in
  every fresh copy.
- **FR-017**: An automated check MUST fail if any tracked file lies in the personal data
  location, or if any PDF is tracked; it MUST run in the project's pipeline and be runnable
  locally.
- **FR-018**: The pipeline MUST build and verify only the example, MUST NOT stamp dates into
  files, and MUST NOT create releases.
- **FR-019**: The README MUST recommend a private copy first and explain why public forks are
  unsafe for personal data.
- **FR-020**: The tool MUST NOT make any network request with user data; the only network
  activity permitted is the typesetting engine fetching its own fonts and packages.

**Verification**

- **FR-021**: The verify command MUST derive its expectations (name, email, phone, headings, entry
  count, page count) from the data file that produced the PDF, not from hardcoded values.
- **FR-022**: All existing text-layer checks (real text layer, reading order, attached bullets,
  attached dates, no stray glyphs, no unresolved references) MUST be preserved.

### Key Entities

- **CV data file**: one person's CV in one or more languages. Holds a header, ordered sections,
  and settings (languages, expected page count, font size).
- **Header**: name, headline, location, contact items (each optionally a link), optional photo.
- **Entry**: one role or qualification — title, organisation, location, dates (start, end or
  "present"), bullets, optional note.
- **Skill group**: a label and a list of keywords.
- **Localisable text**: either a single value or a per-language map.
- **Language pack**: built-in headings and labels for one language, overridable by the data file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of the owner's name, phone, email, or photo across the public
  repository's files, history, releases, and artifacts after cleanup.
- **SC-002**: A new user goes from getting a copy to holding a PDF of the example in 3 commands
  or fewer, and to a PDF of their own CV in under 30 minutes of editing.
- **SC-003**: The owner's rebuilt CV is visually equivalent to the last published version (same
  content, same page count) in all three languages.
- **SC-004**: In 100% of attempts, `git add .` in a copy with personal data and built PDFs
  stages none of them.
- **SC-005**: Every existing text-layer check passes on the example and on the owner's local CV.
- **SC-006**: A user writes zero lines of typesetting markup to produce their CV.

## Assumptions

- Users are comfortable editing a text file and running commands in a terminal; a graphical
  editor or web interface is out of scope (and would conflict with local-first).
- Prerequisites stay as today: the typesetting engine binary and the PDF text tools; the
  rendering step uses only what ships with a standard scripting runtime on macOS/Linux.
- Windows is supported on a best-effort basis (WSL), as today.
- The repository has no forks and no stars (verified), so deleting it breaks nothing for others.
- Search engines and archive services may hold cached copies of public pages or PDFs; requesting
  their removal is the owner's follow-up and outside the code change, but the cleanup checklist
  lists them.
- One layout (the current one) is enough for v1; theming is limited to an accent colour.
