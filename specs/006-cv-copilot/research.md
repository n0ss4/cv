# Research: Chat with your CV

## R1. Panel beside the report, sheet on mobile

- **Decision**: CSS grid `minmax(0,1fr) 360px` (400px at ≥ 1280) at ≥ 1024 px. The aside is
  sticky, with the full viewport height minus the header; its log scrolls on its own. Below
  1024 px a floating button opens the same panel body in a bottom-sheet modal (88dvh), and a
  citation closes the sheet before switching the report tab. The panel can be hidden on desktop
  (kept in memory only).
- **Rationale**: the owner's choice. Keeping the report and the chat visible together is what
  makes "show me the line" useful. The pattern is the same as assistant side panels in editors
  and IDEs.
- **Alternatives**: a full-screen chat (rejected by the owner); a resizable splitter (more code,
  no evidence it is needed).

## R2. Figures come from the page (cards)

- **Decision**: the model may request up to 2 card kinds, and the page renders them from the
  `JobMatch` snapshot. The message stores a reference to that snapshot, so a later re-comparison
  doesn't change an old answer's cards.
- **Rationale**: a 3B on-device model misreports numbers. 004 computes them, so the chat should
  show them, not retell them.
- **Alternatives**: validate numbers in the answer text (fragile: units, rounding, wording).

## R3. Tailoring without inventing

- **Decision**: the guard allows the source line, plus the posting terms the CV already contains
  in some form (job keywords with status exact or variant: term and CV term). Added terms that
  are posting keywords with status *missing* produce a specific message: "the posting asks for X;
  your CV doesn't mention it — add it yourself only if it's true".
- **Rationale**: using the posting's exact name for a skill the CV has is the most valuable ATS
  edit (004 R3). Adding a skill the CV doesn't have is the most harmful thing an assistant could
  do.

## R4. The edit loop

- **Decision**: on `start`, the chat (messages and posting) is kept. When `done` arrives with a
  conversation and a previous report, a version message is added with `compareRescan`'s figures.
  The provider then re-runs `compareJob` with the posting in context, and `jobDone` adds the job
  message with before → after. Each assistant message records `reportId`; a message whose id is
  not the current report's shows "previous version" citations without links.
- **Rationale**: the user's loop is: ask, edit, re-drop, see. Losing the conversation or
  re-pasting the posting each time breaks it.
- **Alternatives**: matching versions by file name (users rename; a session is one task anyway).

## R5. Prompt size

- **Decision**: `compactJob` keeps the title, summary, at most 6 knock-outs, 15 keywords and 10
  requirements, with text cut to 90 characters: about 2,000 characters. The report summary stays
  as in 005.
- **Rationale**: it fits Gemini Nano's context with the 4-exchange memory and the tool loop.

## R6. Design review: docked, full-height panel

- **Decision**: replace the floating card with a panel docked to the window. It sticks at
  `top-16` (under the sticky header) with height `100dvh − 4rem` and a left border; only its
  conversation scrolls. Width is `clamp(360px, 30vw, 440px)`. The report column is a CSS
  container: its summary row goes side by side only from 48rem (`@3xl`), so the chat never
  covers it.

  Inside, one type scale: 14 px content, 12–13 px meta. The composer is chat-style: an
  auto-growing textarea (`field-sizing: content`, Chrome-only like the AI) with the send button
  inside. Narrow screens get a full-screen dialog rather than a sheet: on-screen keyboards leave
  little room for a sheet.
- **How it was checked**: viewport-only screenshots (what the user sees without scrolling) at
  1440×900, 1280×800, 1024×768 and 390×844, light and dark, English and Spanish. The checks used
  `web/design.html`, a dev-only page that runs the real app with a scripted model so that chat
  states can be seen without Gemini Nano.
- **Rejected**: horizontal-scroll suggestion chips (hidden options, no visible affordance on
  desktop); a bottom sheet on mobile; a floating card with margins (it wasted space and broke
  the height maths).
