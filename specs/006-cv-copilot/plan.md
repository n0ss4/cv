# Implementation Plan: Chat with your CV (one assistant, beside the report)

**Branch**: `006-cv-copilot` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

The Ask tab (005) becomes a **chat panel** that lives beside the results. On wide screens it is
a sticky right-hand column; on narrow ones it is a bottom sheet opened by a floating button. The
panel owns the conversation and the **posting in context**:
- adding a posting from the panel runs 004's `compareJob`, the same path as the Job match tab;
- both entry points set one shared context.

The `ask` task gains:
- a compact job match in its context, and a scope that includes the posting;
- a `cards` field (fit / knockouts / keywords / gaps), which the page renders from the computed
  match;
- a `needs_posting` flag, which shows the "Add a posting" action.

Rewrites are guarded against their source line plus the posting terms the CV already contains.
Withheld additions that the posting asks for get a specific message.

The conversation survives a new file (the edit loop). When the next analysis ends, the page adds
a version message (score and findings before → after), re-runs the posting comparison, and adds
a job message with the match % before → after. Citations from older versions are shown as
"previous version".

## Technical Context

TypeScript 7 / React 19 / Tailwind 4 as 003; **no new dependencies**. Vitest + jsdom + axe.
On-device only, in-memory only, CSP unchanged, en/es, WCAG 2.1 AA. `matchMedia` decides between
panel and sheet, with the panel as the default where it is missing (jsdom).

## Constitution Check

I ✅ (fictional fixtures) · II ✅ (no network or storage; conversation and posting live in memory,
"Clear everything" removes them) · III ✅ (cards are page computations; model text is labelled AI)
· IV/VI ✅ (not affected) · V ✅ (no dependencies). Re-checked after design: ✅.

## Project Structure

```text
specs/006-cv-copilot/  plan.md research.md data-model.md contracts/chat.md quickstart.md tasks.md
web/src/domain/chat/model.ts            + page messages, cards, reportId, postingMissing on rewrites
web/src/domain/chat/context.ts          compactJob(), postingTermsInCv()  (pure)
web/src/application/prompts/            ask brief with job context; ASK + cards, needs_posting; 3.3.0
web/src/application/usecases/askCv.ts   job context, card filtering, posting-aware guard
web/src/ui/app/analysis.ts              chat survives `start`; posting; page messages on job/done
web/src/ui/app/AnalysisProvider.tsx     re-compare the posting after a new version; newConversation
web/src/ui/components/chat.tsx          ChatPanel (panel/sheet body), context bar, posting form, cards
web/src/ui/components/base.tsx          Modal variant "sheet"; useWide() media hook
web/src/ui/components/job.tsx           exports the rows the cards reuse
web/src/ui/screens/screens.tsx          results grid with the aside; no Ask tab; FAB + sheet
```
