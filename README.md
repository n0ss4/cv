# ATS CV Builder

Write your CV once, in one plain-text file, and get a clean PDF in as many languages as you
need — one that applicant tracking systems can actually read. Everything runs on your
machine. Your data never leaves it, and never ends up in git.

## Why it's built this way

**Local-first and private by default.** Your CV holds your phone number, email, address
history and perhaps a photo. This project began as one person's CV in a public repository,
with releases anyone could download, and had to be taken down for GDPR reasons. So here your
data lives in `mycv/`, which git ignores, and a check fails the build if anything personal is
ever tracked.

**Readable by machines, not just people.** Applicant tracking systems read the PDF's text
layer, not what you see. The layout avoids everything known to scramble that layer — tables,
columns, list markers, right-aligned dates, hyphenation — and `make verify` checks the result
the way a parser would.

**No LaTeX to learn.** You edit a TOML file. Accents, `&`, `%`, `C#` and the rest are handled
for you.

## Get your own copy — privately

1. Click **Use this template → Create a new repository** and choose **Private**.
   Or just clone this repository without forking it.
2. Clone your copy.

> **Don't fork this repository to store your CV.** On GitHub, a fork of a public repository is
> always public. `mycv/` is ignored by git either way, but a private copy means one fewer way
> to make a mistake.

## Requirements

| Tool | macOS | Debian / Ubuntu |
| --- | --- | --- |
| [tectonic](https://tectonic-typesetting.github.io/) | `brew install tectonic` | [install guide](https://tectonic-typesetting.github.io/book/latest/installation/) |
| poppler (for `make verify`) | `brew install poppler` | `apt install poppler-utils` |
| Python 3.8+ | already installed | already installed |

No TeX Live installation needed: tectonic is a single binary and downloads what it needs the
first time it runs, after which builds work offline. No Python packages to install either.
On Windows, use WSL.

## Quick start

```bash
make check     # builds the example CV into build/ and checks it — see what you'll get
make new       # copies the example to mycv/cv.toml (ignored by git)
$EDITOR mycv/cv.toml
make check     # builds your CV and verifies it
```

Your PDFs appear in `build/`, named after you: `CV_Jane_Doe_EN.pdf`, `CV_Jane_Doe_ES.pdf`, …

## Writing your CV

`example/cv.toml` is the reference: every field is there, with comments. In short:

```toml
[settings]
languages = ["en", "es"]   # one PDF per language
pages = 1                  # make verify fails if the PDF has a different page count

[header]
name = "Jane Doe"
headline = { en = "Data Engineer", es = "Ingeniera de Datos" }
email = "jane.doe@example.com"
photo = "photo.png"        # optional

[summary]
en = "Data engineer with 6 years of experience…"
es = "Ingeniera de datos con 6 años de experiencia…"

[[experience]]
title = "Senior Data Engineer"   # written once = the same in every language
org = "Lumen Analytics"
start = "2022"
end = "present"                  # translated for you
bullets.en = ["Cut warehouse costs by 40%…"]
bullets.es = ["Redujo un 40% el coste del data warehouse…"]
```

- Any text is either written once, or once per language as `{ en = "…", es = "…" }`.
- Sections: `summary`, `skills`, `experience`, `education`, `projects`, `certifications`,
  `awards`, `languages` — use the ones you need, in the order you like (`settings.order`).
- Headings are built in for English, Spanish and Catalan. For another language, or a section
  of your own, add headings under `[labels.<code>]` — see the end of `example/cv.toml`.
- Mistakes are reported by field, before anything is typeset:
  ```
  mycv/cv.toml: experience[1].bullets: missing translation for "es"
  ```

## Commands

```bash
make           # build every language of your CV (mycv/cv.toml, or the example)
make new       # start your CV from the example
make verify    # check the built PDFs are machine-readable
make privacy   # check nothing personal is tracked by git
make check     # build + verify + privacy
make test      # renderer test fixtures
make clean     # delete build/
make DATA=path/to/other.toml   # build a different data file
```

## Check any CV in your browser

`web/` is an ATS checker for any CV (PDF today), built with this one or not. It shows what an
applicant tracking system would file, what would keep the CV out of recruiters' searches, and what
to fix first.

- **Nothing leaves the device.** The file is read in the browser tab, and the page forbids
  itself from opening any network connection (`connect-src 'none'`). Nothing is stored.
- **Layout checks are measured**, deterministically, and need no AI: columns, tables, contact
  details in page headers, text drawn as graphics, broken characters, abbreviated dates.
- **Content is reviewed by Chrome's built-in on-device model** (Gemini Nano), when the browser
  has it. Every AI result is labelled as such and checked against the CV, and the score comes
  from a published formula, not from the model.
- **Job match**: paste a posting to see a match summary, the hard filters recruiters apply, the
  posting's exact keywords your CV is missing (or words differently), and where to add each gap.
- **Chat with your CV**: a panel beside the report. Ask about the CV, its report or a posting
  ("am I right for this job?"): answers cite your CV, figures come from the page's own
  comparison, and rewrites can only reword what a line already says. Drop the edited version and
  the conversation carries on with what changed.

```bash
make web          # dev server on http://127.0.0.1:8000
make web-test     # all checker tests (needs Node ≥ 22 and tectonic for the fixture PDFs)
make web-build    # static bundle in web/dist (what CI deploys to GitHub Pages)
make web-eval     # prompt evaluation with the real model: open /eval.html
```

The design is in `specs/003-react-ats-checker/design/`, and the architecture is described in
`CLAUDE.md`.

## Keeping your CV under version control

`mycv/` is ignored by this repository, so it can be a repository of its own:

```bash
cd mycv && git init
```

Keep that one local, or push it only to a **private** remote.

## If you committed personal data

`make privacy` (also run in CI) fails when files from `mycv/` or any PDF are tracked. If that
happens before you push, `git rm --cached -r -- <path>` and amend the commit. If it was already
pushed to a public repository, deleting the file in a new commit is not enough — it stays in the
history, and GitHub keeps old commits reachable by their hash. Make the repository private
right away, then either delete and recreate it from a clean history or rewrite the history and
ask GitHub Support to purge cached views.

## How it fits together

```
example/cv.toml         fictional example data — the reference for every field
mycv/                   your data (ignored by git)
build/                  generated .tex, PDFs and verifier expectations (ignored)
scripts/render.py       cv.toml → one .tex per language
atscv.cls               the layout, tuned for clean text extraction
scripts/verify-cv.sh    text-layer checks, driven by your own data
scripts/check-privacy.sh  fails if anything personal is tracked
tests/fixtures/         edge cases for the renderer
web/                    the in-browser ATS checker (React + TypeScript)
specs/                  design specs (spec-kit)
```

The layout's constraints, and why each one exists, are documented in `atscv.cls` and
`CLAUDE.md`.

## Contributing

Changes are specified with [spec-kit](https://github.com/github/spec-kit) — see
`.specify/memory/constitution.md` for the project's principles and `specs/` for past features.
Run `make check && make test` (and `make web-test` for changes to `web/`) before opening a pull request; CI runs the same targets on the
example data. Never include real personal data in a pull request, fixtures included.

## License

MIT — see `LICENSE.md`. Originally derived from a template by Jan Vorisek /
LaTeXTemplates.com.
