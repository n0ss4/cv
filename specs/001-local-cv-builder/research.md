# Research: Local, Privacy-First CV Builder

## R1. Data format users edit

- **Decision**: TOML, parsed with Python's standard-library `tomllib`.
- **Rationale**: plain text, comments allowed, no indentation traps, arrays of tables map
  naturally to "a list of jobs".
- **Finding during implementation**: macOS still ships Python 3.9 as `/usr/bin/python3`, and
  Ubuntu 22.04 ships 3.10 — neither has `tomllib` (3.11+). The renderer therefore falls back to a
  vendored, unmodified copy of `tomli` 2.2.1 (MIT, pure Python, the parser `tomllib` was adopted
  from; wheel SHA-256 verified against PyPI). Works on Python 3.8+ with nothing to install.
  Constitution amended to 1.0.1 accordingly.
- **TOML trap found**: a key belongs to the table above it, so `summary = "…"` after `[header]`
  becomes `header.summary`. Unknown keys in `[settings]`/`[header]` are errors with a hint, and a
  text section may be written as `[summary]` + `text = "…"`.
- **Alternatives considered**:
  - *Keep LaTeX string catalogues* — users must learn `\newcommand`, escaping, and edit two
    kinds of file per change; fails Principle IV.
  - *YAML* — friendlier for some, but needs PyYAML (a pip install) and has indentation and
    type-coercion traps (`no` → false, `2024-01` dates).
  - *JSON* — no comments, noisy for prose.
  - *Rewrite in Typst* (native YAML/TOML reading, single binary) — attractive, but discards the
    ATS-tuned class and its regression history; a separate decision if ever wanted.

## R2. Rendering pipeline and where the class is found

- **Decision**: `scripts/render.py` writes `build/<Base>_<LANG>.tex`; the Makefile compiles each
  with `tectonic -Z search-path=. --outdir build`.
- **Rationale**: verified with tectonic 0.17.0 that `-Z search-path` makes `atscv.cls` at the
  repository root resolvable from a file in `build/`, so the class is never copied. The photo
  path is written as an absolute path into the generated `.tex`.
- **Alternatives considered**: copying the class into `build/` (duplicates the source of truth);
  generating at the root (litters the tree, risks committing generated files).

## R3. Character handling

- **Decision**: write UTF-8 straight through; escape only LaTeX specials
  (`\ & % $ # _ { } ~ ^`) and `|` (used as a separator by the class); break the `--`, ` `` `,
  `''` ligatures. The straight apostrophe still typesets as ’, as it always has in this template.
- **Rationale**: under tectonic (XeTeX) the `raleway` package loads the OpenType font; a test
  document with `é à ñ ç ü col·laborar ł ő € ’ – — “” ß ø` rendered correctly and extracted
  identically through `pdftotext`. The old hand escapes (`\'e`, `\textperiodcentered`) are no
  longer needed. Known gap: glyphs missing from Raleway (e.g. `Ž` loses its caron) — documented.
- **Alternatives considered**: mapping every non-ASCII character to a LaTeX accent macro — large
  table, still incomplete, no benefit given the result above.

## R4. Localisation model

- **Decision**: any text field is either a string (all languages) or a table keyed by language
  code. Lists may be localised per item or as a whole (`bullets = { en = [...], es = [...] }`).
  A declared language missing from a localised field is a build error naming the field path.
- **Rationale**: keeps the old template's core property — structure written once — while
  letting a one-language user ignore localisation entirely.
- **Built-in labels**: section headings and "Present" for `en`, `es`, `ca`, taken verbatim from
  the current catalogues so the existing verifier headings still hold; `[labels.<lang>]` in the
  data file overrides or adds a language.

## R5. Verifier expectations

- **Decision**: the renderer writes `build/<Base>_<LANG>.expect`, one `key=value` per line; the
  verifier reads it with `IFS== read -r` and never `source`s or `eval`s it.
- **Rationale**: the old verifier hardcoded the owner's email, phone, name, and "≥ 9 entries".
  Deriving expectations from the same data that produced the PDF makes every check valid for any
  user. Reading without evaluation means a name containing `$(…)` cannot execute.
- **Alternatives considered**: verifier parses TOML itself (duplicates the localisation logic in
  shell); Python verifier (would rewrite a working, battle-tested script).

## R6. Data location and selection

- **Decision**: `mycv/cv.toml` if it exists, otherwise `example/cv.toml`; override with
  `make DATA=path/to/cv.toml`. `make new` copies the example in, refusing to overwrite.
- **Rationale**: zero-config first run shows a result immediately (SC-002); once the user starts,
  their data wins without flags. The directory name is short, obvious, and ignored.

## R7. Privacy guards

- **Decision**: `.gitignore` covers `mycv/`, `build/`, `*.pdf`; `scripts/check-privacy.sh` fails
  if `git ls-files` lists anything under `mycv/` or any `*.pdf`, and is part of `make check` and
  CI. README leads with "Use this template → Private".
- **Rationale**: GitHub forks of a public repository cannot be made private; a template copy can.
  The check catches `git add -f`, which `.gitignore` alone does not.
- **Rejected**: a git pre-commit hook — hooks are not cloned, so it protects nobody by default.

## R8. Removing the owner's data from GitHub

- **Decision**: archive locally, delete the repository, recreate it from a fresh root commit.
- **Rationale**: deleting a repository removes its releases, assets, tags, workflow artifacts and
  caches together. A history rewrite plus force-push leaves the old commits reachable by SHA
  (and through cached release pages) until GitHub Support runs a purge. Verified: 0 forks, 0
  stars, so deletion breaks nothing for third parties.
- **Residual exposure (owner follow-up)**: search-engine caches and web archives of the README
  or PDFs; links on external profiles pointing at `releases/latest/download/...`.
