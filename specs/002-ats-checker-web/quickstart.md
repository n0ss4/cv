# Quickstart validation: In-Browser ATS Checker (on-device AI)

## V1 — Automated, any machine

```bash
make web-test
```

Builds the fixture PDFs, then `node --test web/tests/`: tools and layout facts on real PDFs,
verification, scoring, the orchestrator against a scripted fake model, CSP and i18n completeness.

## V2 — Prompt evaluation, supported Chrome (SC-002, SC-003)

```bash
make web            # http://127.0.0.1:8000/eval.html
```

Runs every fixture through Gemini Nano and compares with `web/tests/fixtures/expectations.json`:
expected finding types present, forbidden ones absent, profile fields correct, evidence verified.
Run twice to check stability.

## V3 — Manual

1. Supported Chrome: drop `build/web-fixtures/example/CV_Jane_Doe_EN.pdf` → no critical/major.
2. First run on a fresh profile: download prompt, progress, then analysis continues.
3. Firefox or Safari: notice above the fold; dropping a PDF shows the ATS view only.
4. DevTools → Network during analysis: no requests.
