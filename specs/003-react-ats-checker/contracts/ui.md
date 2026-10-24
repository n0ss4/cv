# Contract: screens, analysis state machine, transparency content

## Layout

One page, no router. A header holds the logo, the **Privacy status** chip, **About the AI**, the
**language switch** and the source link. The main area shows one of the screens below. The AI
log is a side drawer (a full-screen sheet on mobile) that can be opened at any time.

## Analysis state machine (`ui/app/analysis.ts`, a `useReducer`)

```
            ┌──────────────── drop / choose file (any state: cancels the current run) ─────────────┐
            ▼                                                                                       │
 idle ──► reading ──► measuring ──┬─► (engine available) ───────────────► extracting ──► reviewing ──► done
   ▲          │            │      ├─► (downloadable) ─► consent ─► downloading ─┘                     │
   │          ▼            ▼      └─► (no engine) ──────────────────────────────────► done(measured-only)
   │       failed      done(unreadable)                                                              │
   └──────────── Clear ◄──────────────── any ──── Cancel ──► cancelled                     matching ◄┘
```

The state carries: `file`, `steps[]` (`id`, `status: pending|running|done|failed|skipped`,
`detail`), `report?`, `previous?` (the last report, for rescan), `log[]`, `error?`, and
`engine { availability, progress }`. Every transition is a pure reducer case, covered by unit
tests.

Steps shown to the user, in order: **Read file** · **Check layout** (measured) · **Read contact
details** · **Read experience** · **Read education & skills** · **Review** (AI). Steps that will
not run are shown as *skipped*, with the reason (for example "No on-device AI in this browser").

## Screens (each is a frame in the design file)

| # | Screen | Key content |
|---|---|---|
| 1 | Start: AI ready | hero ("See your CV the way an ATS does"), drop zone ("We read: PDF · up to 10 MB"), privacy summary (3 lines), "What we check" (6 categories) |
| 2 | Start: AI needs download | same + a notice: "First run: your browser downloads its AI model once (≈ size). It contains no CV data." |
| 3 | Start: no AI | same + a notice: "This browser has no on-device AI. You'll still get the ATS view and the layout checks." with requirements behind a link |
| 4 | Consent dialog | what will be downloaded, by whom (the browser), disk space, that no CV data is sent; [Download & continue] [Layout checks only] |
| 5 | Analysing | step list with live detail ("Reading page 2 of 2", "AI is reading lines 1–20"), "See what the AI is doing" → log, Cancel |
| 6 | Results: Overview | verdict + score ring + category bars; **Fix these first** (≤ 5 FindingCards); the rescan diff banner when a previous report exists; tabs: Overview · All checks · Profile · ATS view · Job match |
| 7 | Results: All checks | by category: needs attention (expanded) / passed (collapsed) / not applicable |
| 8 | Results: Profile | fields with provenance badges, "Not found" states, a 🔎 "searchable" marker |
| 9 | Results: ATS view | numbered lines, highlighted evidence, Copy |
| 10 | Results: Job match | posting textarea + title, requirements as matched/partial/missing chips with evidence |
| 11 | Privacy details panel | where each part runs (table-free list: Reading the file → this tab; AI model → this device; Results → this tab's memory, cleared when you close it); enforcement (CSP, quoted); the model-download exception; "Check it yourself" steps (DevTools → Network: no requests after load) |
| 12 | About the AI panel | engine/model, "runs on this device", what it does (extracts and reviews content), what it doesn't (it does not compute your score; layout checks are measured, not AI), limits (small model, may miss or invent things, evidence is checked), languages and the CV language's quality note, prompt version + "View prompts" |
| 13 | AI log drawer | per task: tool calls (name, args, result preview, ms), retries, failures |
| 14 | Error | plain cause (unsupported type: "We read: PDF"; too large; password-protected; damaged), and retry |
| 15 | Results: measured only | same as 6, but the verdict reads "Layout checked · AI review unavailable" and there's no score |

## Components (each is a component in the design file)

`PrivacyStatus` (states: protected / downloading-model / error), `DropZone` (idle / hover /
error / disabled), `StepList` + `Step` (pending / running / done / failed / skipped),
`VerdictCard`, `ScoreRing`, `CategoryBar`, `FindingCard` (severity × provenance, collapsed /
expanded), `ProvenanceBadge` (measured / ai-verified / ai-unverified), `Notice` (info / warning),
`Tabs`, `ProfileField` (found / not-found / unverified), `AtsLine` (normal / highlighted),
`RequirementChip` (matched / partial / missing), `RescanBanner`, `Drawer`, `Dialog`, `Button`
(primary / secondary / ghost).

## Provenance badge copy (en / es)

| Kind | Label | Explanation (tooltip / sr-only) |
|---|---|---|
| measured | Measured · Medido | Read directly from your file by this page, without AI. · Leído directamente de tu archivo por esta página, sin IA. |
| ai-verified | AI · verified · IA · verificado | Found by the on-device AI; the quoted text was checked against your CV. · Encontrado por la IA del dispositivo; el texto citado se comprobó en tu CV. |
| ai-unverified | AI · unverified · IA · sin verificar | Found by the on-device AI, but its quote isn't on the line it cites. Treat with care. · Encontrado por la IA del dispositivo, pero su cita no está en la línea indicada. Tómalo con cautela. |

## Accessibility

- Live region (`aria-live="polite"`) announces step changes. Focus moves to the verdict when
  results arrive.
- All interactive elements are reachable by keyboard. Dialog and drawer trap focus and close on
  Esc.
- Colour is never the only signal: severity and provenance also have an icon and text.
- `prefers-reduced-motion` disables the spinner and ring animations.
- No inline `style` attributes (CSP, research R4).
