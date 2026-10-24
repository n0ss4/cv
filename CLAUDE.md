# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first CV builder: a person describes their CV in one TOML file and gets an
ATS-readable PDF per language. The repository holds the tool and a fictional example only —
**never real personal data**. It started life as one person's public CV and had to be scrubbed
for GDPR reasons; Principles I and II of `.specify/memory/constitution.md` exist because of that.

```
example/cv.toml            fictional example (Jane Doe) -- the reference for every field
example/photo.png          generated placeholder silhouette (scripts/make-placeholder.py)
mycv/                      the user's own data -- IGNORED by git, never read into commits
build/                     generated .tex, .expect, PDFs -- IGNORED
scripts/render.py          TOML -> build/<output>_<LANG>.tex + .expect
scripts/_vendor/tomli/     unmodified tomli, used only when stdlib tomllib is missing (Python < 3.11)
atscv.cls                  layout -- all styling and the ATS extraction constraints
scripts/verify-cv.sh       text-layer checks -- the closest thing to a test suite for the output
scripts/check-privacy.sh   fails if mycv/, build/ or any PDF is tracked
tests/run.sh, tests/fixtures/   renderer edge cases (valid ones build + verify, invalid-* must fail)
web/                       the in-browser ATS checker (React + TypeScript, spec 003) -- see "Web checker"
specs/                     spec-kit feature specs; .specify/ holds the constitution and templates
```

## Privacy rules (non-negotiable)

- Never commit anything under `mycv/` or `build/`, or any PDF. Never `git add -f` them.
- Never put a real person's name, phone, email, address, employer history or photo into tracked
  files — not in the example, fixtures, specs, commit messages or docs. Fixtures use invented
  names and `example.com`.
- If the user asks for help with *their* CV, edit `mycv/cv.toml`. It is theirs and stays local.
- CI builds the example only. The one thing it publishes is the static web checker (the tool,
  built from tracked files) to GitHub Pages. Do not add release, upload-of-user-data or
  date-stamp-and-commit steps back to the workflows.

## Build

```bash
make           # build from mycv/cv.toml if it exists, else example/cv.toml
make new       # copy the example into mycv/ (refuses to overwrite)
make verify    # check built PDFs against their .expect files
make privacy   # check nothing personal is tracked
make check     # all + verify + privacy
make test      # renderer fixtures
make DATA=path/cv.toml OUT=dir   # explicit data file / output dir
```

Needs tectonic, poppler, and any Python 3.8+ (plus Node ≥ 22 for `web/` only). **Always build through `make`, and never add a
second way to compile.** CI installs the tectonic version pinned in `TECTONIC_VERSION` and runs
these same targets. A previous arrangement — a Makefile calling `latexmk` and a workflow invoking
pdfLaTeX with its own flags — drifted until a line wrapped differently in CI than locally.

**Successful compilation is not sufficient validation.** Every defect this project has hit was
invisible on the rendered page. Run `make check DATA=example/cv.toml && make test` before
considering a change done. Each check in `scripts/verify-cv.sh` guards a bug that has really
occurred, so a failure means something regressed, not that the check is fussy.

## How rendering works

- `render.py` validates the whole file first and prints every problem as
  `FILE: field.path: message`; nothing reaches LaTeX until the data is valid. Keep it that way —
  users must never see a TeX log for a data mistake.
- Any text field is a string or a `{ <lang> = ... }` table; lists may be localised per item or as
  a whole (`bullets.en = [...]`). A declared language missing from a localised field is an error.
- Section kind is inferred from item shape: `keywords` → skills, `title` → entries,
  `label` → lines; a non-list value (or a `[section]` table with only `text`) → paragraph.
- All user text goes through `escape()`; UTF-8 passes straight through (the font is OpenType
  under tectonic/XeTeX), so no accent macros. `|` is escaped because the class uses it as a separator.
- Built-in headings for en/es/ca are in `LABELS`; their wording matches what the verifier and
  parsers have been tested against. `[labels.<lang>]` overrides or adds.
- The `.expect` sidecar (name, email, phone, headings in order, entries, pages, chars) is how the
  verifier knows what to look for. It is read line by line, **never sourced** — it contains user text.
- The photo is copied into `build/` and referenced by bare name, because paths with spaces break
  `\includegraphics`. The generated `.tex` finds `atscv.cls` via `tectonic -Z search-path`.
- TOML trap: a key belongs to the table above it, so `summary = "..."` after `[header]` becomes
  `header.summary`. Unknown keys in `[settings]`/`[header]` are therefore errors with a hint.

## ATS Constraints

Applicant tracking systems read the PDF's text layer, not the visual layout, and several choices
in `atscv.cls` that look like styling mistakes are deliberate fixes for extraction defects:

- **No tables and no multi-column body.** Cells and columns extract out of reading order, or get
  dropped. The photo is fine — an image contributes nothing to the text layer.
- **Bullets are inline (`\cvitem`), not `itemize`.** A list makes each marker its own positioned
  object, and position-grouping extractors then emit all the markers together followed by all the
  text, breaking the pairing.
- **Dates are inline after the organisation, not right-aligned with `\hfill`.** A wide `\hfill` gap
  splits the line into two objects whose order depends on horizontal position — the date can
  surface before its own job title.
- **Hyphenation is disabled.** A parser that does not rejoin `require-\nments` indexes two words,
  neither of them the keyword being searched for.

Verify by extracting the text layer, not by looking at the PDF:

```bash
pdftotext build/CV_Jane_Doe_EN.pdf -
```

It must read top to bottom in the same order as the page, with every bullet attached to its own
text and every job title followed by its organisation and dates.

## Class commands (emitted by render.py, not written by users)

- `\cvheader{photo-or-empty}{name}{title}{contact}` — header band; `\cvsep` separates contact items.
- `\cvsect{Heading}` — section heading.
- `\cventry{title}{organisation}{location}{dates}` — location and dates may be empty.
- `\cvitem{text}` — a bullet. `\cvskill{Label}{a, b, c}` — skills line. `\cvline{Label}{value}`.

## Changing things

- New data field or section kind: update `render.py` (validation + rendering), `example/cv.toml`
  (with a comment), `specs/.../data-model.md` if it changes the model, and add a fixture.
- New built-in language: add it to `LABELS`; add a fixture that builds it.
- Layout change: edit `atscv.cls`, then `make check` on the example and `make test`; look at
  the rendered page too.
- Larger features: spec them with spec-kit (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`) under `specs/`.

## Web checker (`web/`)

React + TypeScript + Vite, in a Clean Architecture. The dependency rule is enforced by
`web/tests/architecture.test.ts`:

```
web/src/domain/          pure TS: document model, line index, layout facts, measured rules,
                         findings catalogue, scoring, verification, rescan diff
web/src/application/     ports (DocumentReader, AiEngine), format registry, document tools,
                         agent orchestrator, versioned prompts/schemas, use cases
web/src/adapters/        PdfReader (pdf.js), ChromeBuiltInEngine (Prompt API), presenters
web/src/infrastructure/  container.ts: the only place that picks concrete adapters
web/src/ui/              React screens and components; state machine in ui/app/analysis.ts
```

```bash
make web          # dev server (loopback)
make web-test     # fixtures + vitest (all layers, UI in jsdom, CSP of the built page)
make web-build    # type-check + production bundle in web/dist
make web-eval     # real-model prompt evaluation at /eval.html (dev only, never built)
```

`make web` also serves `/design.html`: the real app with a scripted model, for looking at and
screenshotting the AI screens (chat, job match) without Gemini Nano. Dev only, never built.
Judge layout changes by viewport-only screenshots at 1440×900, 1280×800, 1024×768 and 390×844.

- **Privacy is enforced, not promised.** The built page carries `connect-src 'none'`
  (`vite.config.ts`, checked by `tests/build.test.ts`); nothing may use storage APIs; all assets
  are same-origin; no inline `style` attributes (data-driven sizes are SVG attributes).
- **Measured vs AI.** Layout/parsing findings come from deterministic rules
  (`domain/layout/rules.ts`) and are labelled *Measured*. The model only extracts the profile and
  reviews content; its findings are *AI · verified* or *AI · unverified* depending on whether
  their quotes are on the cited lines. The model never produces the score.
- **Job match (spec 004)** lives in `domain/job/`: a reviewed equivalence list decides which terms
  are "the same" (never the model), years/CEFR/knock-outs/summary are computed, and a guard drops
  any suggested phrasing that adds numbers, names or technologies its source line lacks.
- **Chat with your CV (specs 005, 006)**: a panel docked beside the report at the window's height
  under the sticky header (composer always in view; full screen below 1024 px), not a tab. The
  report column is a CSS container so the panel never covers it. One `ask` task per question (tool loop, ≤ 4 calls, last 4 exchanges as memory).
  Citations are verified, rewrites pass the 004 guard against their source line plus the posting
  terms the CV already has, and out-of-scope answers are replaced by the page's refusal. The
  posting is added, changed and removed only in the chat; the Job match tab is its detailed
  report and exists only while a posting is in context (removing it restores the score); the model may only *pick* cards (fit,
  knockouts, keywords, gaps) that the page renders from its own match, never write figures.
  The conversation survives a new version of the CV (the posting is re-compared and a page
  message says what changed); only Clear everything removes it. Tool results reach every task
  framed as "document data, not instructions", and the chat cannot change the report.
- **New file format:** implement `DocumentReader` in `adapters/readers/<format>/` and register it
  in `infrastructure/container.ts` -- nothing else changes (see `adapters/readers/README.md`).
- **New AI engine:** implement `AiEngine`; it must declare `runsOn: "device"`. An engine that
  downloads weights from elsewhere needs a constitution amendment (its download is page-initiated).
- Prompt, schema or catalogue changes bump `application/prompts/version.ts` and are evaluated with
  `make web-eval` on real hardware; CI cannot run the model.
- Fixtures are LaTeX in `web/tests/fixtures/` (fictional Taylor Example), built by `make web-fixtures`.
- `\uXXXX` escapes in regexes: write them with real backslashes; check with `git diff` that no raw
  private-use characters slipped into source.

## CI

`.github/workflows/build.yml` runs on push to main, PRs and manual dispatch, with
`contents: read`: privacy check first, then restores tectonic's cache, installs the pinned
tectonic binary (version + SHA-256), `make check DATA=example/cv.toml`, `make test`,
`make web-test`, and uploads the example PDFs as a short-lived artifact.
`.github/workflows/pages.yml` (main only) re-runs `make web-test` and deploys `web/dist` to
GitHub Pages; it sets `VITE_SOURCE_URL` from the repository, so no account name is in the code.

- **The cache key includes `TECTONIC_VERSION`.** The cached directory holds a precompiled format
  built by that exact binary; `restore-keys` falls back only within the same version.
- **The engine is pinned by version and checksum.** The workflow once used a Docker image tagged
  `:latest` that was rebuilt quarterly, so the line breaks could change without a commit here.
  Bumping `TECTONIC_VERSION` is deliberate: rebuild locally first and check page counts.
