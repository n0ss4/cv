# Research: ATS Checker 2

002's research (R1–R9 in `specs/002-ats-checker-web/research.md`) still holds: the Prompt API
facts, the tool loop without native tool calling, one task per session, grounding, layout facts
as tools, testing with a fake model, and determinism. This document records what is new.

## R1. Toolchain and versions

- **Decision**: React 19.3.0, TypeScript 7.0.2, Vite 8.3.2 with @vitejs/plugin-react 6.1.1,
  Tailwind 4.3.3 through @tailwindcss/vite, pdfjs-dist 6.3.289, Vitest 5.0.3, jsdom 30.1.1,
  Testing Library (react 16.3.3, user-event 14.6.7), axe-core 4.13.0. Exact versions sit in
  `package.json` (no ranges) and the lockfile is committed; install with `npm ci`.
- **Rule used to pick versions**: the newest stable release published at least two weeks before
  2026-10-17 (checked on the npm registry's `time` field), so a compromised fresh release has
  had time to be noticed. React 19 rather than 18: 18 is in maintenance, and 19 is what
  @testing-library/react 16 and plugin-react 6 target.
- **Why each package exists**: react/react-dom (requested UI framework); pdfjs-dist (the only
  maintained in-browser PDF text extractor, already used by 002 as a vendored copy);
  vite + plugin-react (TSX compile and bundling, which TSX cannot do without); tailwind (002's
  styling, now through its Vite plugin instead of the standalone CLI); vitest/jsdom/testing-
  library/axe-core (tests, including SC-009). Nothing else: no router (one screen with states),
  no state library (`useReducer`), no i18n library (two small dictionaries), no lint plugin for
  layering (an import-scanning test does it).
- **Alternatives**: Preact (smaller, but the user asked for React); Redux/Zustand (one state
  machine does not need them); i18next (heavier than two typed dictionaries).

## R2. How ATS parsers actually fail (the basis for new finding types)

Sources (2026): parser comparisons and tests of Workday, Greenhouse, Lever, Ashby,
SmartRecruiters and iCIMS ([jobloo](https://jobloo.co/blog/how-ats-systems-read-your-resume/),
[hireflow](https://hireflow.net/blog/workday-vs-greenhouse-vs-lever-us-parsing-comparison),
[resumeoptimizerpro](https://resumeoptimizerpro.com/blog/greenhouse-ats-resume-guide),
[loopcv](https://www.loopcv.pro/guides/ats-resume-not-parsed/)); parser-vendor background
([HrFlow benchmark of Daxtra/Sovren/Textkernel](https://blog.hrflow.ai/hr-software-companies-why-structuring-your-data-is-crucial-for-your-business/),
[careerbldr](https://careerbldr.com/blog/resume-parsing-how-it-works/)); recruiter search
behaviour ([resumegeni](https://resumegeni.com/blog/how-recruiters-search-inside-ats), Jobscan
survey figures as cited by [airesume.guru](https://airesume.guru/blog/resume-keywords-guide)).
Most of these are vendor blogs, not neutral benchmarks. Only claims that several sources agree
on, and that match this project's own fixture evidence, are used.

| Behaviour (agreed across sources) | Consequence here |
|---|---|
| Text is read in stream order: columns and sidebars interleave (Workday worst, "J ohn D oe") | keep `multi_column_layout`, measured |
| Table cells come out in unpredictable order (Lever, Workday) | **new** `table_layout`, measured via grid detection |
| Header/footer text dropped (Greenhouse) | keep `contact_in_header_footer`, measured |
| Design-tool exports (Canva/Figma/InDesign) put text in graphics, so the page looks blank | **new** `text_as_graphics`, measured: pages with images/vector drawing and almost no text |
| Skill bars, star ratings register as nothing (Ashby) | **new** `skill_rating_graphics`, measured: many small vector shapes on lines of a skills section |
| Pattern-based heading detection (Lever, Workday): "My Professional Journey" missed | keep `unconventional_heading`, AI |
| "Jan '22 to Present" fails; "January 2022 to Present" works (Lever) | **new** `ambiguous_date_format`, measured: apostrophe years, numeric `dd/mm/yy`, 2-digit years |
| Custom fonts without Unicode mapping garble accents (iCIMS) | keep `unreadable_characters`, measured; the why-text now cites names with accents |
| Icon-only contact labels missed (Ashby) | **new** `icon_only_contact`, measured: private-use glyphs or images directly before email/phone with no textual label |
| Recruiters filter by skills (76 %), education (60 %), title (55 %), certifications (51 %); ATS mostly rank or search, rarely auto-reject | the profile marks "searchable fields"; why-texts say "won't appear in searches" rather than "rejected"; certifications are covered by `missing_requirement` when a posting asks for them (no new type, because most CVs rightly have none) |
| Exact job title in the CV correlates strongly with interviews (Jobscan figure, unverified) | keep `title_mismatch`; raise it to **major** when a target title is given |

## R3. Measured vs AI: who decides what

- **Decision**: findings in the `parsing` category and the date-format check are produced by
  **deterministic rules over layout facts** (thresholds in `contracts/findings.md`) and labelled
  *Measured*. The model still receives the same facts through `layout_facts`, and may cite them in
  content findings, but it no longer emits `parsing` types (removed from its enum).
  Contact/section/content/language/keyword findings stay with the model, as in 002.
- **Rationale**: (1) The spec requires measured checks without AI (US6, FR-018). (2) Transparency
  (FR-006) means a user can tell a fact read from the file from an opinion of a small model.
  (3) 002's evaluation fixtures for parsing defects were its least stable with Nano. The model
  had the facts but sometimes did not report them, and stability is an acceptance criterion
  (US1-5). (4) These rules only map an already-measured observation to a catalogue entry. They
  do not score content, so 002's "no hand-written review algorithm" holds where it matters.
- **Alternative rejected**: keep everything AI-decided and show facts separately. Users would
  see "2 columns detected" next to an AI review that does not mention it.
- **Owner decision (2026-10-17)**: approved. Parsing is measured, and content stays AI.

## R4. CSP with Vite

- **Decision**: `index.html` and `eval.html` carry the production CSP as a `<meta>` tag. GitHub
  Pages cannot set headers, so the meta tag is the only option there. A tiny Vite plugin
  (`transformIndexHtml`, in `vite.config.ts`) swaps in a dev CSP under `vite serve` that adds only
  `connect-src ws://127.0.0.1:*` for HMR. `tests/build.test.ts` asserts that the built
  `dist/*.html` has the exact production policy (`default-src 'none'; script-src 'self';
  worker-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none';
  form-action 'none'; base-uri 'none'`) and no absolute `http(s)://` asset URL.
- **Tailwind 4 and inline styles**: the Vite plugin emits a CSS file, so `style-src 'self'`
  suffices. React `style={}` attributes count as inline style attributes, which CSP3 governs by
  `style-src-attr`. The UI must not use them (dynamic widths such as the score bar use SVG
  attributes or classes). A UI test fails on any `style` attribute.
- **No `'unsafe-eval'`**: pdf.js runs with `isEvalSupported: false`. Vite's production output has
  no eval.

## R5. pdf.js 6 in the browser and in Node

- **Decision**: `pdfjs-dist` with its module worker, imported as `pdfjs-dist/build/pdf.worker.min.mjs?url`
  so Vite emits it as a same-origin asset (`worker-src 'self'`). Options carried from 002:
  `isEvalSupported: false`, `useWorkerFetch: false`, `disableFontFace: true`,
  `disableNormalization: true` on `getTextContent`, and no CMap or standard-font URLs, which
  means no fetches. pdf.js loads lazily on the first file.
- **Node tests**: Vitest runs the same `PdfReader` with the Node entry of pdfjs-dist (no worker,
  `GlobalWorkerOptions.workerSrc` unset uses the fake worker). The reader takes the pdfjs module
  as a constructor argument, so the browser and Node differ only in the composition root.
- **Graphics facts** (new): `page.getOperatorList()` counts `paintImageXObject` /
  `paintInlineImageXObject` and path-construction ops per page. For skill-graphics detection,
  path ops are bucketed by the y-range of the current transform. This is enough for "this page
  is drawn, not written" and "many small shapes on these lines". The reader exposes these as
  `PageGraphics` in the Document. Formats without them report the facts as not applicable.
- **Risk**: pdf.js 6 API drift since 002's 5.7 (vendored). The first implementation task ports
  002's extraction tests to catch it, before any UI work.

## R6. Extensible formats: what Word will need (not built here)

- **Finding**: a `.docx` is a ZIP of XML parts. Body text is in `word/document.xml`. Headers and
  footers are separate parts (`header*.xml` / `footer*.xml`), so header/footer facts become
  **structural** (exact) rather than positional. Tables are `w:tbl`, text boxes are
  `w:txbxContent`, and images are `w:drawing`. Reading it in the browser needs only an unzip step
  (the `DecompressionStream('deflate-raw')` built-in is enough for the ZIP's deflate entries) and
  `DOMParser`. No line positions exist, so geometric facts (side-by-side, right-edge dates)
  become *not applicable*, but tables and text boxes map onto `table_layout` / sidebar facts
  directly.
- **Decision**: the `Document` model makes positions **optional** per line and adds
  `structure` facts a reader can supply directly (tables, header/footer parts, text boxes). Each
  layout fact carries `applicable: boolean`. `DocumentReader` declares `capabilities`
  (`positions`, `pages`, `graphics`, `structure`). A future `DocxReader` registers with
  `{ positions: false, pages: false, structure: true }` and needs no change outside its folder
  and one registry line, which is what SC-007 tests with a test-only `TextReader`.

## R7. AI engine port

- **Decision**: `AiEngine` exposes `id`, `displayName`, `modelName`, `runsOn: "device"`,
  `availability(langs)`, `prepare({ onProgress, signal })` (download after consent),
  `createSession({ system, langs, signal })`, plus a static `facts` object used by
  "About the AI": model, provider, size on disk, supported languages, known limits.
  `AiSession` exposes `prompt(input, { schema?, signal })`, `promptStream`, `clone()`,
  `destroy()` and `contextWindow`/`contextUsage` when known. The orchestrator uses only this.
- **Chrome adapter**: wraps `LanguageModel` exactly as 002's `ai.js` did. It keeps the 002
  lessons: the same options for `availability()` and `create()`, no probing of `samplingMode`, a
  reduced decoder schema, an assistant `{` prefix for answer turns, and the streaming fallback.
- **Future engines**: any engine that downloads weights from elsewhere (WebLLM, transformers.js)
  needs a CSP and Principle II amendment, because its download is page-initiated. The port does
  not prevent that, and the constitution decides it.

## R8. State and UX flow

- **Decision**: one `useReducer` state machine for the analysis
  (`idle → reading → measuring → [awaiting-consent → downloading] → extracting → reviewing →
  done | failed | cancelled`, plus `matching` after done), defined in `contracts/ui.md`. Use
  cases report progress events, the reducer maps them to steps, and an `AbortController` per
  run handles Cancel and a second drop.
- **Fix-first ordering** (US1-2): severity, then category weight, then document position. At most
  five items. Measured and AI findings are mixed, and their provenance stays visible.
- **Transparency patterns adopted**: a persistent status chip (like a browser lock icon) that
  opens the details panel; "nutrition label" panels for the AI (model, where it runs, what it
  can't do); per-result provenance badges; a log you can open at any time, including during the
  run; and an explicit consent dialog before the browser downloads the model.

## R9. i18n

- **Decision**: `ui/i18n/en.ts` is the typed source of keys, and `es.ts` must satisfy
  `typeof en` (a compile error if a key is missing). The language comes from
  `navigator.language` with a switch, held in memory. Storing the choice would break FR-002, so a
  reload returns to the browser language. Model output language follows the UI language
  (en/es); catalogue texts (why/fix templates) are localised in the catalogue.

## R10. Enforcing the dependency rule

- **Decision**: `tests/architecture.test.ts` parses `import` specifiers in `src/**` and fails if
  `domain/` imports anything outside `domain/`, `application/` imports `adapters|infrastructure|
  ui|react|pdfjs-dist`, `ui/` imports `adapters/readers|adapters/ai|pdfjs-dist`, or anything
  but `infrastructure/` and `main.tsx` imports `infrastructure/`. No extra dependency, and it
  fails in the same `make web-test` run.
