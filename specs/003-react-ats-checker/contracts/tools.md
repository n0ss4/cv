# Contract: document tools

Unchanged from `specs/002-ats-checker-web/contracts/tools.md`: the five tools (`doc_info`,
`outline`, `read_lines`, `search`, `layout_facts`), the line references `p<page>:<line>`, the
limits (8 calls per task, 40 lines per read, 20 search hits), errors as `{ error }`, and the
turn protocol. Source: `web/src/application/tools/`.

## Changes in 003

1. **Applicability**: every `layout_facts` member is `{ applicable, value }`. The model receives
   non-applicable facts as `"not applicable for <format>"`, so it cannot read an empty list as
   "no problem".
2. **New facts**, all data and no judgements:

| Fact | Value | Applicable when | How measured (PDF) |
|---|---|---|---|
| `table_grid` | `[{ rows, cols, first_ref }]` | positions, or structure | ≥ 3 consecutive geometric lines whose ≥ 3 segments start at the same x positions (± 2 pt) |
| `graphics_pages` | `[{ page, images, paths, chars }]` pages with any graphics | graphics | operator list counts per page |
| `shape_rows` | `[{ ref, shapes }]` lines with ≥ 3 small path shapes on their baseline band | graphics + positions | path ops bucketed by y, joined to geometric lines |
| `ambiguous_dates` | `[{ ref, text }]` | always | regex: `'\d{2}\b`, `\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2}\b`, a month followed by a 2-digit year |
| `unlabelled_contact` | `[{ ref, kind, marker }]` | always | a line holding an email/phone, with no label word (`email`, `e-mail`, `correo`, `mail`, `phone`, `tel`, `teléfono`, `móvil`, `mobile`) and a private-use or symbol glyph within 3 characters before it |

3. Existing facts' applicability: `side_by_side_blocks` and `right_edge_dates` need positions;
   `header_zone`/`footer_zone` need positions **or** structure (structural formats fill them
   from header/footer parts); the rest are text-only and always applicable.

4. `doc_info` adds `format` and `capabilities`, so the model knows what it is reading.
