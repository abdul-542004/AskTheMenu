"""Generate consistent reports from actual results, compile PDF, and build the ZIP."""
import hashlib
from collections import Counter
import json
import os
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from support import APP_DIR, ROOT

CASES = [
    ("TC-01", "Chat", "Positive", "test_chat_page_loads_with_input_and_send_button", "Open the chat page and check the input, send button and model choices."),
    ("TC-02", "Chat", "Positive", "test_send_message_and_receive_ai_response", "Send a message, receive a reply and check that the conversation remains after refreshing."),
    ("TC-03", "Chat", "Negative", "test_empty_message_is_not_sent", "Try empty and whitespace-only messages; neither should be sent."),
    ("TC-04", "Menu", "Positive", "test_menu_page_loads_with_items", "Open the menu and check its heading, dishes, prices and category links."),
    ("TC-05", "Menu", "Positive", "test_category_anchor_scrolls_to_section", "Click each category and check that its section comes into view."),
    ("TC-06", "Menu", "Negative", "test_nonexistent_page_returns_404", "Open a missing menu page; expect HTTP 404 and a not-found message."),
    ("TC-07", "Kitchen", "Positive", "test_kitchen_dashboard_loads", "Open the kitchen dashboard and check its heading and filter buttons."),
    ("TC-08", "Kitchen", "Positive", "test_kitchen_renders_order_and_updates_status", "Check an order's details and move it through accepted, preparing and served."),
    ("TC-09", "Kitchen", "Negative", "test_kitchen_handles_api_failure_gracefully", "Simulate a failed refresh/update; check the error message, unchanged order and Retry button."),
    ("TC-10", "QR routing", "Positive", "test_qr_page_loads_with_table_codes", "Check that all five tables have working QR images and chat links."),
    ("TC-11", "QR routing", "Positive", "test_table_link_navigates_to_chat", "Click Table 1 and check that its chat page opens."),
    ("TC-12", "QR routing", "Negative", "test_invalid_table_slug_handles_gracefully", "Open an invalid table link; check the error message and return to the menu."),
    ("TC-13", "API Create", "Mixed", "test_create_order_with_valid_data", "POST an order: expect 201 and correct order data. Empty items should return 400."),
    ("TC-14", "API Read", "Mixed", "test_read_kitchen_orders", "GET the order list: expect 200 and the created order. A missing API route should return 404."),
    ("TC-15", "API Update", "Mixed", "test_update_order_status", "PATCH an order status: expect 200 and the saved change. Invalid status should return 400."),
    ("TC-16", "API Delete", "Mixed", "test_delete_owned_chat", "DELETE an owned chat: expect 200 and confirm removal. A caller without a session should get 401."),
    ("TC-17", "Empty mock", "Negative", "test_mock_empty_api_response", "Mock an empty chat response; check the notification and that another message can be sent."),
    ("TC-18", "Error mock", "Negative", "test_mock_server_error_response", "Mock HTTP 500; check the error notification and that another message can be sent."),
]

SCOPE = [
    ("Chat assistant", "Tested", "Main way diners ask questions about the menu."),
    ("Menu browsing", "Tested", "Lets diners view dishes, prices and categories."),
    ("Kitchen dashboard", "Tested", "Lets staff view orders and change their status."),
    ("QR table links", "Tested", "Takes diners to the chat for the correct table."),
    ("AI answer accuracy and full ordering conversations", "Left out", "Replies vary, so the chat test checks that a reply arrives and is saved."),
    ("File/image uploads", "Left out", "Needs separate upload/storage testing; the four main features were prioritised."),
    ("Theme and appearance controls", "Left out", "Lower priority than the main user actions for this assignment."),
    ("Scanning QR codes with a phone camera", "Left out", "Tests use desktop browsers to check QR images and table links."),
]

BUGS = [
    ("Intentional bug", "Menu heading changed from Restaurant Menu to Unavailable menu.", "TC-04 failed in all three browsers. After restoring the heading, it passed in all three."),
]


def results():
    tree = ET.parse(ROOT / "reports" / "full_suite.xml")
    cases = tree.findall(".//testcase")
    assert len(cases) == 46, "Expected 42 browser executions and four API cases"
    assert {re.sub(r"\[(chromium|firefox|webkit)\]$", "", c.attrib["name"]) for c in cases} == {c[3] for c in CASES}
    assert not any(c.find(tag) is not None for c in cases for tag in ("failure", "error", "skipped")), "Do not publish a passing report over failing/skipped results"
    counts = Counter(next((b for b in ("chromium", "firefox", "webkit") if c.attrib["name"].endswith(f"[{b}]")), "api") for c in cases)
    assert counts == {"chromium": 14, "firefox": 14, "webkit": 14, "api": 4}
    manifest = json.loads((ROOT / "evidence" / "bug_manifest.json").read_text())
    assert manifest["bug_injected"]["failed"] == 3
    assert manifest["bug_fixed"]["passed"] == 3
    assert manifest["original_sha256"] == manifest["restored_sha256"] == hashlib.sha256((APP_DIR / "app/menu/page.tsx").read_bytes()).hexdigest()
    return tree.find("testsuite").attrib["time"], manifest, counts


def esc(value):
    mapping = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}"}
    return "".join(mapping.get(c, c) for c in str(value))


def table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |", *["| " + " | ".join(str(c) for c in row) + " |" for row in rows]])


def latex_table(headers, rows, widths):
    spec = "".join(f"p{{{w}\\linewidth}}" for w in widths)
    return "\n".join([r"\small", r"\begin{longtable}{" + spec + "}", r"\toprule", " & ".join(r"\textbf{" + esc(h) + "}" for h in headers) + r" \\ \midrule \endhead", *[" & ".join(esc(c) for c in row) + r" \\" for row in rows], r"\bottomrule\end{longtable}", r"\normalsize"])


def generate_reports():
    elapsed, _, counts = results()
    date = datetime.now(timezone(timedelta(hours=5))).strftime("%d %B %Y")
    labels = {"chromium": "Chromium", "firefox": "Firefox", "webkit": "WebKit", "api": "API tests (run once)"}
    runtime = [(labels[name], counts[name], 0) for name in labels]
    runtime.append(("Total", sum(counts.values()), 0))
    contribution = [
        ("Member 1: [Name / Student ID]", "Chat and menu tests; network mocking tests; bug demonstration and report."),
        ("Member 2: [Name / Student ID]", "Kitchen and QR tests; API tests; screenshots and test reports."),
    ]
    introduction = (
        "This project applies Playwright with Python to test AskTheMenu, a restaurant website. "
        "Four main features were selected: chat, menu browsing, the kitchen dashboard and QR table links. "
        "Each feature has three end-to-end tests: two positive cases and one negative case. "
        "The project also includes four API tests covering CRUD and two network-mocking tests."
    )
    tools = "Tools used: Python, Playwright, pytest and pytest-html. Tests were run on Chromium, Firefox and WebKit against the local website."
    api = (
        "The API tests use Playwright's request context to send POST, GET, PATCH and DELETE requests. "
        "Create, read and update use orders; delete uses an owned chat. The tests check the response "
        "status and returned data, and confirm that changes were saved. They also check invalid input, "
        "a missing route and a request without a session."
    )
    mocking = (
        "The two network-mocking tests use page.route() to simulate an empty chat response and an HTTP 500 "
        "server error. Each test checks that a message appears, the input remains usable and the user can send another message."
    )
    execution = (
        "There are 18 test cases. The 12 end-to-end tests and two mocking tests run in each of the three "
        "browsers, giving 42 browser runs. The four API tests run once, giving 46 runs in total. "
        "All 46 passed."
    )
    demo = (
        "To show that a test can catch a website bug, the menu heading was deliberately changed from "
        "Restaurant Menu to Unavailable menu. TC-04 still expected Restaurant Menu, so it failed in "
        "Chromium, Firefox and WebKit. After the correct heading was restored, the same test passed in "
        "all three browsers. The script demonstrate_bug.py repeats this demonstration."
    )
    evidence = (
        "The submission ZIP contains the Python test files, an HTML report with all test results, "
        "screenshots, the intentional-bug results and this report. The main results are in "
        "reports/test_report.html. The bug demonstration is recorded in reports/bug_injected.html "
        "and reports/bug_fixed.html. Setup and run instructions are in README.md."
    )
    demo_preparation = "Both members should be able to explain every test during the final demo. DEMO_GUIDE.md provides a walkthrough for practice."
    testrows = [(i, feature, kind, objective, "Pass") for i, feature, kind, _, objective in CASES]
    md = [
        "# AskTheMenu ? Playwright Testing Project", f"Date: {date}",
        "## Introduction", introduction, tools,
        "## Features tested and left out", table(["Feature", "Scope", "Reason"], SCOPE),
        "## Test-case table", "Mixed API cases include both successful requests and checks for incorrect input or access.",
        table(["ID", "Feature", "Type", "What the test checks", "Result"], testrows),
        "## API testing and network mocking", api, mocking,
        "## Test results", execution, table(["Browser / test group", "Passed", "Failed"], runtime),
        "## Intentional bug demonstration", demo,
        table(["Bug", "What was changed", "Test result"], BUGS),
        "## Team contributions", table(["Member", "Work"], contribution), demo_preparation,
        "## Submitted files", evidence,
    ]
    (ROOT / "FINAL_PROJECT_REPORT.md").write_text("\n\n".join(md) + "\n", encoding="utf-8")
    tex = [
        r"\documentclass[10pt,a4paper]{article}",
        r"\usepackage[T1]{fontenc}\usepackage[utf8]{inputenc}\usepackage{mathptmx}",
        r"\usepackage[margin=0.7in]{geometry}\usepackage{longtable,booktabs,graphicx,float,hyperref}",
        r"\hypersetup{colorlinks=true,urlcolor=blue,linkcolor=blue}",
        r"\setlength{\parindent}{0pt}\setlength{\parskip}{5pt}\setlength{\tabcolsep}{4pt}\setlength{\emergencystretch}{1em}",
        r"\begin{document}",
        r"\begin{center}{\Large\bfseries AskTheMenu: Playwright Testing Project}\\[5pt]",
        esc(date), r"\end{center}",
        r"\section{Introduction}", esc(introduction), esc(tools),
        r"\section{Features tested and left out}",
        latex_table(["Feature", "Scope", "Reason"], SCOPE, [.28, .11, .55]),
        r"\section{Test-case table}",
        "Mixed API cases include both successful requests and checks for incorrect input or access.",
        latex_table(["ID / feature", "Type", "What the test checks", "Result"],
                    [(i + " / " + feature, kind, objective, "Pass") for i, feature, kind, _, objective in CASES],
                    [.17, .11, .57, .07]),
        r"\section{API testing and network mocking}", esc(api), esc(mocking),
        r"\section{Test results}", esc(execution),
        latex_table(["Browser / test group", "Passed", "Failed"], runtime, [.58, .15, .15]),
        r"\section{Intentional bug demonstration}", esc(demo),
        latex_table(["Bug", "What was changed", "Test result"], BUGS, [.15, .36, .43]),
        r"\section{Team contributions}",
        latex_table(["Member", "Work"], contribution, [.31, .63]), esc(demo_preparation),
        r"\section{Submitted files}", esc(evidence),
        r"\begin{figure}[H]\centering\includegraphics[width=0.75\linewidth,height=0.23\textheight,keepaspectratio]{screenshots/html_test_report.png}\caption{HTML test report showing the passing results.}\end{figure}",
        r"\begin{figure}[H]\centering\includegraphics[width=0.75\linewidth,height=0.23\textheight,keepaspectratio]{screenshots/bug_injected/website_bug_view.png}\caption{The deliberately incorrect menu heading used to demonstrate a failing test.}\end{figure}",
        r"\end{document}",
    ]
    (ROOT / "FINAL_PROJECT_REPORT.tex").write_text("\n\n".join(tex) + "\n", encoding="utf-8")


def build_zip():
    files = []
    names = ["conftest.py", "support.py", "pytest.ini", "requirements.txt", "README.md", "DEMO_GUIDE.md", "run_all_browsers.py", "run_all_browsers.bat", "run_all_browsers.sh", "run_submission.py", "demonstrate_bug.py", "build_submission.py", "capture_report_screenshots.py", "FINAL_PROJECT_REPORT.md", "FINAL_PROJECT_REPORT.tex", "FINAL_PROJECT_REPORT.pdf"]
    files += [ROOT / name for name in names]
    files += sorted((ROOT / "tests").glob("*.py"))
    files += sorted((ROOT / "scripts").glob("*.mjs"))
    for name in ("test_report.html", "full_suite.xml", "full_suite.log", "bug_injected.html", "bug_injected.xml", "bug_fixed.html", "bug_fixed.xml"):
        files.append(ROOT / "reports" / name)
    files += [p for p in (ROOT / "evidence").glob("*") if p.is_file() and p.name != "submission_manifest.json"]
    files += list((ROOT / "screenshots").glob("PASS_*.png"))
    files += list((ROOT / "screenshots").glob("feature*.png"))
    files += [ROOT / "screenshots" / "html_test_report.png"]
    if (ROOT.parent / "Menu.md").exists():
        files.append(ROOT.parent / "Menu.md")
    for phase in ("bug_injected", "bug_fixed"):
        files += sorted((ROOT / "screenshots" / phase).glob("*.png"))
    # Include reproducible application source; never include credentials, dependencies or caches.
    excluded = {"node_modules", ".next", ".git", ".cursor", ".vscode", "artifacts", "playwright-report", "test-results"}
    for directory, directories, filenames in os.walk(APP_DIR):
        directories[:] = [name for name in directories if name not in excluded]
        for name in filenames:
            path = Path(directory) / name
            if name.startswith(".env") and name != ".env.example":
                continue
            if path.suffix in {".tsbuildinfo", ".log", ".zip"}:
                continue
            files.append(path)
    files = sorted(set(files))
    records = []
    for path in files:
        assert path.is_file(), f"Missing submission artifact: {path}"
        arcname = path.relative_to(ROOT.parent).as_posix()
        records.append({"path": arcname, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = ROOT / "evidence" / "submission_manifest.json"
    manifest.write_text(json.dumps(records, indent=2), encoding="utf-8")
    files.append(manifest)
    target = ROOT / "AskTheMenu_Testing_Submission.zip"
    temporary = ROOT / "AskTheMenu_Testing_Submission.building.zip"
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT.parent).as_posix())
    with zipfile.ZipFile(temporary) as archive:
        assert archive.testzip() is None
        assert not any("__pycache__" in n or "/.env.local" in n or "/node_modules/" in n for n in archive.namelist())
    temporary.replace(target)
    print(f"Submission ZIP: {target} ({target.stat().st_size:,} bytes; {len(files)} files)")


if __name__ == "__main__":
    generate_reports()
    compiler = shutil.which("tectonic")
    if not compiler:
        raise SystemExit("Install Tectonic to compile FINAL_PROJECT_REPORT.tex before packaging")
    result = subprocess.run([compiler, "FINAL_PROJECT_REPORT.tex"], cwd=ROOT)
    if result.returncode:
        raise SystemExit(result.returncode)
    build_zip()
