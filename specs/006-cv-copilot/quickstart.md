# Quickstart: Chat with your CV

```bash
make web-test                 # fakes cover every scenario below
make web                      # Chrome with Gemini Nano for the real model
```

1. Drop the example CV. At ≥ 1024 px the chat panel is beside the report; there is no Ask tab.
2. Ask "What should I fix first?" and click a citation: the report shows the ATS view on that
   line; the conversation stays.
3. Add a posting from the panel (paste `web/tests/fixtures/postings/backend.txt`). A page message
   with the match appears, and the chip shows the posting. Ask "Am I right for this job?": a fit
   card with the same figures as the Job match tab.
4. Ask "Rewrite my skills line for this posting": an exact-term swap is shown; an invented skill
   is withheld with "the posting asks for …".
5. Drop the CV again: the conversation stays, a version message and a re-comparison message
   appear, and the old citations read "previous version".
6. At 390 px: the "Chat with your CV" button opens the sheet; Escape returns focus to it.
