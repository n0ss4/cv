<!--
Sync Impact Report
- Version change: 1.2.0 → 1.3.0
- Modified principles: II. Local-First (CI may deploy the static checker); V. One Build Path,
  Minimal Dependencies (lockfile-pinned npm toolchain for web/ only)
- Reason: feature 003 rebuilds the checker in React + TypeScript, which needs a compiler and
  bundler. The npm toolchain replaces the vendored pdf.js and the Tailwind standalone CLI.
- Prior: 1.2.0 on-device AI + build-time Tailwind CLI; 1.1.0 static client-side pages +
  vendored pdf.js; 1.0.1 vendored tomli.
-->

# ATS CV Builder Constitution

## Core Principles

### I. Privacy by Default (NON-NEGOTIABLE)

- The repository MUST NOT contain personal data of any real person: no names, phone numbers,
  email addresses, postal addresses, photos, employers tied to an individual, or built PDFs.
- A user's own CV data MUST live in a location that git ignores by default (`mycv/`), so the
  safe path is the one that requires no action. Committing personal data MUST require the user
  to deliberately defeat a guard, never merely to forget a step.
- The shipped example MUST use an obviously fictional persona and reserved contact values
  (`example.com` addresses, `+00`-style placeholder numbers, a generated placeholder image).
- Automated checks (local and CI) MUST fail if tracked files contain anything under the
  ignored data location or if built PDFs are tracked.

Rationale: this project began as one person's public CV and had to be scrubbed for GDPR
reasons. Anyone who forks it must not be able to repeat that mistake by accident.

### II. Local-First

- Every capability (editing, building, verifying) MUST work entirely on the user's machine.
- The tool MUST NOT upload, transmit, or publish user data anywhere: no web service, no
  telemetry, no remote rendering.
- CI MUST build and verify only the fictional example. CI MUST NOT publish releases containing
  a CV, and MUST NOT have access to a user's data. CI MAY deploy the static web checker, built
  from tracked files only, to GitHub Pages.
- A static web page that processes the user's file inside their browser is local-first and MAY
  be published (e.g. GitHub Pages), provided it enforces "no outbound connection" technically —
  a Content-Security-Policy with `connect-src 'none'` — and loads every script from its own
  origin. It MUST NOT store the file or its contents.
- AI inference on user data MUST run on the device. Using a model the browser provides and
  downloads itself (e.g. Chrome's built-in Gemini Nano) is local-first: the download carries no
  user data. Shipping model weights from this project, or calling a remote model API with user
  data, is not.

Rationale: the safest personal data is data that never leaves the laptop.

### III. ATS-Readable Output

- Generated PDFs MUST keep a clean text layer: single column, no tables, inline bullets,
  inline dates, hyphenation disabled — the constraints documented in `atscv.cls`.
- "It compiles" is never sufficient: every change MUST pass `make check`, which extracts the
  text layer and verifies reading order, headings, bullets, and dates.
- Each verification check MUST correspond to a defect that has occurred or a guarantee a user
  relies on; checks MUST be driven by the user's data, not hardcoded to one person.

### IV. Data, Not Code

- Users MUST be able to write a complete CV by editing one plain-text data file, without
  writing LaTeX or knowing LaTeX escaping rules.
- Layout (class), structure (renderer), and content (data) MUST stay separated. Changing the
  layout MUST NOT require touching anyone's data.
- One data file MUST be able to produce several languages; fields that do not vary between
  languages (dates, company names, URLs) are written once.

### V. One Build Path, Minimal Dependencies

- `make` is the only build entry point, locally and in CI. No second way to compile.
- The TeX engine is tectonic, pinned by version and checksum in CI.
- Runtime dependencies are limited to: tectonic, Python 3.8+ standard library (no pip
  installs), and poppler for verification. The only third-party code is a vendored, unmodified
  copy of `tomli` in `scripts/_vendor/`, used when the standard-library `tomllib` (3.11+) is
  absent.
- The web checker (`web/`) is the one exception, with an npm toolchain: exact versions in
  `web/package.json`, a committed lockfile, installed only with `npm ci` and run only through
  `make web*` targets. Each package's reason is recorded in the feature's research. Node ≥ 22
  is a development/CI dependency for `web/` only, never needed to build a CV. Using the hosted
  page needs nothing installed. Adding a dependency anywhere requires a constitution amendment
  or, for `web/`, a recorded reason reviewed with the change.

### VI. Fork-Friendly Simplicity

- A new user MUST get from clone to their first PDF with at most three commands.
- The project is distributed as a GitHub template repository; documentation MUST steer users
  to a private copy ("Use this template" → private, or a local clone) rather than a public fork,
  because forks of a public repository are always public.
- Prefer deleting features over adding configuration. YAGNI applies.

## Technical Constraints

- Data format: TOML (parsed by `tomllib`, or the vendored `tomli` on older Pythons).
- Rendering: a Python script turns the data into a `.tex` file per language; tectonic compiles it.
- All generated files (`build/`) and user data (`mycv/`) are gitignored.
- Output target: A4 by default, one or two pages; page count is a user-configurable expectation,
  not a hardcoded rule.

## Development Workflow

- Features are specified with spec-kit (`specs/NNN-*/spec.md` → `plan.md` → `tasks.md`) before
  implementation.
- Every change runs `make check` locally against the example before it is considered done; CI
  runs the same targets and gates merges on them.
- Commits never include files from `mycv/` or `build/`.

## Governance

This constitution supersedes other project conventions. `CLAUDE.md` and `README.md` MUST stay
consistent with it. Amendments are made by pull request that updates this file, bumps the
version (MAJOR: principle removed or redefined; MINOR: principle or section added; PATCH:
wording), and states the reason. Reviews MUST check new changes against Principles I and II
first.

**Version**: 1.3.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
