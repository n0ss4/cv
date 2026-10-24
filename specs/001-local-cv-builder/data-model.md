# Data Model: CV data file (`cv.toml`)

Notation: **L** = localisable — a string, or a table `{ en = "...", es = "..." }` with one key per
declared language. **L[]** = list of L, or a table of lists keyed by language.

## settings (table, optional)

| Field | Type | Default | Rule |
|---|---|---|---|
| `languages` | list of codes | `["en"]` | non-empty; lower-case codes; one PDF each |
| `font_size` | int | `10` | 9, 10, 11 |
| `pages` | int | `2` | expected page count, checked by verify |
| `accent` | hex string | `"115E59"` | 6 hex digits, no `#` |
| `output` | string | `CV_<name>` transliterated to ASCII | file base name; `[A-Za-z0-9_-]` only |
| `order` | list of section keys | see below | each key must exist in the file |

Default `order`: `summary, skills, experience, education, projects, certifications, awards,
languages` — keys absent from the file are skipped.

## header (table, required)

| Field | Type | Rule |
|---|---|---|
| `name` | string | required, non-empty |
| `headline` | L | required |
| `location` | L | optional |
| `phone` | string | optional; printed as written |
| `email` | string | optional; linked as `mailto:` |
| `photo` | path | optional; relative to the data file; must exist; jpg/png |
| `links` | list of `{ text, url }` | optional; `text` is L |

Line 1 of the contact block: location, phone, email. Line 2: links.

## Sections

A section is a top-level key named in `order`. Its shape decides how it renders:

| Shape | Recognised by | Renders as |
|---|---|---|
| Text | value is L, or a table holding only `text` (e.g. `summary`) | a paragraph |
| Skills | array of tables with `keywords` | `\cvskill{label}{k1, k2, …}` |
| Entries | array of tables with `title` | `\cventry` + `\cvitem` bullets |
| Lines | array of tables with `label` | `\cvline{label}{value}` |

- **Skill group**: `label` L (required), `keywords` L[] or L (comma-joined if a list).
- **Entry**: `title` L (required), `org` string (required), `location` L (optional),
  `start` string, `end` string or `"present"` (localised), `bullets` L[] (optional).
  Dates render as `start - end`, or `start` alone.
- **Line**: `label` L (required), `value` L (required).

An array mixing shapes is an error. Unknown keys in `[settings]` and `[header]` are errors (they
are usually a section written below a table header by mistake).

## labels (table, optional)

`[labels.<lang>]` overrides or supplies headings (`summary`, `skills`, …, any custom section key)
and `present`. Built-in labels exist for `en`, `es`, `ca`. A section with no heading in a
declared language is an error.

## Validation errors

Every error names the data file, the dotted field path, and the problem, e.g.

```
mycv/cv.toml: experience[2].bullets[0]: missing translation for "ca"
mycv/cv.toml: header.photo: file not found: mycv/me.jpg
```

## Derived artefacts

For each language: `build/<output>_<LANG>.tex`, `build/<output>_<LANG>.expect`,
`build/<output>_<LANG>.pdf`. See [contracts/expect-format.md](contracts/expect-format.md).
