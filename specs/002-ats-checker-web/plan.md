# Implementation Plan: In-Browser ATS Checker (on-device AI)

**Branch**: `002-ats-checker-web` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

## Summary

A static page where a CV PDF is read locally with pdf.js and reviewed by Chrome's built-in,
on-device model (Gemini Nano, Prompt API). The model works as an agent with five read-only tools
over the document; precise, versioned prompts and JSON schemas define what it must extract (an
ATS-style profile) and how it must review it (a closed catalogue of findings). The orchestrator
verifies every reference against the document and derives the score transparently from the
findings. Browsers without built-in AI get a clear notice and the ATS view. Tailwind CSS,
CSP-enforced zero network, design in grafta.

## Technical Context

**Language/Version**: HTML, CSS (Tailwind v4.3.3, prebuilt), JavaScript ES2022 modules; no bundler

**Primary Dependencies**: Chrome Prompt API (browser-provided); pdfjs-dist 5.7.284 (vendored).
Build/dev only: Tailwind standalone CLI (checksum-pinned), Node ≥ 22 for tests, tectonic for
fixture PDFs

**Storage**: none

**Testing**: Node — tools/verification/scoring on real fixture PDFs, orchestrator with a scripted
fake model, static CSP/i18n tests. Browser — `eval.html` against the real model

**Target Platform**: desktop Chrome 148+ with built-in AI for the review; every modern browser for
the notice and ATS view

**Performance Goals**: review of a 2-page CV < 60 s on supported hardware (model present)

**Constraints**: CSP `connect-src 'none'`; Prompt API unavailable in workers (orchestrator runs on
the main thread, yields between turns); small context window read at runtime

**Scale/Scope**: 1 CV at a time, ≤ 10 pages, ≤ 10 MB; 4–6 model tasks per analysis

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| I. Privacy by Default | No CV stored or committed; fixtures synthetic | PASS |
| II. Local-First | Parsing and inference on device; CSP blocks requests. The model download is done by the browser, once, and carries no user data — amendment 1.2.0 says so explicitly | PASS after amendment |
| III. ATS-Readable Output | Findings catalogue encodes the builder's own defect classes | PASS |
| V. Minimal Dependencies | Adds no shipped dependency beyond 1.1.0 (pdf.js); Tailwind CLI is build-time like tectonic — amendment 1.2.0 | PASS after amendment |
| VI. Simplicity | No framework, no bundler; prompts are plain modules | PASS |

## Project Structure

```text
specs/002-ats-checker-web/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/tools.md, schemas.md, findings.md
└── design/ats-checker.fig + README.md

web/
├── index.html, eval.html, favicon.svg
├── src/tailwind.css → styles.css (built, committed)
├── js/
│   ├── app.js            UI state machine, rendering
│   ├── extract.js        pdf.js → Document
│   ├── lines.js          parser-order lines + geometry
│   ├── tools.js          the five tools + layout facts (data only)
│   ├── ai.js             Prompt API wrapper: support detection, download, sessions
│   ├── agent.js          tool loop, task runner, retries, limits
│   ├── verify.js         reference/quote verification
│   ├── report.js         catalogue lookup, scoring, verdict
│   ├── i18n.js           UI strings (en/es)
│   └── prompts/
│       ├── system.js     shared system prompt
│       ├── tasks.js      one prompt per task, with few-shot examples
│       ├── schemas.js    JSON Schemas (source of truth for contracts/schemas.md)
│       └── findings.js   catalogue (source of truth for contracts/findings.md)
├── vendor/pdfjs/
└── tests/  fixtures/*.tex, expectations.json, *.test.mjs, fake-model.mjs
```

Removed from the first plan: `analyze.js` (rule-based checks), `headings.js`, `keywords.js`.

## Complexity Tracking

| Item | Why | Simpler alternative rejected |
|---|---|---|
| Orchestrated tool loop | No native tool calling; user requires the AI to query the PDF itself | Stuffing the whole CV into one prompt: overflows Nano's context, no audit trail |
| Verification layer | Small-model hallucination | Trusting output: evidence could point at lines that say something else |
