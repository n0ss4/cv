# Contract: document tools

The model never sees the PDF. It sees the document only through these tools, which the
orchestrator executes over the locally extracted text (`web/js/tools.js`). Tools return **data,
never judgements**: they say "page 1 has two side-by-side text blocks on 14 lines", not "this CV
uses columns, which is bad". Interpreting is the model's job.

Every call and result is appended to the audit log shown in the UI (FR-006).

Line references are `p<page>:<line>` (1-based), e.g. `p1:12`, into the **ATS view** — the text in
the order a parser reads it. All tools use the same numbering.

| Tool | Arguments | Returns |
|---|---|---|
| `doc_info` | — | `{ file, pages, chars, words, text_layer: "ok" \| "none" \| "partial", empty_pages: [n] }` |
| `outline` | — | per page: `[{ ref, text }]` for lines that *look* like headings typographically — short (≤ 6 words), and larger, bolder or upper-case compared with body text; plus `{ lines: n }` per page. No meaning is attached. |
| `read_lines` | `{ page, from, to }` (max 40 lines per call) | `[{ ref, text }]` |
| `search` | `{ query }` (case- and accent-insensitive, max 20 hits) | `[{ ref, text }]` |
| `layout_facts` | `{ page? }` | `{ side_by_side_blocks: { lines, example_refs }, header_zone: [{ref,text}], footer_zone: [{ref,text}], bullet_only_lines: [ref], date_only_lines: [ref], right_edge_dates: [ref], hyphen_breaks: [ref], unusual_characters: { count, ratio, examples } }` |

Limits: at most 8 tool calls per task; `read_lines` results are truncated to 40 lines; arguments
outside the document are answered with `{ "error": "..." }` so the model can correct itself.

## Turn protocol (no native tool calling)

The Prompt API has no tool calling, so each model turn is constrained by this JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "next": { "type": "string", "enum": ["doc_info", "outline", "read_lines", "search", "layout_facts", "answer"] },
    "page": { "type": "integer", "minimum": 1 },
    "from": { "type": "integer", "minimum": 1 },
    "to": { "type": "integer", "minimum": 1 },
    "query": { "type": "string", "maxLength": 60 }
  },
  "required": ["next"],
  "additionalProperties": false
}
```

When `next` is `answer`, the orchestrator sends the task's answer instruction and constrains the
following turn with the task's output schema (`schemas.md`). Before the first turn the
orchestrator runs `doc_info` and `outline` on the model's behalf and includes the results, which
saves two of Nano's slow turns; both appear in the audit log like any other call.
