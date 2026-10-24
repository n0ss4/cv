# Data Model: Chat with your CV

Changes to `domain/chat/model.ts` (005):

```ts
type CardKind = "fit" | "knockouts" | "keywords" | "gaps";
interface Card { kind: CardKind; job: JobMatch }             // snapshot the card renders from

interface Rewrite { …005; postingMissing: string[] }        // added terms the posting asks for

type PageEvent =
  | { kind: "job"; title: string | null; percent: number | null; before: number | null;
      required: { covered: number; total: number } | null; fails: number; notStated: number;
      missingKeywords: number; trimmed: boolean }
  | { kind: "jobFailed" }
  | { kind: "version"; scoreBefore: number | null; scoreAfter: number | null;
      resolved: number; added: number };

interface ChatMessage {
  id; role: "user" | "assistant" | "page"; text; status; citations; rewrites;
  outOfScope; unverified;
  cards: Card[];               // assistant only
  needsPosting: boolean;       // assistant only: show "Add a posting"
  reportId: string | null;     // the report version the message was written against
  event?: PageEvent;           // page only
}
```

`memoryOf` skips page messages.

UI state (`AnalysisState.chat`):

```ts
chat: {
  messages: ChatMessage[];
  running: boolean;
  status: { key; params } | null;
  posting: { text: string; title: string; percent: number | null } | null;   // in context
}
```

Transitions:
- `start` keeps `chat.messages` and `chat.posting` and sets `running: false`.
- `clear` resets everything.
- `chatReset` ("New conversation") empties `messages` and keeps the posting.
- `jobDone(report, posting)` sets the posting and appends a `job` event (with `before` when the
  posting text is unchanged).
- `jobFailed` appends `jobFailed`.
- `done` appends a `version` event when there were messages and a previous report.
