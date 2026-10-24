# Feature Specification: In-Browser ATS Checker (on-device AI)

**Feature Branch**: `002-ats-checker-web`

**Created**: 2026-10-17

**Status**: Draft (revised: on-device AI)

**Input**: User description: "Using spec-kit, I want a website where you drop your file and it tells
you, at ATS level, whether it is correct, and if not, things to improve. Use grafta to create the
design." Revised: "I don't want to write an algorithm; the page should use local AI (Chrome
built-in AI). The goal is to extract the information via AI, but the AI must have tools to query
the PDF, and it must be told very precisely what to retrieve — so the prompts must be good."

## Clarifications

### Session 2026-10-17

- Q: Which file does the page accept? → A: Any CV as PDF — built with this tool, Word, Canva or
  anything else. The `cv.toml` data file is out of scope.
- Q: Where does it run? → A: Locally (`make web`, or offline) **and** as a static GitHub Pages
  site. In both cases the file is analysed inside the browser and never sent anywhere.
- Q: Repository? → A: Recreated as a clean public template repository once this feature is done.

### Session 2026-10-17 (2)

- Q: Visual system? → A: Tailwind CSS — the official Tailwind design-system file is the design
  reference; the page is styled with Tailwind utilities and should look modern.
- Q: What should "at ATS level" cover? → A: In line with commercial checkers (reference: Toptal's
  ATS resume checker): formatting and parsing, keyword match, measurable achievements, language
  (action verbs), personal data completeness (LinkedIn/GitHub), and fit with a target job;
  present the score as a breakdown by category, and encourage iterating ("revise, rescan").

### Session 2026-10-17 (3)

- Q: Rule-based checks or AI? → A: **AI.** The analysis is done by the browser's built-in,
  on-device language model (Chrome Prompt API, Gemini Nano). No hand-written scoring algorithm.
- Q: How does the AI see the PDF? → A: Through **tools** it can call to query the document
  (read lines, search, outline, layout facts). Tools return data, never judgements; the model
  decides. What the model must retrieve is fixed by **precise extraction schemas and prompts**,
  which are first-class, versioned, reviewed artefacts.
- Q: Browsers without built-in AI (Firefox, Safari, mobile, low-end PCs)? → A: A clear notice of
  what is required, plus the ATS view (the text as a parser reads it). No score.

## Context

The builder's verification suite proved which defects make applicant tracking systems misread a
CV. A commercial "ATS checker" sends your CV to a server. This page does the same job with a
language model that runs **inside the user's browser**: the PDF is read locally, the model runs
locally, and nothing is transmitted. The model works like an assistant with a PDF in front of it:
it calls tools to look at the document, fills in a strictly defined record of what an ATS would
extract, and then reviews that record against what recruiters and ATS reward.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get an ATS review of any CV, privately (Priority: P1)

A job seeker opens the page in a supported browser, drops their CV PDF and, after a short
analysis, sees an overall verdict, a score broken down by category, and a prioritised list of
findings — each with what is wrong, why an ATS or recruiter cares, a concrete fix, and the line of
the CV it refers to.

**Why this priority**: it is the feature.

**Independent Test**: in a supported Chrome, drop the example CV built by this repository → no
high-severity findings; drop a fixture with a missing email, a two-column layout or duty-style
bullets → the matching finding appears with evidence pointing at the right lines.

**Acceptance Scenarios**:

1. **Given** a supported browser with the model available, **When** the user drops a PDF, **Then**
   the review appears without the file or its text leaving the device.
2. **Given** the model is not downloaded yet, **When** the user starts the first analysis,
   **Then** the page explains the one-time model download, shows its progress, and continues
   automatically when it finishes.
3. **Given** any finding, **When** the user reads it, **Then** it has a title, why it matters, how
   to fix it, and evidence (quoted text and line reference) that exists in the document.
4. **Given** a scanned CV with no text, **When** dropped, **Then** the page says it is unreadable
   by ATS without calling the model (there is nothing to read).
5. **Given** the same file analysed twice, **When** results are compared, **Then** the verdict and
   the set of high-severity findings are the same (stable output).

---

### User Story 2 - See what the ATS extracted (Priority: P1)

Next to the review the user sees two things: the **extracted profile** (contact details, roles
with dates, education, skills, languages — exactly what an ATS would file) and the **ATS view**
(the raw text in parser order). Missing or wrong fields in the profile are the most direct proof
of a problem.

**Independent Test**: analyse the example CV; the profile shows the right name, email, phone,
every role with company and dates, and the education entries.

**Acceptance Scenarios**:

1. **Given** an analysed CV, **When** the user opens "Extracted profile", **Then** every field is
   shown with a link to the line it came from, and fields not found are shown as missing.
2. **Given** the ATS view, **When** a finding is selected, **Then** its evidence lines are
   highlighted; the text can be copied.

---

### User Story 3 - Compare against a job posting (Priority: P2)

The user pastes a job posting (and optionally the job title). The model extracts the posting's
requirements, compares them with the extracted profile, and lists matched and missing
requirements, whether the title appears in the CV, and suggestions phrased for this posting.

**Acceptance Scenarios**:

1. **Given** an analysed CV and a posting, **When** the user compares, **Then** requirements are
   listed as matched / partially matched / missing, each matched one citing CV evidence.
2. **Given** no posting, **When** results are shown, **Then** the keyword category is omitted from
   the score rather than counted as zero.

---

### User Story 4 - Know immediately if your browser can do it (Priority: P1)

Someone on Firefox, Safari, a phone or an unsupported PC opens the page and is told plainly what is
needed (desktop Chrome with built-in AI, hardware requirements) — and can still drop a PDF to see
the ATS view.

**Acceptance Scenarios**:

1. **Given** a browser without the Prompt API, **When** the page loads, **Then** an inline notice
   explains the requirement before any file is chosen.
2. **Given** that notice, **When** the user drops a PDF anyway, **Then** the ATS view is shown and
   no score is invented.

---

### User Story 5 - Use it with no installation and no trust required (Priority: P2)

As before: runs from the public site or from a clone, works offline once the model is present,
and the page proves it makes no network request.

**Acceptance Scenarios**:

1. **Given** the page has loaded and the model is available, **When** a CV is analysed with the
   network disconnected, **Then** it works.
2. **Given** the page, **When** analysing, **Then** no request leaves the page (enforced by CSP).

---

### Edge Cases

- CV in a language the model does not officially support (e.g. Catalan): the review still runs;
  the page notes that quality may be lower. Prompt and output languages are English or Spanish.
- CV longer than the model's context window: tools let the model read page by page; the
  orchestrator never sends the whole document in one prompt.
- The model returns invalid JSON or calls an unknown tool: the orchestrator retries once with the
  error, then marks that step as failed and shows partial results honestly.
- The model cites a line that does not exist or text that is not on that line: the evidence is
  rejected and the finding is shown without a line link, flagged "unverified".
- Model unavailable mid-session (memory pressure, user disabled AI): fall back to the US4 state.
- Password-protected, corrupt, non-PDF, or > 10 MB files: plain-language message, no model call.

## Requirements *(mandatory)*

### Functional Requirements

**Privacy**

- **FR-001**: Parsing and AI inference MUST happen on the device. The page MUST make no network
  request after load (CSP `connect-src 'none'`). The only download involved is the browser's own
  one-time model download, initiated by the browser, which carries no user data.
- **FR-002**: The page MUST state visibly that the file never leaves the device, and link to the
  source and to the prompts.
- **FR-003**: Nothing is stored (no storage, cookies, analytics).

**Document access (tools)**

- **FR-004**: The PDF MUST be read locally into positioned text; the model MUST NOT receive the
  binary PDF.
- **FR-005**: The model MUST be able to call these tools, and only these, each returning data and
  never a judgement: `doc_info`, `outline`, `read_lines`, `search`, `layout_facts`. Their
  contracts are in `contracts/tools.md`.
- **FR-006**: Every tool call and result MUST be logged in an inspectable "How the AI read your CV"
  panel, so the user can audit what the model looked at.

**Extraction (what the AI must retrieve)**

- **FR-007**: The model MUST produce an **Extracted Profile** conforming exactly to
  `contracts/schemas.md#extracted-profile`: contact (name, email, phone, location, links),
  headline, sections as headed in the document, experience entries (title, organisation,
  location, start, end, bullets), education, skills, languages, certifications — each value with
  the line reference(s) it came from, and `null` when absent. The model MUST NOT invent values.
- **FR-008**: The orchestrator MUST verify every line reference and quoted value against the
  document; values that cannot be found are marked unverified.

**Review**

- **FR-009**: The model MUST produce **Findings** conforming to `contracts/schemas.md#findings`,
  choosing each finding's `type` from the closed catalogue in `contracts/findings.md` (parsing,
  contact, sections, content, language, dates, length, keywords), with severity
  (`critical | major | minor`), title, why, fix, and evidence.
- **FR-010**: Findings MUST be written in the interface language (English or Spanish).
- **FR-011**: The verdict and category sub-scores MUST be derived transparently from the findings'
  severities (the formula is in `contracts/findings.md`), not asked from the model as a number.
- **FR-012**: Layout defects invisible in plain text (no text layer, side-by-side columns, text in
  page header/footer zones) MUST reach the model through `layout_facts`, and the prompts MUST
  instruct it to report them.

**Prompts**

- **FR-013**: System prompts, task prompts and schemas MUST live in versioned source files
  (`web/js/prompts/`), each with a stated purpose, inputs, output schema and examples; changes to
  them are reviewed like code.
- **FR-014**: A local evaluation page (`/eval.html`) MUST run every fixture CV through the real
  model and compare the result with each fixture's expected findings, for prompt iteration.

**Job comparison**

- **FR-015**: With a posting, the model MUST extract its requirements (schema in
  `contracts/schemas.md#job-requirements`) and judge each as matched / partial / missing against
  the Extracted Profile, citing evidence; the title match is reported separately.

**Availability**

- **FR-016**: On load the page MUST detect the Prompt API and model availability
  (`unavailable | downloadable | downloading | available`) and show the matching state.
- **FR-017**: Model download MUST start only on a user gesture, with visible progress.
- **FR-018**: Without the Prompt API the page MUST offer the ATS view only (US4).

**Interface**

- **FR-019**: Tailwind CSS, built ahead of time; modern style per the design file; English and
  Spanish; usable on mobile and with keyboard/screen reader (WCAG 2.1 AA).
- **FR-020**: The analysis MUST show step-by-step progress (reading, extracting, reviewing,
  comparing) and be cancellable.
- **FR-021**: The visual design MUST be produced as a design file (grafta) covering: upload,
  model download, analysing, results (review, profile, ATS view, job match), AI unavailable,
  error; desktop and mobile.

### Key Entities

- **Document**: pages of positioned text lines, file metadata. Source of every tool result.
- **Tool call**: name, arguments, result, timestamp — the audit trail.
- **Extracted Profile**: what an ATS would file, every value traced to lines.
- **Finding**: type (from catalogue), severity, title, why, fix, evidence.
- **Report**: verdict, category sub-scores, findings, profile, tool log.
- **Job Requirements / Match**: requirements of a posting and their status against the profile.

## Success Criteria *(mandatory)*

- **SC-001**: Zero network requests during analysis (browser log + CSP test).
- **SC-002**: On the evaluation page, ≥ 90 % of fixtures produce their expected critical/major
  findings and no critical finding they should not; the example CV produces no critical or major
  finding.
- **SC-003**: Extracted Profile fields on the example CV and fixtures are ≥ 95 % correct, and 100 %
  of displayed evidence is verified against the document.
- **SC-004**: Review of a 2-page CV completes in under 60 s on supported hardware with the model
  already downloaded.
- **SC-005**: Users without built-in AI understand within 5 s why there is no score (notice above
  the fold).

## Assumptions

- Supported: desktop Chrome with the Prompt API on the web (Chrome 148+), Windows 10/11, macOS 13+,
  Linux, ChromeOS Chromebook Plus; > 4 GB VRAM or 16 GB RAM with 4+ cores; 22 GB free disk for the
  model. These are Chrome's requirements and may change; the page reads availability at runtime.
- The Prompt API has no native tool calling; the orchestrator implements tool use with
  schema-constrained JSON turns.
- Gemini Nano is small: prompts are short, one task per session, few-shot examples included, and
  output always schema-constrained.
- The previous rule-based checks are removed; only extraction utilities that serve the tools
  remain.
