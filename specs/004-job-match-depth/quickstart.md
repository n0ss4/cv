# Quickstart / validation: deeper job match

```bash
make web-test    # domain/job unit tests, compareJob with the fake engine, UI tests
make web         # manual check in a Chrome with the built-in model
```

| # | Scenario | Expected |
|---|---|---|
| 1 | Unit: CV text "K8s, Postgres" vs posting "Kubernetes, PostgreSQL" | both *variant*, with the CV line, Measured |
| 2 | Unit: years from roles 2016-01–2020-12 and 2020-06–present | merged once; years = floor of the merged months |
| 3 | Unit: phrasing that adds "40%" not on its source line | rejected → "only if true" note |
| 4 | UI, fake engine: example CV + `postings/backend.txt` | summary first; 2 of 4 required; missing required listed first; knock-outs shown with years computation |
| 5 | UI, no engine: paste a posting | keyword check only, with the "needs on-device AI" notice; no summary |
| 6 | Real model (`make web-eval` later): phrasings never add facts | SC-003 |
