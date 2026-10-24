# Data Model: Deeper job-posting match

All of it is in memory. It extends `JobMatch` in `domain/report/report.ts`.

```ts
type KnockoutKind = "years" | "degree" | "language" | "certification" | "location" | "authorisation";

interface Requirement {
  text: string;
  kind: "skill" | "experience" | "education" | "language" | "certification" | "location" | "authorisation" | "other";
  importance: "required" | "preferred";
  knockout: KnockoutKind | null;
  years: number | null;        // for knockout "years"
  level: string | null;        // for knockout "language", as written in the posting
  source: "ai" | "measured";
}

interface KeywordCheck {
  term: string;                 // as written in the posting
  group: string | null;         // equivalence group id, null for AI-only terms
  status: "exact" | "variant" | "missing";
  cvTerm: string | null;        // the CV's form when variant/exact
  ref: LineRef | null;
  importance: "required" | "preferred" | "unknown";
  provenance: Provenance;       // measured for list terms; AI for AI-only terms (still literally checked)
}

interface Suggestion {
  target: "skills" | "experience" | "summary" | "headline" | "none";
  phrasing: string | null;      // null → "only if true" note
  sourceRef: LineRef | null;
  provenance: Provenance;       // ai-verified when sourceRef verified and guard passed
}

interface RequirementMatch {
  requirement: Requirement;
  status: "matched" | "partial" | "missing";
  evidence: Evidence[];
  suggestion: Suggestion | null;  // for partial / missing
}

interface YearsComputation {
  ranges: { from: string; to: string; ref: LineRef | null }[];   // merged, "YYYY-MM"
  months: number;
  years: number;                // floor(months / 12)
  undated: number;              // roles without usable dates
}

interface KnockoutResult {
  requirement: Requirement;
  outcome: "meets" | "fails" | "not-stated" | "unknown";
  evidence: Evidence[];
  detail: { key: string; params?: Record<string, string | number> };   // localised by UI
  years?: YearsComputation;
}

interface JobSummary {
  required: { covered: number; total: number };    // covered counts partial as 0.5
  preferred: { covered: number; total: number };
  percent: number;
  verdict: "strong" | "close" | "gaps";
  missingRequired: string[];
}

interface JobMatch {               // replaces 003's shape
  title: string | null;
  titleInCv: boolean | null;
  trimmed: boolean;
  aiRan: boolean;
  keywords: KeywordCheck[];
  requirements: RequirementMatch[];
  knockouts: KnockoutResult[];
  summary: JobSummary | null;      // null when the AI did not run
}
```
