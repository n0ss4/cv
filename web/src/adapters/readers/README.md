# Document readers

One reader per file format, each implementing `DocumentReader`
(`src/application/ports/DocumentReader.ts`, contract in
`specs/003-react-ats-checker/contracts/ports.md`). A reader turns bytes into the format-neutral
`Document` and declares what it can provide:

| Capability | Means | PDF | Word (planned) |
|---|---|---|---|
| `positions` | text items have x/y | ✓ | — |
| `pages` | real pages with header/footer zones | ✓ | — |
| `graphics` | image and vector counts per page | ✓ | — |
| `structure` | header/footer text, tables, text boxes supplied directly | — | ✓ |

A layout fact the format can't provide is reported as *not applicable*, to the user and to the
model, and its measured rule doesn't fire. A missing capability therefore never reads as "no
problem".

## Adding a format

1. `src/adapters/readers/<format>/<Format>Reader.ts`, implementing `DocumentReader`. It must
   never touch the network, and must throw `ReadError` codes for bad input.
2. One line in `src/infrastructure/container.ts`: `.register(new <Format>Reader(...))`.
3. Fixtures and a reader test in `tests/adapters/`.

The drop zone's accept list, the "We read: …" text, the tools, prompts, rules and scoring need
no change. `tests/application/formats.test.ts` proves this with a test-only plain-text reader.

## Notes for Word (.docx)

A `.docx` is a ZIP of XML parts. Body text is in `word/document.xml`, headers and footers in
`word/header*.xml` / `footer*.xml` (so header/footer facts become exact), tables are `w:tbl`,
text boxes `w:txbxContent`, images `w:drawing`. The browser's built-in
`DecompressionStream("deflate-raw")` and `DOMParser` are enough: no dependency is needed. Declare
`{ positions: false, pages: false, graphics: false, structure: true }`, and fill
`Document.structure` and one page of parser-order `lines`.
