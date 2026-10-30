# AskTheMenu — Python Playwright submission

This folder contains 18 distinct test cases: four core features with three E2E
cases each (two positive and one negative), four real HTTP CRUD cases, and two
adverse network-mocking cases. Fourteen browser cases run on Chromium, Firefox
and WebKit; four API cases run once: **46 standard executions**.

The submission ZIP contains both `chatbot/` application source and `sw-testing/`.
Credentials, dependency folders, caches and development-only reports are excluded.
Team names/IDs intentionally use placeholders; fill them in and confirm the
responsibility allocation before presenting.

## Prerequisites and application setup

Use Python 3.12, Node.js compatible with Next.js 16.2.0, pnpm 10.32.1 and a
PostgreSQL database with the vector extension available. Use a development/test
database; these tests create real orders and guest sessions.

From the extracted project root:

```powershell
cd chatbot
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Fill `.env.local` with valid values. The tested flows require:

- `AUTH_SECRET`: a real application secret for guest session cookies.
- `DATABASE_URL` (or one supported database URL alias): the same database is used
  by the app and fixture helper. It must permit inserts and cleanup deletes.
- `GROQ_API_KEY`: live chat completion access.
- `GOOGLE_API_KEY`: the app's Gemini embedding/retrieval access.

Optional integrations, such as uploads, are outside this test sample. Do not use
the literal `****` placeholder values from `.env.example`. Do not set `PLAYWRIGHT`,
`PLAYWRIGHT_TEST_BASE_URL` or `CI_PLAYWRIGHT` for this live-service Python run; those
switch the application into its separate TypeScript test mode.

For a fresh test database, initialize the application's schema and menu data:

```powershell
pnpm db:migrate
pnpm db:seed
pnpm db:ingest-embeddings
pnpm dev
```

The seed provides table-1 through table-5, Chicken Karahi and Garlic Naan. Existing
configured databases need not be reseeded. Leave the development server running at
`http://localhost:3000`. The source-mutation demonstration requires development hot
reload, not an unchanged production build or unrelated deployed URL.

In a second PowerShell terminal:

```powershell
cd sw-testing
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m playwright install chromium firefox webkit
.\venv\Scripts\python.exe run_all_browsers.py
```

On macOS/Linux, use `python3 -m venv venv`, `venv/bin/python`, and install browser
system dependencies when required. Run all commands from `sw-testing`.

## Results and the real website-bug demonstration

- `reports/test_report.html`: complete standard-suite report with embedded browser
  screenshots. `reports/full_suite.xml` and `full_suite.log` retain raw results.
- `python demonstrate_bug.py`: temporarily changes the app's menu heading to
  `Unavailable menu`; the unchanged valid TC-04 fails on all three engines.
  The source is restored in `finally`, then TC-04 passes on all three engines.
- `reports/bug_injected.html` / `bug_fixed.html`: genuine failure/restoration runs.
- `evidence/intentional_bug.patch`, `bug_manifest.json`, and phase logs: the exact
  source change, original/mutated/restored hashes, outcomes and tracebacks.
- `screenshots/`: per-browser evidence plus feature screenshots and HTML summary.

An interrupted process cannot execute `finally` after forced termination; if the
heading still reads `Unavailable menu`, restore `Restaurant Menu` in
`chatbot/app/menu/page.tsx` before continuing. Normal errors/assertion failures are
handled by the restoration block.

## Rebuild everything

Install Tectonic and ensure `tectonic` is on PATH to compile the LaTeX PDF. With
the local development server running:

```powershell
.\venv\Scripts\python.exe run_submission.py
```

This runs the complete suite, demonstrates and restores the bug, captures feature
screenshots, generates consistent Markdown/LaTeX reports from XML/JSON evidence,
compiles the PDF, and builds `AskTheMenu_Testing_Submission.zip`. Packaging stops
if normal tests fail, are skipped, or the bug demonstration lacks the expected
failure/restoration results. `python build_submission.py` only rebuilds documents
and the ZIP from already-saved valid results.

## What each module proves

| Module | Cases | Coverage |
| --- | ---: | --- |
| test_chat_interface.py | 3 | Controls, live response plus refresh persistence, empty/whitespace prevention |
| test_menu_page.py | 3 | Dishes/prices/categories, all anchor viewports, visible HTTP 404 |
| test_kitchen_dashboard.py | 3 | Controls, known order and persisted status progression, polling/update errors and Retry |
| test_qr_table_routing.py | 3 | Five images/links, Table 1 navigation, invalid-table recovery |
| test_api_crud.py | 4 | Real create/read/update/delete with strict success, validation and auth assertions |
| test_network_mocking.py | 2 | Actual empty/500 interceptions, explicit alerts, editable input and a successful second send |

Create/read/update use orders; DELETE uses the existing owned-chat endpoint. The
DELETE fixture inserts a known private chat for the authenticated guest. The
tested delete itself is an application HTTP call, not a database deletion.
`scripts/database-fixtures.mjs` is invoked from the chatbot working directory so
it can use the app's dependencies and `.env.local`; it exposes no test HTTP route.
Order cleanup is limited to the current fixture's randomly generated SWTEST
marker. Browser chats are cleaned through their own authenticated API context.
Guest account rows are not globally deleted. Failed prerequisites are failures,
not accepted HTTP 500/503 results.

Use `pytest -m e2e`, `pytest -m api`, or `pytest -m mock` for a focused run.
`pytest --browser firefox` selects one engine, and `pytest --headed` displays it.
The submitted full-run evidence is headless and sequential. This Python suite is
separate from the existing TypeScript/GitHub Actions configuration; no CI or
headed execution is claimed in the report.

`FINAL_PROJECT_REPORT.pdf`, `.tex` and `.md` contain the scope/exclusions, all test
cases, measured results, bugs and placeholder contribution table. Both members
should rehearse every case using `DEMO_GUIDE.md` before the final demo.
