# Data Model: ATS Checker 2

Types live in `web/src/domain/**` and are listed here in TypeScript notation. Nothing is
persisted. All of it lives for one tab's lifetime, or until "Clear".

## Document (format-neutral)

```ts
type FormatId = string;                       // "pdf", later "docx"; registry key

interface Document {
  format: FormatId;
  fileName: string;
  fileSize: number;
  capabilities: ReaderCapabilities;           // what this format could provide
  pages: Page[];                              // formats without pages: exactly one page
  structure?: StructureFacts;                 // supplied directly by structural formats (docx)
}

interface ReaderCapabilities { positions: boolean; pages: boolean; graphics: boolean; structure: boolean }

interface Page {
  number: number;                             // 1-based
  width?: number; height?: number;            // present iff capabilities.positions
  items?: PositionedItem[];                   // raw positioned text (PDF); absent for structural formats
  lines?: string[];                           // parser-order lines supplied directly (structural formats)
  graphics?: PageGraphics;                    // present iff capabilities.graphics
}

interface PositionedItem { str: string; x: number; y: number; w: number; h: number; bold: boolean; eol: boolean }
interface PageGraphics { images: number; paths: number; pathRows: { y: number; count: number }[] }
interface StructureFacts {
  headerText: string[]; footerText: string[];
  tables: { rows: number; cols: number; firstLineRef?: LineRef }[];
  textBoxes: number;
}
```

Validation: `pages.length ≥ 1`; `width/height/items` present exactly when `capabilities.positions`;
`lines` present when not. Readers enforce this, and `assertDocument()` checks it in tests.

## Line index (derived, what tools and evidence use)

```ts
type LineRef = `p${number}:${number}`;        // "p1:12", parser order, 1-based per page

interface IndexedLine { ref: LineRef; page: number; line: number; text: string; h: number; bold: boolean }
interface GeoLine     { page: number; y: number; h: number; text: string; segments: { x0: number; x1: number; text: string }[] }

interface LineIndex {
  doc: Document;
  pages: { number: number; lines: IndexedLine[]; geo: GeoLine[] }[];   // geo empty without positions
  lines: IndexedLine[];
  byRef: ReadonlyMap<LineRef, IndexedLine>;
  text: string;
}
```

Built by `indexDocument(doc)` with 002's `atsLines` / `geometricLines` algorithms, unchanged:
pages with `items` go through them, and pages with `lines` are used as-is (h = 0, bold = false).

## Layout facts

```ts
interface Fact<T> { applicable: boolean; value: T }  // applicable=false → "not applicable", never "fine"

interface LayoutFacts {
  side_by_side_blocks: Fact<{ lines: number; of_total_lines: number; example_refs: LineRef[] }>;
  header_zone: Fact<{ ref: LineRef | null; text: string }[]>;
  footer_zone: Fact<{ ref: LineRef | null; text: string }[]>;
  bullet_only_lines: Fact<LineRef[]>;
  date_only_lines: Fact<LineRef[]>;
  right_edge_dates: Fact<LineRef[]>;
  hyphen_breaks: Fact<LineRef[]>;
  unusual_characters: Fact<{ count: number; ratio: number; examples: string[] }>;
  // new in 003
  table_grid: Fact<{ rows: number; cols: number; first_ref: LineRef | null }[]>;
  graphics_pages: Fact<{ page: number; images: number; paths: number; chars: number }[]>;
  shape_rows: Fact<{ ref: LineRef | null; shapes: number }[]>;
  ambiguous_dates: Fact<{ ref: LineRef; text: string }[]>;
  unlabelled_contact: Fact<{ ref: LineRef; kind: "email" | "phone"; marker: string }[]>;
}
```

Applicability rules are in `contracts/tools.md`.

## Findings

```ts
type Category   = "parsing" | "contact" | "sections" | "content" | "language" | "dates" | "length" | "keywords";
type Severity   = "critical" | "major" | "minor";
type Provenance = "measured" | "ai-verified" | "ai-unverified";

interface Evidence { ref: LineRef; quote?: string; verified: boolean }

interface Finding {
  type: FindingType;                          // closed catalogue, contracts/findings.md
  category: Category;                         // from the catalogue, never from the model
  severity: Severity;                         // from the catalogue (context may raise it, see findings.md)
  title: string; why: string; fix: string;    // AI-written (AI findings) or catalogue template (measured)
  evidence: Evidence[];
  provenance: Provenance;                     // measured | ai-verified (≥1 evidence verified) | ai-unverified
}
```

## Extracted profile

As in 002 (`contracts/schemas.md`), with every leaf `{ value, refs, verified }` and an added
`provenance` derived from `verified`. `searchable` marks the fields recruiters filter on: skills,
education, experience titles, certifications.

## Report

```ts
type Verdict = "ready" | "needs-work" | "not-ready" | "unreadable" | "incomplete" | "measured-only";

interface Report {
  id: string;                                 // random, in-memory, for rescan pairing
  createdAt: number;
  document: { fileName: string; format: FormatId; pages: number; chars: number };
  engine: { id: string; model: string } | null;   // null → measured-only
  promptVersion: string;                      // prompts/VERSION
  verdict: Verdict;
  overall: number | null;                     // null when incomplete / measured-only / unreadable
  categories: Partial<Record<Category, number>>;
  fixFirst: Finding[];                        // ≤ 5, ordering in findings.md
  findings: Finding[];
  strengths: string[];
  profile: ExtractedProfile | null;
  facts: LayoutFacts;
  log: ToolCall[];
  failed: { task: string; message: string }[];
  job?: JobMatch;
}
```

State rules:

- `unreadable` when `doc_info.text_layer = "none"`. No model call, and no findings except
  `no_text_layer`.
- `measured-only` when no engine is available. Only measured findings, no `overall`, no profile.
- `incomplete` when any AI task failed. Findings are shown, but there is no `overall`.
- Otherwise the verdict and scores follow `contracts/findings.md`.

## Tool call (audit log)

```ts
interface ToolCall {
  task: string;                               // "setup" | task name
  step: number;
  kind: "tool" | "prompt" | "retry" | "failure";
  tool?: string; args?: Record<string, unknown>; result?: unknown;
  message?: string;                           // retry reason / failure message
  ms: number;
  at: number;
}
```

## Rescan comparison

```ts
interface RescanDiff {
  previous: { verdict: Verdict; overall: number | null; fileName: string };
  current:  { verdict: Verdict; overall: number | null; fileName: string };
  resolved: Finding[]; added: Finding[]; unchanged: Finding[];
}
```

Matching key: `type`, plus for types that can occur more than once, the folded first evidence
quote. Only the most recent previous report of the session is kept.

## Job requirements / match

As in 002 (`contracts/schemas.md#job-requirements`), each match evidence verified.
