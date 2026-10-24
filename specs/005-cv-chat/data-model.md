# Data Model: chat

```ts
interface Citation { ref: string; quote?: string; verified: boolean }

interface Rewrite {
  sourceRef: string | null;     // must exist in the CV
  sourceLine: string | null;
  text: string | null;          // null when withheld
  added: string[];              // what the guard found added ("source" when the line doesn't exist)
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "pending" | "done" | "error" | "cancelled";
  citations: Citation[];
  rewrites: Rewrite[];
  outOfScope: boolean;
  unverified: boolean;          // assistant answer whose citations all failed
}
```

The conversation is `ChatMessage[]` in the analysis state, reset by `start` and `clear`. Memory
sent to the model: the last 4 user/assistant pairs, with each assistant answer clipped to 200
characters.
