# Feature Specification: ATS Checker 2 — rebuilt app, extensible formats, transparent AI

**Feature Branch**: `003-react-ats-checker`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Using spec-kit, change everything to a React + TypeScript application
using Clean Architecture. Change the design with grafta. Think better about UX for users. Check on
the internet how ATS work, to implement these things better. Create a good architecture for new
file types: for now PDF, but in the future Word or more. The design needs to be more transparent
about privacy and about AI." Follow-up answers: Chrome built-in AI only for now, but the
architecture must let other engines be added; build through `make web`, CI deploys the static app
to GitHub Pages; this is a new feature, 002 stays as the record of the checker's behaviour.

## Clarifications

### Session 2026-10-17

- Q: Relationship to 002? → A: 003 replaces 002's implementation and keeps its behaviour. Every
  privacy, AI and evidence guarantee of 002 (FR-001…FR-021 there) still holds unless this spec
  changes it explicitly. 002's contracts (tools, schemas, findings) are the starting point and are
  carried into this feature's contracts.
- Q: AI engine? → A: Only the browser's built-in on-device model for now. The design must allow
  another on-device engine later without changes to the analysis logic.
- Q: Hosting? → A: Runs locally through `make web` and as a static GitHub Pages site deployed by
  CI. The deployed site contains the tool only, never user data.
- Q: "Confidence" for AI findings? → A: The on-device model gives no calibrated probability, so
  the page shows no invented percentage. Each result instead states its **provenance**:
  *measured* (a fact read from the file without AI), *AI, evidence verified*, or *AI, unverified*.
- Q: Who decides parsing findings? → A: Layout and parsing defects are **measured** by
  deterministic rules over the layout facts and labelled as such. Content, contact, sections and
  keywords stay AI-reviewed. (This narrows 002's "AI, no algorithm" to where judgement is needed.)
- Q: Visual direction? → A: Evolve the existing teal identity (`#115E59`, shared with the CV
  class): calmer, more whitespace, a privacy motif, light and dark.

## Context

Research into how commercial parsers (Workday, Greenhouse, Lever, Ashby, iCIMS, SmartRecruiters,
Textkernel/Sovren) read CVs agrees with the defects this project already found:

- Text is read in the file's stream order, not visual order: two-column layouts and sidebars
  interleave, and table cells come out in unpredictable order.
- Text in page headers/footers is often dropped, so contact details placed there disappear.
- Design-tool exports (Canva, Figma, InDesign) can put text into graphics or outlines: the parser
  sees a nearly blank page. Skill bars and star ratings contribute nothing.
- Section detection is often pattern-based: "My Professional Journey" is not recognised as
  experience.
- Abbreviated or ambiguous dates ("Jan '22", "01/02/22") are misread; "January 2022 – Present"
  is safe.
- Fonts without a proper Unicode mapping garble accented characters, which hits European names.
- Icon-only contact labels (an envelope instead of "Email") can be missed.
- Recruiters rarely get auto-rejections from the ATS. They **search and filter** the parsed
  record, most often by skills, then education, job title and certifications. A CV fails when its
  fields are wrong or missing, so it never appears in those searches.

The checker's message to users follows from this: *"this is what the ATS will file about you, and
here is what will stop you appearing in a recruiter's search."*

Today's checker is a single page of hand-wired scripts. It works, but every new capability (a new
file format, a new AI engine, a new view) touches everything. Users also have to trust its privacy
claims, and AI output is not clearly separated from facts measured in the file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check a CV and know what to fix first (Priority: P1)

A job seeker opens the page, drops their CV and follows a visible sequence of steps (reading the
file, checking the layout, extracting the profile, reviewing). They then see a verdict, a score
broken down by category, and a short **"Fix these first"** list: the three to five
highest-impact problems, each with what is wrong, why an ATS or recruiter cares, how to fix it,
and the line it refers to. Everything else sits below, grouped by category.

**Why this priority**: it is the product. Without a clear first action the review is a wall of
findings.

**Independent Test**: in a supported browser, drop the example CV built by this repository → the
verdict is "ready" and "Fix these first" is empty or minor-only. Drop the two-column fixture → the
first item in "Fix these first" is the column problem, with its evidence lines.

**Acceptance Scenarios**:

1. **Given** a supported browser with the model ready, **When** the user drops a CV, **Then** a
   step list shows each stage as pending / running / done / failed, with the current one
   described in plain words ("Reading page 2 of 2"), and the analysis can be cancelled.
2. **Given** a finished review, **When** results appear, **Then** "Fix these first" holds at most
   five items, ordered by severity, then category weight, then position in the document.
3. **Given** any finding, **When** it is opened, **Then** it shows title, why, fix, evidence
   (quoted text and line), category, severity and provenance.
4. **Given** a file with no extractable text, **When** dropped, **Then** the page explains it is
   unreadable by an ATS (it is probably scanned or exported as images), without calling the
   model.
5. **Given** the same file analysed twice, **When** the results are compared, **Then** the
   verdict and the set of critical and major findings are the same.

---

### User Story 2 - Trust it: see where my data goes and what the AI did (Priority: P1)

Before choosing a file, the user can see what will happen to it: the file is read in this
browser tab; the AI model runs on this device; nothing is uploaded, stored or tracked; closing
the tab erases everything. A permanently visible **privacy status** shows this as a live state,
and a details panel explains how it is enforced and how to check it themselves. An **"About the
AI"** panel names the model, says it runs on the device, what it is good and bad at, that it can
be wrong, and how quality varies by language. During and after analysis, a log shows every look
the AI took at the document, step by step.

**Why this priority**: the user asked for far more transparency, and the page asks people to
drop a document full of personal data. Trust has to be earned before the drop.

**Independent Test**: open the page with the network disconnected after load, analyse a CV, and
confirm it works. Open the privacy panel and follow its "check it yourself" instructions; the
browser's network panel shows no request carrying file content. Open the AI log and confirm that
each entry names the tool, its arguments and what it returned.

**Acceptance Scenarios**:

1. **Given** the page has loaded, **When** the user has not chosen a file yet, **Then** a privacy
   summary next to the drop zone states in at most three short lines where processing happens and
   that nothing is uploaded or stored, with a link to the details panel.
2. **Given** any screen, **When** the user looks at the header, **Then** a privacy status
   indicator is visible. It reads "On this device · nothing uploaded" and opens the details panel.
3. **Given** the details panel, **When** it is opened, **Then** it lists, for each part of the
   work (reading the file, AI model, results), where it runs and what it keeps. It also explains
   the enforcement (the page is forbidden from making outbound connections), states the one
   exception (the browser's own one-time model download, which carries no user data), and gives
   step-by-step instructions to verify with the browser's developer tools.
4. **Given** any result in the review or profile, **When** displayed, **Then** it carries a
   provenance label: *Measured*, *AI · verified*, or *AI · unverified*, and the label explains
   itself on hover or focus.
5. **Given** the "About the AI" panel, **When** opened, **Then** it names the model and engine,
   says it runs locally, lists known limits (small model; may miss or invent issues; evidence is
   checked against the document; no score is asked of the model, the score is computed from the
   findings by a published formula), gives the CV language's quality note, and links to the exact
   prompts and schemas used.
6. **Given** the AI log, **When** opened, **Then** each step shows the task, every tool call
   (name, arguments, returned data), retries and their reason, and how long it took.
7. **Given** the user clicks "Clear", **When** done, **Then** the file, its text and all results
   are dropped from memory, and the page says so.

---

### User Story 3 - See exactly what the ATS will file (Priority: P1)

Next to the review the user sees the **extracted profile** (contact, headline, experience with
titles, organisations and dates, education, skills, languages, certifications) and the **ATS
view** (the raw text in the order a parser reads it, with line numbers). Missing or misread
fields are flagged in the profile. They are the most direct proof that something is wrong, and
they are what a recruiter's search would match against.

**Why this priority**: it turns abstract advice into evidence the user can see.

**Independent Test**: analyse the example CV. The profile shows the right name, email, phone,
every role with its organisation and dates, and the education entries. Selecting a finding
highlights its lines in the ATS view.

**Acceptance Scenarios**:

1. **Given** an analysed CV, **When** the user opens the profile, **Then** every field links to
   the line it came from, absent fields show as "Not found", and the fields recruiters filter on
   most (skills, education, job titles, certifications) are marked as such.
2. **Given** a selected finding, **When** the ATS view is shown, **Then** the evidence lines are
   highlighted and scrolled into view.
3. **Given** the ATS view, **When** the user presses "Copy", **Then** the plain text is copied.

---

### User Story 4 - Fix, rescan, see what changed (Priority: P2)

After editing the CV elsewhere, the user drops the new version. The page compares it with the
previous analysis from the same session and shows the score change, which findings were
resolved, which are new, and which remain.

**Why this priority**: improving a CV is iterative. Showing progress rewards the user for each
fix.

**Independent Test**: analyse the two-column fixture, then the example CV in the same tab → the
comparison shows the column finding as resolved and the score as increased.

**Acceptance Scenarios**:

1. **Given** a previous analysis in this session, **When** a new file is analysed, **Then** a
   comparison shows previous vs current verdict and score, and findings as resolved / new /
   unchanged (matched by finding type and evidence).
2. **Given** the user clears the session or closes the tab, **When** they return, **Then** there
   is no previous analysis. Nothing was stored.

---

### User Story 5 - Compare against a job posting (Priority: P2)

> Extended by `specs/004-job-match-depth/` (match summary, exact keywords, where and how to add,
> knock-out filters).

As in 002: the user pastes a posting and, optionally, the job title. The page lists each
requirement as matched / partial / missing with CV evidence, whether the title appears in the CV,
and how to phrase missing skills, so the CV appears in a recruiter's search for this role.

**Acceptance Scenarios**:

1. **Given** an analysed CV and a posting, **When** the user compares, **Then** each requirement
   shows its status and, if matched, the CV line that matches it.
2. **Given** no posting, **When** results are shown, **Then** the keyword category is left out of
   the score, not counted as zero, and the page says so.

---

### User Story 6 - Know immediately whether this browser can do it (Priority: P1)

On a browser or device without the built-in model, the page explains before any file is chosen
what is needed and why: an on-device model keeps the CV private, and only some browsers and
computers have one. The page still offers the parts that need no AI: the ATS view and the
**measured** layout checks.

**Acceptance Scenarios**:

1. **Given** no on-device model, **When** the page loads, **Then** a notice above the drop zone
   explains the requirement and what still works.
2. **Given** that state, **When** the user drops a CV, **Then** the ATS view and measured layout
   checks are shown, labelled *Measured*. No AI finding, profile or score is invented.
3. **Given** the model is downloadable but not downloaded, **When** the user starts the first
   analysis, **Then** the page explains the one-time download (size, that the browser downloads
   it, that it carries no CV data) and asks for consent. It then shows progress and continues on
   its own.

---

### User Story 7 - New file formats without a rewrite (Priority: P2, for maintainers)

A maintainer adds Word (.docx) support later by writing one new reader for that format and
registering it. The drop zone, accepted file types, help text, tools, prompts, review and
scoring keep working unchanged, and layout checks that only make sense for one format declare
which formats they apply to.

**Why this priority**: PDF is the only format now, but Word is the most common CV format sent to
an ATS, and the user asked for this to be designed in from the start.

**Independent Test**: in the test suite, register a second, test-only reader for a plain-text
format. A file of that type is accepted by the drop zone, analysed end to end with the fake
model, and produces a report. No file outside the new reader and its registration changes.

**Acceptance Scenarios**:

1. **Given** the registered readers, **When** the page renders the drop zone, **Then** the
   accepted types and the "We read: …" help text come from the registry.
2. **Given** a file of an unregistered type, **When** dropped, **Then** the message names the
   supported formats.
3. **Given** a layout fact that a format cannot provide (e.g. page header zones in a format with
   no pages), **When** that format is analysed, **Then** the fact is reported as "not applicable"
   to the model and in the UI, never as "no problem found".

---

### Edge Cases

- CV in a language the model does not officially support (e.g. Catalan): analysis runs, and the
  "About the AI" quality note and a banner say the results may be weaker.
- CV longer than the model's context: the AI reads it in parts through the tools. The analysis
  never sends the whole document in one prompt.
- The model returns invalid output or calls an unknown tool: one retry with the error, then the
  step is marked failed and partial results are shown honestly, with the verdict marked
  incomplete.
- The model cites a line that does not exist, or text that is not on that line: the finding is
  shown as *AI · unverified* and has no line link.
- The model becomes unavailable mid-session: the page falls back to the US6 state and keeps any
  measured results.
- Password-protected, corrupt, empty, unsupported or over-10 MB files: a plain-language message,
  and the model is not called.
- The user drops a second file while one is being analysed: the first analysis is cancelled, and
  the page says so.
- Reduced motion, high contrast, a screen reader, a 390 px phone: every state stays usable.

## Requirements *(mandatory)*

### Functional Requirements

**Privacy (carried from 002, strengthened)**

- **FR-001**: Reading the file and AI inference MUST happen on the device. After load, the page
  MUST be technically prevented from making outbound connections. The only download involved is
  the browser's own one-time model download, which carries no user data.
- **FR-002**: Nothing about the file or the results may be persisted: no storage APIs, cookies,
  analytics or error reporting. Session-only state (the previous analysis for US4) lives in
  memory and is removed by "Clear" or by closing the tab.
- **FR-003**: A privacy status indicator MUST be visible on every screen. It MUST open a details
  panel with the content listed in US2 scenario 3, including instructions to verify it oneself.
- **FR-004**: Every script and asset MUST be served from the page's own origin. No third-party
  fonts, CDNs or embeds.

**AI transparency**

- **FR-005**: An "About the AI" panel MUST be reachable from the header and from every AI result,
  with the content in US2 scenario 5.
- **FR-006**: Every displayed finding and profile value MUST carry a provenance label (*Measured*,
  *AI · verified*, *AI · unverified*). Measured results MUST come from deterministic reading of
  the file, never from the model.
- **FR-007**: Every model step, tool call (name, arguments, result), retry and failure MUST be
  recorded and viewable in the AI log, in order and with timings.
- **FR-008**: The prompts, schemas and findings catalogue MUST be viewable from the page as the
  exact text the model received, labelled with their version.
- **FR-009**: The score MUST be computed from the findings by a published formula. The page MUST
  show that formula, and MUST NOT ask the model for a number.

**Document reading (extensible formats)**

- **FR-010**: Each supported file format MUST be handled by its own reader, which turns the file
  into the same format-neutral document: ordered pages (or one page for formats without pages)
  of lines with text and, where the format has them, positions. It also produces the layout facts
  that format can provide.
- **FR-011**: Accepted file types, size limits and help text MUST come from the set of registered
  readers. Adding a format MUST NOT require changes to analysis, prompts, scoring or UI
  components.
- **FR-012**: Each layout fact MUST state whether it applies to the document's format. Facts that
  do not apply MUST be reported as not applicable, never as "no issue".
- **FR-013**: PDF MUST be supported in this feature. Word (.docx) is planned and MUST be possible
  without breaking FR-011. It is not delivered here.

**AI engine (extensible)**

- **FR-014**: The analysis MUST talk to the AI through one engine interface: availability,
  download with progress, session creation with a system prompt, schema-constrained prompting,
  cancellation and destruction. Only the browser's built-in model is implemented.
- **FR-015**: Model availability (unavailable / downloadable / downloading / available) MUST be
  detected on load and shown. The download MUST start only after explicit user consent.
- **FR-016**: The model MUST reach the document only through the tools of 002's tool contract
  (`doc_info`, `outline`, `read_lines`, `search`, `layout_facts`), extended with any new layout
  facts. Tools return data, never judgements.

**ATS checks (research-grounded)**

- **FR-017**: The findings catalogue MUST keep 002's types and add types for defects that
  real-parser research shows matter: tables or grid layouts, text drawn as graphics or images
  (design-tool exports, pages with little or no text), skill ratings shown as graphics, ambiguous
  or abbreviated date formats, fonts whose characters do not map to real letters (garbled
  accents), and icon-only contact labels. Each type MUST have a definition, category, default
  severity, why-it-matters text citing the parser behaviour, and an expected fix.
- **FR-018**: Layout defects that are invisible in plain text MUST be **measured** without the
  model where the format allows. Measured facts are shown even when no AI is available (US6).
- **FR-019**: The profile view MUST mark the fields recruiters filter on most (skills, education,
  job titles, certifications). A missing skills section, education section or experience
  titles MUST produce a finding explaining that the CV would not appear in such searches.
  Certifications are only checked against a job posting that asks for them.

**Review & UX**

- **FR-020**: Results MUST lead with the verdict, the score breakdown and "Fix these first" (at
  most five items, ordering in US1 scenario 2), followed by all findings grouped by category with
  passed checks collapsed.
- **FR-021**: Progress MUST be shown as named steps with state, the current step's detail, and a
  Cancel action.
- **FR-022**: The rescan comparison of US4 MUST be shown when a previous analysis exists in the
  session.
- **FR-023**: The interface MUST be available in English and Spanish, follow the browser
  language by default with a visible switch, and meet WCAG 2.1 AA (keyboard, screen reader, focus
  order, contrast, reduced motion), on desktop and on a 390 px wide screen.
- **FR-024**: Light and dark themes MUST follow the system setting.

**Design**

- **FR-025**: The visual design MUST be produced as a new grafta design file before
  implementation. It covers: first visit (supported / model needs download / unsupported), consent
  for the model download, analysing, results (fix-first + categories, profile, ATS view, job
  match, rescan comparison), privacy details, About the AI, AI log, and errors, on desktop and
  mobile, in light and dark. Its colour, type and spacing tokens are the implementation's tokens.

**Quality**

- **FR-026**: The prompt evaluation page of 002 MUST keep working: it runs every fixture through
  the real model and compares with expected findings.
- **FR-027**: The automated tests MUST run the full analysis with a scripted fake model and a real
  document reader, so behaviour can be checked without the on-device model.

### Key Entities

- **Document**: format-neutral content of one file: source format, pages, lines (text, optional
  position), metadata. The single source for tools, measured checks and evidence verification.
- **Document Reader**: knows one file format: the types it accepts, its limits, how to turn a file
  into a Document, and which layout facts it can provide.
- **Layout Facts**: measured observations about the document (side-by-side blocks, header/footer
  zones, detached bullets or dates, hyphen breaks, unusual characters, tables, graphics-only
  content), each with an applicability flag.
- **AI Engine**: an on-device model provider: availability, download, sessions.
- **Tool Call**: name, arguments, result, timing, the step it belongs to.
- **Extracted Profile**: what an ATS would file, every value traced to lines and labelled with
  its provenance.
- **Finding**: type (from the catalogue), category, severity, title, why, fix, evidence,
  provenance.
- **Report**: verdict, category scores, overall score, fix-first list, findings, profile, tool
  log, completeness.
- **Rescan Comparison**: previous and current report summaries, with resolved, new and unchanged
  findings.
- **Job Requirements / Match**: as in 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero network requests carrying user data during a full analysis, checked by the
  automated content-policy test and by the manual check in the privacy panel.
- **SC-002**: In a moderated test with five people, at least four can say correctly, before
  dropping a file, where their CV is processed and whether it is stored. They also say correctly,
  for a given finding, whether it came from the AI.
- **SC-003**: The same five people can name the first thing they would fix within 10 seconds of
  the results appearing.
- **SC-004**: On the evaluation page, ≥ 90 % of fixtures produce their expected critical/major
  findings and no critical finding they should not. The example CV produces no critical or major
  finding (002's SC-002, kept).
- **SC-005**: Profile fields on the example CV and fixtures are ≥ 95 % correct, and 100 % of
  evidence labelled *verified* exists at the cited line.
- **SC-006**: Review of a two-page CV completes in under 60 s on supported hardware with the
  model downloaded. The first step indicator appears within 1 s of the drop.
- **SC-007**: Adding a test-only second file format touches only its reader and the registry
  entry (checked by the test in US7).
- **SC-008**: Without built-in AI, the user understands within 5 s why there is no AI review, and
  still gets the ATS view and measured checks.
- **SC-009**: Every screen passes an automated WCAG 2.1 AA check with no violations, and the main
  flow can be completed with the keyboard alone.

## Assumptions

- Supported AI: Chrome's built-in on-device model (Prompt API on the web, Chrome 138+ desktop,
  Windows 10/11, macOS 13+, Linux, ChromeOS Chromebook Plus; >4 GB VRAM or 16 GB RAM with 4+
  cores; 22 GB free disk). Officially supported languages are en, es, ja, de, fr. Requirements
  can change, so the page reads availability at runtime.
- The Prompt API has structured (schema-constrained) output but no native tool calling. Tool use
  stays an orchestrated loop of schema-constrained turns, as in 002.
- Per the user's request, the app is built with React and TypeScript in a Clean Architecture
  (domain → use cases → adapters → infrastructure/UI, with dependencies pointing inwards). This
  requires a constitution amendment allowing a lockfile-pinned npm toolchain for `web/` only,
  invoked through `make web*` targets. Building or using a CV never needs it.
- CI builds the app from the repository and deploys it to GitHub Pages. The deployed artifact is
  built from tracked files only, which contain no user data (Principle I).
- 002's vanilla page is replaced, not kept side by side. The eval fixtures and their expectations
  are reused.
- "Rescan comparison" covers analyses within one open tab only, since nothing is stored.
- Word (.docx) reading, other AI engines, and languages beyond en/es are out of scope. Their
  extension points are in scope.
