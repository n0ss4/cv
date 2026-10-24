# Design: ATS Check

`ats-checker.fig` — made with grafta, opens in Figma. Implementation follows it; CSS custom
properties in `web/styles.css` mirror the **Theme** variable collection one-to-one.

## Pages and frames

| Frame | State |
|---|---|
| Desktop / 1 Upload | idle: hero, drop zone, privacy note, what is checked |
| Desktop / 2 Analysing | drop zone becomes a progress state ("Reading …, page n of m") |
| Desktop / 3 Results — Checks | verdict card + score ring, top fixes; checks grouped "needs attention" / "passed" |
| Desktop / 4 Results — ATS view | extracted text with line numbers, affected lines highlighted, copy button |
| Desktop / 5 Results — Job match | pasted posting, match bar, missing / found keyword chips |
| Desktop / 6 Error | drop zone in error state with plain-language cause and retry |
| Desktop / 3 Results — Checks (Dark) | same frame in the Dark mode of the Theme collection |
| Mobile / 1 Upload | 390 px, stacked |
| Mobile / 2 Results | verdict card, tabs, checks as an accordion (fail expanded) |

Component page: **Check** (variants Status = Fail / Warn / Pass).

## Tokens (Theme collection, Light / Dark)

| Token | Light | Dark |
|---|---|---|
| bg | #F7FAF9 | #0E1513 |
| surface | #FFFFFF | #16201E |
| surface-muted | #F0F6F5 | #1C2A27 |
| border | #D5E3E0 | #2A3A37 |
| text | #10201D | #E6EEEC |
| text-muted | #4F5E59 | #9FB2AD |
| accent | #115E59 | #5EC4B6 |
| on-accent | #FFFFFF | #0E1513 |
| pass / pass-bg | #1F7A4D / #E7F5EE | #4CC38A / #143326 |
| warn / warn-bg | #9A5B00 / #FFF4DE | #F0B44C / #3A2C10 |
| fail / fail-bg | #B42318 / #FDECEA | #FF8A80 / #3D1A17 |
| highlight | #FFE8A3 | #4A3B12 |

Accent `#115E59` is the CV class's own heading colour, so the checker and the builder read as
one project. Type: Inter in the design; the page uses the system UI stack (no web font download,
consistent with the no-network rule). Icons: Lucide paths, inlined as SVG.

Known grafta limitation: its offline renderer does not propagate a frame's Dark mode into
component instances; Figma does.
