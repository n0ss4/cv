# Contract: `.expect` sidecar (renderer → verifier)

UTF-8 text, one `key=value` per line, value runs to end of line, no quoting. The verifier reads
it with `while IFS='=' read -r key value` and MUST NOT `source` or `eval` it.

| Key | Meaning | Optional |
|---|---|---|
| `name` | header name exactly as printed | no |
| `email` | email as printed | yes |
| `phone` | phone as printed | yes |
| `pages` | expected page count | no |
| `heading` | one per printed section, upper-cased as rendered, in document order; repeatable. Reading order = name line, then each heading on a later line | no |
| `entries` | number of `\cventry` with dates | no |
| `chars` | characters of user text printed; the text layer must yield more than half | no |

Values never contain newlines (the renderer collapses whitespace).
