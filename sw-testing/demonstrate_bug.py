"""Inject a real website regression, capture failing tests, restore and verify.

The test never changes. The application source is restored in a finally block.
Run with the local development server already running (hot reload is required).
"""
import difflib
import hashlib
import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

from support import APP_DIR, ROOT

TARGET = APP_DIR / "app" / "menu" / "page.tsx"
CASE = "tests/test_menu_page.py::test_menu_page_loads_with_items"
EVIDENCE = ROOT / "evidence"
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")


def wait_for_heading(expected):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        with opener.open(BASE_URL + "/menu", timeout=30) as response:
            if expected in response.read().decode("utf-8"):
                return
        time.sleep(1)
    raise RuntimeError("The development server did not reflect the source change")


def run_phase(name, expect_failure):
    env = {**os.environ, "SCREENSHOT_DIR": str(ROOT / "screenshots" / name), "PYTHONIOENCODING": "utf-8"}
    command = [sys.executable, "-m", "pytest", CASE, "--browser", "chromium",
               "--browser", "firefox", "--browser", "webkit", "-o", "addopts=",
               f"--html=reports/{name}.html", "--self-contained-html",
               f"--junitxml=reports/{name}.xml", "-v", "--tb=short", "-p", "no:cacheprovider"]
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (EVIDENCE / f"{name}.log").write_text(result.stdout + result.stderr, encoding="utf-8")
    print(result.stdout, flush=True)
    cases = ET.parse(ROOT / "reports" / f"{name}.xml").findall(".//testcase")
    assert len(cases) == 3, "All three browser engines must run"
    assert not any(case.find("error") is not None or case.find("skipped") is not None for case in cases)
    failures = [case.find("failure") for case in cases if case.find("failure") is not None]
    if expect_failure:
        assert result.returncode == 1 and len(failures) == 3, "Expected three genuine assertion failures"
        assert all("Unavailable menu" in (failure.text or "") and "Restaurant Menu" in (failure.text or "") for failure in failures), "Failures must identify the injected heading regression"
    else:
        assert result.returncode == 0 and not failures, "Restored application must pass"
    return {"tests": len(cases), "passed": len(cases) - len(failures), "failed": len(failures), "exit_code": result.returncode}


def main():
    assert urlparse(BASE_URL).hostname in {"localhost", "127.0.0.1", "::1"}, "The source-mutation demo requires a local development server"
    EVIDENCE.mkdir(exist_ok=True)
    original = TARGET.read_bytes()
    test_path = ROOT / "tests" / "test_menu_page.py"
    test_hash = hashlib.sha256(test_path.read_bytes()).hexdigest()
    assert original.count(b"Restaurant Menu") == 1, "Expected a single heading to mutate"
    changed = original.replace(b"Restaurant Menu", b"Unavailable menu", 1)
    patch = "".join(difflib.unified_diff(original.decode().splitlines(True), changed.decode().splitlines(True), fromfile="a/chatbot/app/menu/page.tsx", tofile="b/chatbot/app/menu/page.tsx"))
    (EVIDENCE / "intentional_bug.patch").write_text(patch, encoding="utf-8")
    manifest = {"application_file": "chatbot/app/menu/page.tsx", "unchanged_test": CASE,
                "original_sha256": hashlib.sha256(original).hexdigest(),
                "unchanged_test_sha256": test_hash,
                "mutated_sha256": hashlib.sha256(changed).hexdigest()}
    try:
        TARGET.write_bytes(changed)
        wait_for_heading("Unavailable menu")
        manifest["bug_injected"] = run_phase("bug_injected", expect_failure=True)
        from playwright.sync_api import expect, sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(BASE_URL + "/menu", timeout=90_000)
            expect(page.get_by_role("heading", level=1)).to_have_text("Unavailable menu")
            page.screenshot(path=str(ROOT / "screenshots" / "bug_injected" / "website_bug_view.png"))
            browser.close()
    finally:
        TARGET.write_bytes(original)
        manifest["restored_sha256"] = hashlib.sha256(TARGET.read_bytes()).hexdigest()
        (EVIDENCE / "bug_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    wait_for_heading("Restaurant Menu")
    manifest["bug_fixed"] = run_phase("bug_fixed", expect_failure=False)
    assert manifest["original_sha256"] == manifest["restored_sha256"]
    assert hashlib.sha256(test_path.read_bytes()).hexdigest() == test_hash
    (EVIDENCE / "bug_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
