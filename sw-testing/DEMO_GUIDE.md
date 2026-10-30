# Pair demonstration guide

Both members should rehearse the entire suite, including fixtures and cleanup.
Names and student IDs are intentionally left as placeholders at the user's request.

1. Start the app with `pnpm dev` from `chatbot`. Explain that a seeded database,
   guest authentication, Groq, and the app's configured retrieval dependencies are
   required. A missing dependency is a failed prerequisite, not an accepted pass.
2. Run `python run_all_browsers.py` from `sw-testing`. Explain the 18 test cases:
   12 feature E2E cases, four HTTP CRUD cases, and two adverse network mocks.
   Fourteen browser tests run on each engine; the API tests run once: 46 executions.
3. Chat: explain visible controls, the actual chat POST and nonempty response,
   conversation persistence after refresh, and why blank/whitespace sends must
   produce neither a request nor a user message.
4. Menu: explain dish prices/allergens, anchors versus viewport visibility, and
   why the missing menu route must return HTTP 404 as well as show an error page.
5. Kitchen: explain marked test orders, item quantities/notes/totals, the sequence
   pending -> accepted -> preparing -> served, persistence after refresh, and why
   a rejected update must leave the last confirmed status intact. Demonstrate the
   polling-error alert, retained cards, and Retry recovery.
6. QR: explain five image/link checks, navigation to Table 1, and recovery from an
   invalid slug. Image loading/link navigation are tested; camera scanning is not.
7. API: explain strict 201 creation and arithmetic, 200 retrieval of a known order,
   200 accepted-status update plus invalid-status 400, and 200 deletion of a seeded
   owned chat. The same DELETE case proves that an unauthenticated caller gets 401
   and leaves the chat intact. The read case also checks a missing API route is 404.
8. Mocks: show each `page.route`, response/request assertions, visible alert,
   editable input and a successful second send using a valid simulated stream.
   Explain the distinction between these client tests and the live chat E2E case.
9. Run `python demonstrate_bug.py`. It temporarily changes the application heading
   to `Unavailable menu`. The unchanged valid menu test fails on all three engines.
   The script always restores the source, then proves the same test passes. Show
   the patch, JSON hash manifest, two HTML reports and failure screenshots.
10. Explain that `database-fixtures.mjs` seeds only a known owned chat and removes
    only orders with the current fixture's random SWTEST marker. Application HTTP
    operations are not mocked by that helper. Browser chats are removed through
    the authenticated application DELETE endpoint.
11. Open `FINAL_PROJECT_REPORT.pdf` and the main HTML report. Each member should be
    able to explain any selected assertion, setup fixture, failure and limitation.
    Fill in actual names/IDs and confirm the responsibility allocation before
    presenting; the report does not certify that rehearsal has already happened.
