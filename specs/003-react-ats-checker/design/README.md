# Design: ATS Check 2

`ats-checker-v6.fig` (v3 added the Job match frame of spec 004, v4 the Ask frame of spec 005, v5 the chat panel of spec 006, v6 redraws it docked after the design review and adds the mobile chat) was made with grafta and opens in Figma. The implementation follows it.
`web/src/ui/styles/tokens.css` mirrors the **Theme** variable collection one-to-one, so a token
renamed here is renamed there.

## Direction

The 002 teal identity evolves, with more space. One new rule carries the transparency goal:
**colour says who produced a result.**

- **Teal** (`accent`) means privacy and anything *measured* by the page itself.
- **Violet** (`ai`) means anything the *on-device AI* produced. Users can tell the model's
  opinions from facts read from their file at a glance.
- Severity colours (`fail` / `warn` / `pass`) are only for problems and scores, never for
  provenance.

## Pages and frames

| Page | Frame | Covers (contracts/ui.md #) |
|---|---|---|
| Screens — Desktop | 1 Start — AI ready | 1: hero, drop zone, 3-point privacy summary, "What we check" with provenance per category |
| | 3 Start — no on-device AI | 3: warning notice, AI categories dimmed, measured ones active |
| | 4 Consent — model download | 4: who downloads, size, "your CV is not part of it", two choices |
| | 5 Analysing + AI log | 5 + 13: step list (done / running / pending, with provenance) and the live log drawer |
| | 6 Results — Overview | 6: rescan banner, verdict + score ring (capped, with explanation), category bars, tabs, "Fix these first" showing all three provenance states |
| | 6 Results — Overview (Dark) | the same frame in the Dark mode |
| | 10 Results — Job match (spec 004) | summary card (match %, verdict, required/preferred bars, formula), "fix first for this job" (failed knock-out, missing requirement with a violet suggestion card and Copy), exact keywords (different wording) |
| | 14 Results — Chat panel (docked) (spec 006) | one 1440×900 screen. Report column (1008 px, Job match tab named "Job match · 43%") and, separated by a 1 px rule, the chat docked under the header at full height: header (avatar, "Chat with your CV", "Runs on your device", new conversation, collapse); context (CV with score pill; posting with % pill, Change, Remove); conversation (page message with Measured badge, user bubble, AI answer with avatar and verified badge, fit card rendered by the page, "Based on" citation); footer (two follow-up suggestions, chat composer with the send button inside, memory note) |
| | 9 Results — ATS view | 9: parser-order lines with refs, highlighted evidence, Copy |
| | 11 Privacy details | 11: where each part runs, enforcement (CSP quoted), the one exception, "check it yourself" |
| | 12 About the AI | 12: model card, what it does / doesn't, "it can be wrong" + badge legend, language quality note, prompts link |
| Screens — Mobile | M1 Start (390) | stacked start in the no-AI state (phones have no built-in model) |
| | M6 Results (390) | verdict, scrollable tab pills, fix-first card, floating "Chat with your CV" button (v6) |
| | M7 Chat — full screen (390×844) | the same chat panel as frame 14 as a full-screen dialog; the header's second action closes it (✕) |
| Components | ProvenanceBadge (Kind = Measured / AI verified / AI unverified), PrivacyStatus, Header, Header/Mobile | |

Screens 2 (needs download), 7 (all checks), 8 (profile), 14 (error) and 15
(measured-only results) reuse the same components and layouts. Their exact content is specified
in `contracts/ui.md`, so they have no separate frames.

## Tokens (Theme collection)

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #F6F8F7 | #0B1211 | page |
| surface | #FFFFFF | #121B19 | cards, header |
| surface-muted | #EEF4F2 | #182321 | tracks, chips, log entries |
| border | #D9E4E1 | #26332F | card borders |
| text | #0F1F1C | #E4ECEA | body |
| text-muted | #52625E | #9BB0AA | secondary text (≥ 4.5:1 on bg and surface) |
| accent | #115E59 | #5EC4B6 | brand, privacy, measured, primary button |
| accent-soft | #E3F2EF | #10302C | privacy chip, measured badge |
| on-accent | #FFFFFF | #0B1211 | text on accent |
| ai | #5B4BB7 | #B3A7F7 | AI provenance, AI log calls |
| ai-soft | #EFECFB | #221D3D | AI badge, running step |
| pass / pass-soft | #1F7A4D / #E7F5EE | #4CC38A / #143326 | ≥ 90 scores, done steps, improvement banner |
| warn / warn-soft | #9A5B00 / #FFF4DE | #F0B44C / #3A2C10 | major, needs-work, no-AI notice |
| fail / fail-soft | #B42318 / #FDECEA | #FF8A80 / #3D1A17 | critical, not-ready |
| highlight | #FFE8A3 | #4A3B12 | evidence lines and quotes |

## Type, spacing, shape

- Type: Inter in the design. The page uses the system UI stack, because a web font would be a
  download (no third-party origins, FR-004). Monospace (refs, CSP, log calls) uses
  `ui-monospace, SFMono-Regular, Menlo, monospace`; JetBrains Mono in the file is only a stand-in.
- Scale: 46/48 hero (30 on mobile) · 28 page title · 22–24 section · 17–20 card title ·
  15 body · 13–14 secondary · 11–12 chips (bold caps for severity).
- Spacing: a 4 px grid. Cards use 16–24 padding, stacks 8–28 gaps, page gutters 40 desktop and
  16 mobile, a content width of 1120 for results and 720 for start.
- Radius: 6 chips · 10 buttons · 14–20 cards and dialogs · pills fully round.
- Icons: Lucide paths, inlined as SVG (`ruler` = measured, `sparkles` = AI, `shield-check` =
  privacy).

## Component rules

- **ProvenanceBadge** appears on every finding, profile field and AI step. Its tooltip and
  screen-reader text follow `contracts/ui.md#provenance-badge-copy`. The unverified variant is
  outlined, never filled, and is visually weaker on purpose.
- **PrivacyStatus** is always in the header. While the browser downloads the model, its label
  becomes "Browser is downloading its AI model · your CV is not part of it".
- **FindingCard** has a left stripe in the severity colour, a meta row (severity chip, category,
  badge), the title, why, "Fix:", the evidence quote with its ref, and "Show in ATS view". An
  unverified quote gets an outlined box and "not found on this line".
- The score ring's arc is an SVG `stroke-dasharray` from a class or attribute, never an inline
  `style` (CSP, research R4).

Known grafta limitations: its offline renderer does not propagate a frame's Dark mode into
component instances (Figma does), and it does not draw list markers. The text layers carry their
list settings.
