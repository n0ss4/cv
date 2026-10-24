# Tasks: Local, Privacy-First CV Builder

**Input**: Design documents from `/specs/001-local-cv-builder/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

## Phase 1: Setup — protect the owner's data before touching anything

- [x] T001 Add `mycv/`, `build/`, `*.pdf` to `.gitignore` so the archive below can never be staged
- [x] T002 [US1] Archive into `mycv/archive/`: `git bundle create old-history.bundle --all`, the
  last built `CV_<Owner>_*.pdf`, and `pdftotext` of each as the SC-003 baseline
- [x] T003 [US1] Copy `photo.jpg` to `mycv/photo.jpg`

## Phase 2: Foundational — renderer and build (blocks every story)

- [x] T004 Implement `scripts/render.py`: load TOML, validate per data-model.md with
  `FILE: path: message` errors, resolve localisation, escape LaTeX, write `.tex` + `.expect`
- [x] T005 [P] Built-in labels (headings + "present") for en/es/ca in `scripts/render.py`, copied
  verbatim from `lang/*.tex`
- [x] T006 [P] Make the photo optional and the accent colour settable in `atscv.cls`
  (`\cvheader` with empty photo argument renders the text block full width)
- [x] T007 Rewrite `Makefile`: `DATA` selection, render then `tectonic -Z search-path=. --outdir build`
  per generated file, targets per contracts/cli.md

## Phase 3: User Story 1 — owner's data off the public repo, CV kept locally (P1) 🎯

- [x] T008 [US1] Convert `cvbody.tex` + `lang/{en,es,ca}.tex` into `mycv/cv.toml` (one-off script in
  the scratchpad, not committed); un-escape LaTeX to UTF-8
- [x] T009 [US1] Build from `mycv/cv.toml`; diff text layer against the T002 baseline; 2 pages per
  language (SC-003)
- [x] T010 [US1] Delete `cvbody.tex`, `lang/`, `CV_<Owner>_*.tex`, `photo.jpg`
- [x] T011 [US1] Scrub `README.md`, `CLAUDE.md`, `LICENSE.md`, workflow and class comments of the
  owner's identifiers; `grep -ri` for name, phone, email, handle returns nothing tracked

## Phase 4: User Story 2 — anyone builds a CV locally (P1)

- [x] T012 [P] [US2] `scripts/make-placeholder.py` → `example/photo.png` (stdlib PNG silhouette)
- [x] T013 [P] [US2] `example/cv.toml`: fictional Jane Doe, EN/ES/CA, every section shape, special
  characters (`C#`, `R&D`, `100%`), comments explaining each field
- [x] T014 [US2] `make new` refuses to overwrite; `make` prefers `mycv/` over `example/`
- [x] T015 [P] [US2] `tests/fixtures/`: `minimal.toml` (one language, no photo, one entry),
  `special-chars.toml`, `invalid-missing-name.toml`, `invalid-missing-translation.toml`,
  `invalid-bad-photo.toml`; `make test` asserts outcomes and error field paths

## Phase 5: User Story 3 — no accidental publication (P1)

- [x] T016 [US3] `scripts/check-privacy.sh` per contracts/cli.md; wire into `make check`
- [x] T017 [US3] Rewrite `.github/workflows/compile-latex.yml` → build example, verify, privacy,
  `make test`; remove date stamping, commit, and release steps; `contents: read`
- [x] T018 [US3] README: "Use this template → Private" first, warning that public forks are public

## Phase 6: User Story 4 — multi-language from one file (P2)

- [x] T019 [US4] `[labels.<lang>]` overrides and custom sections; covered by a fixture with a
  fourth language (`fr`) supplying its own headings

## Phase 7: User Story 5 — verify any user's CV (P2)

- [x] T020 [US5] Rework `scripts/verify-cv.sh` to read `.expect` (no `source`/`eval`), keep every
  existing check, default target `build/*.pdf`

## Phase 8: Polish

- [x] T021 [P] Rewrite `CLAUDE.md` for the generic tool (data model, guards, build); update memory
- [x] T022 Run quickstart V1–V5; `make check` and `make test` green

## Implementation notes

- T007/T015: the test runner lives in `tests/run.sh`; fixtures declare `# expect-text:` and
  `# expect-error:` lines. `OUT` is overridable so tests build into `build/test/`.
- T004: Python 3.9 on macOS lacks `tomllib`; vendored `tomli` added (constitution 1.0.1).
- T020: the old "every bullet carries its own text" check was subsumed by the orphaned-bullet
  regex (same pattern) and merged into it; the text-layer threshold now scales with the data.
- T009: owner's CV rebuilt from `mycv/cv.toml` extracts byte-identical text to the last release
  in all three languages.

## Phase 9: Remote cleanup (US1, irreversible — owner confirms at this point)

- [ ] T023 [US1] Fresh `git init`, single root commit of the generic tree
- [ ] T024 [US1] `gh repo delete <owner>/cv`; `gh repo create <owner>/cv --public`; push; mark template
- [ ] T025 [US1] Verify SC-001 against the new remote; list owner follow-ups (external links,
  search-engine cache removal)

## Dependencies & Execution Order

- Phase 1 first: nothing is deleted before the archive exists.
- Phase 2 blocks Phases 3–7. T005 and T006 are parallel to each other.
- T010–T011 only after T009 proves the owner's CV rebuilds.
- Phases 4–7 can proceed in parallel after Phase 2; Phase 8 after all of them.
- Phase 9 last, after `make check` and `make test` pass, and only with explicit confirmation.
