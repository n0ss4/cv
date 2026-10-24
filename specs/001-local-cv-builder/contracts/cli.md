# Contract: command-line interface

## make targets

| Target | Behaviour | Exit |
|---|---|---|
| `make` / `make all` | render + compile every declared language from `$(DATA)` into `build/` | non-zero on any data or LaTeX error |
| `make new` | copy `example/cv.toml` and `example/photo.png` into `mycv/`; refuse if `mycv/cv.toml` exists | 1 if it exists |
| `make verify` | run `scripts/verify-cv.sh` on every PDF in `build/` that has an `.expect` | 1 on any failed check |
| `make privacy` | run `scripts/check-privacy.sh` | 1 if personal data or PDFs are tracked |
| `make test` | `tests/run.sh`: build each fixture in `tests/fixtures/` into `build/test/`; valid ones must verify and contain their `# expect-text:` lines, `invalid-*` must fail before LaTeX with their `# expect-error:` lines | 1 on mismatch |
| `make check` | `all verify privacy` | |
| `make clean` | remove `build/` | 0 |

`DATA` defaults to `mycv/cv.toml` when it exists, else `example/cv.toml`. `OUT` defaults to `build`.

## scripts/render.py

```
python3 scripts/render.py DATA --out DIR
```

- Writes `<base>_<LANG>.tex` and `<base>_<LANG>.expect` per language into `DIR`.
- Prints one generated `.tex` path per line on stdout (consumed by the Makefile).
- On invalid data: prints `FILE: field.path: message` lines to stderr, writes nothing, exit 1.

## scripts/verify-cv.sh

```
scripts/verify-cv.sh [PDF...]     # default: build/*.pdf
```

Reads `<same base>.expect` next to each PDF. Missing `.expect` → that PDF fails.

## scripts/check-privacy.sh

No arguments. Uses `git ls-files`. Fails listing each offending path and the command to untrack
it (`git rm --cached <path>`).
