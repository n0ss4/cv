# Implementation Plan: Ask about your CV (chat)

**Branch**: `005-cv-chat` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

A sixth results tab, **Ask**. Each question is one run of a new orchestrator task, `ask`, through
003's tool loop (at most 4 tool calls). Its context is the compact report and profile, the last
4 exchanges and the question. The answer is schema-constrained: text, citations, rewrites and an
out-of-scope flag. The page then:
- checks the citations (003 verification);
- passes each rewrite through 004's phrasing guard;
- replaces out-of-scope answers with its own refusal text.

The chat can't touch the report. Tool results are now passed to the model framed as document
data, for every task, which is the prompt-injection defence.

## Technical Context

TypeScript 7 / React 19 as 003; **no new dependencies**. Vitest + jsdom + axe for tests. On-device
only, in-memory only, CSP unchanged, en/es, WCAG 2.1 AA.

## Constitution Check

I ✅ (fictional fixtures) · II ✅ (no new network or storage; the conversation is in memory) ·
III/IV/VI ✅ (not affected) · V ✅ (no dependencies). Re-checked after design: ✅.

## Project Structure

```text
specs/005-cv-chat/  plan.md research.md data-model.md contracts/chat.md quickstart.md tasks.md
web/src/domain/chat/model.ts            ChatMessage, Citation, Rewrite
web/src/application/prompts/            ask task + ASK schema; system prompt data rule; VERSION 3.2.0
web/src/application/agent/orchestrator  tool results framed as document data (all tasks)
web/src/application/usecases/askCv.ts   run → verify citations → guard rewrites → refusal
web/src/ui/app/analysis.ts              chat state + actions (cleared by start/clear)
web/src/ui/components/chat.tsx          Ask tab: intro, starters, log, composer, status, Stop
```
