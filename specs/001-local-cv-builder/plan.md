# Implementation Plan: Local, Privacy-First CV Builder

**Branch**: `001-local-cv-builder` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-local-cv-builder/spec.md`

## Summary

Turn a personal LaTeX CV repository into a generic, local-first CV builder, and remove the
owner's personal data from the public internet.

Technical approach: keep the ATS-tuned document class (`atscv.cls`) as the only layout. Replace
the hand-written body and LaTeX string catalogues with one TOML data file per person, rendered
to one `.tex` per language by a standard-library Python script, then compiled by the same pinned
tectonic through the same `make` targets. User data lives in a gitignored `mycv/` directory; the
repository ships only a fictional example. The verifier reads its expectations from a sidecar
file the renderer writes, so it works for anyone's CV. CI builds the example only and publishes
nothing. The public repository is then deleted and recreated from one clean root commit.

## Technical Context

**Language/Version**: Python 3.8+ (standard library, plus vendored `tomli` when `tomllib` is absent);
LaTeX via tectonic 0.17.0; POSIX shell for the verifier and privacy check

**Primary Dependencies**: tectonic (pinned in CI by version + SHA-256), poppler (`pdftotext`,
`pdfinfo`) for verification; `scripts/_vendor/tomli` (MIT, unmodified)

**Storage**: plain files — `example/cv.toml` (tracked), `mycv/cv.toml` (ignored), `build/` (ignored)

**Testing**: `make check` = render + compile + text-layer verification + privacy check, run on
the example in CI and on the user's data locally; renderer edge cases covered by a small
fixture set built in `make test`

**Target Platform**: macOS and Linux terminals (Windows via WSL)

**Project Type**: CLI tool / document template (distributed as a GitHub template repository)

**Performance Goals**: full build of a 3-language CV in under 15 s on a warm tectonic cache

**Constraints**: offline-capable after tectonic's first run; no data leaves the machine;
no third-party Python packages

**Scale/Scope**: one person's CV per copy, 1–5 languages, 1–2 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|---|---|---|
| I. Privacy by Default | `mycv/` and `build/` in `.gitignore`; fictional example with `example.com` contacts and a generated placeholder photo; `scripts/check-privacy.sh` fails on tracked files under `mycv/` or any tracked PDF, run by `make check` and CI; owner data purged by delete-and-recreate | PASS |
| II. Local-First | renderer and verifier are local scripts; CI builds `example/` only, no release, no date-stamp commit | PASS |
| III. ATS-Readable Output | `atscv.cls` layout constraints unchanged; all existing checks kept, parameterised from data | PASS |
| IV. Data, Not Code | one TOML file; renderer escapes all text; localisable fields; built-in headings per language | PASS |
| V. One Build Path, Minimal Deps | `make` stays the only entry point; adds Python stdlib only (amendment-free: listed in constitution) | PASS |
| VI. Fork-Friendly Simplicity | `make new && $EDITOR mycv/cv.toml && make` ; README leads with "Use this template → Private" | PASS |

Post-design re-check (after Phase 1): PASS — no new dependencies or violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-local-cv-builder/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── cli.md           # make targets and script interfaces
│   └── expect-format.md # renderer → verifier sidecar contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
atscv.cls                  layout -- photo becomes optional, accent colour configurable
Makefile                   all | new | verify | privacy | test | check | clean
example/
├── cv.toml                fictional persona, EN/ES/CA
└── photo.png              generated placeholder silhouette
scripts/
├── _vendor/tomli/         TOML parser for Python < 3.11 (macOS ships 3.9)
├── render.py              TOML -> build/<Base>_<LANG>.tex + .expect
├── verify-cv.sh           text-layer checks, expectations read from .expect
├── check-privacy.sh       fails on tracked mycv/ files or tracked PDFs
└── make-placeholder.py    one-off generator for example/photo.png (stdlib PNG writer)
tests/
├── run.sh                 builds each fixture through make, checks expect-text / expect-error
└── fixtures/              minimal, special-chars, fourth-language, invalid-*
mycv/                      IGNORED -- the user's cv.toml, photo, anything personal
build/                     IGNORED -- generated .tex, .expect, PDFs
.github/workflows/build.yml  privacy check, build + verify example, make test, no release
README.md, CLAUDE.md, LICENSE.md
```

Removed: `cvbody.tex`, `lang/*.tex`, `CV_<Owner>_*.tex`, `photo.jpg`, the release and
date-stamp steps of the workflow.

**Structure Decision**: single-project CLI layout. The class stays at the root so the generated
`.tex` files find it through tectonic's `-Z search-path`.

## Remote Cleanup Procedure (FR-001 – FR-004)

Executed only after the new tree passes `make check`, and only with the owner's go-ahead at that
moment, because it is irreversible:

1. Archive locally into `mycv/archive/`: a `git bundle --all` of the old history and the last
   built PDFs (FR-002).
2. Replace `.git` with a fresh `git init`; one root commit of the generic tree (no old objects).
3. `gh repo delete <owner>/cv` — removes releases, tags, artifacts, caches.
4. `gh repo create <owner>/cv --public`, push, `gh repo edit --template`.
5. Verify SC-001: search the new remote's files, history, releases for the owner's identifiers.
6. Owner follow-ups outside the repository: update links that pointed at
   `releases/latest/download/...`; request removal of cached copies (search engines, archives).

## Complexity Tracking

No constitution violations to justify.
