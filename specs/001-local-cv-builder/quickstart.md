# Quickstart validation: Local, Privacy-First CV Builder

Prerequisites: tectonic, python3 ≥ 3.8, poppler (`pdftotext`, `pdfinfo`).

## V1 — Example builds out of the box (US2, SC-002)

```bash
make check
```

Expect: `build/CV_Jane_Doe_{EN,ES,CA}.pdf`, one page each, all verification and privacy checks pass.

## V2 — Start your own CV (US2)

```bash
make new            # creates mycv/cv.toml + mycv/photo.png (from a fresh copy)
make new            # second run refuses: mycv/cv.toml already exists
$EDITOR mycv/cv.toml
make check          # now builds from mycv/, not the example
```

## V3 — Nothing personal is committable (US3, SC-004)

```bash
git add . && git status --short   # no mycv/ or build/ paths listed
git add -f mycv/cv.toml && make privacy   # fails, names mycv/cv.toml
git rm --cached mycv/cv.toml
```

## V4 — Errors are readable (US2 scenario 5)

```bash
make test   # invalid fixtures fail with "FILE: field.path: message"
```

## V5 — Owner's CV rebuilt locally (US1, SC-003)

```bash
make check   # with the owner's mycv/cv.toml
pdftotext build/CV_<Owner>_EN.pdf - | diff - mycv/archive/CV_<Owner>_EN.txt
```

Expect: 2 pages per language; text layer identical to the last published version.

## V6 — Public repository is clean (US1, SC-001)

After the remote cleanup, a fresh clone plus `gh release list` and a history search for the
owner's identifiers return nothing.
