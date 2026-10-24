# Quickstart / validation: chat

`make web-test` runs:
- `tests/application/ask.test.ts`: citation verification, rewrite guard, refusal, memory of the
  last 4 exchanges, data framing, report unchanged;
- `tests/ui/chat.test.tsx`: starters, live status, citation → ATS view, Copy, Stop, Clear, no AI,
  axe.

Manually, in a Chrome with the model: ask each starter on the example CV; ask "write a poem" →
refusal.
