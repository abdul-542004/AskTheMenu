"""
conftest.py – Shared Playwright fixtures for all test modules.

Provides:
  • browser_context_args  – sets viewport, screenshots on failure, base URL
  • base_url              – reads from env or defaults to localhost:3000
  • api_context           – a headless APIRequestContext for pure HTTP tests
  • screenshot_dir        – path to screenshots/ folder (auto-created)
"""

import os
import pytest
from pathlib import Path
from playwright.sync_api import Playwright, BrowserType

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"
REPORT_DIR = Path(__file__).parent / "reports"


# ── Ensure output dirs exist ─────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _ensure_dirs():
    """Create screenshots/ and reports/ directories once per session."""
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    REPORT_DIR.mkdir(exist_ok=True)


# ── Expose base_url to all tests ─────────────────────────────────────────────
@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


# ── Override default Playwright browser_context_args ─────────────────────────
@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "base_url": BASE_URL,
        "viewport": {"width": 1280, "height": 720},
        "ignore_https_errors": True,
    }


# ── Headless API request context (no browser needed) ────────────────────────
@pytest.fixture(scope="session")
def api_context(playwright: Playwright):
    """
    A Playwright APIRequestContext for testing REST endpoints directly.
    Does NOT open a browser window – much faster for CRUD/API tests.
    """
    ctx = playwright.request.new_context(base_url=BASE_URL, timeout=60_000)
    yield ctx
    ctx.dispose()


# ── Screenshot-on-failure hook ───────────────────────────────────────────────
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Capture a screenshot whenever a browser-based test fails."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)

    if rep.when == "call" and rep.failed:
        page = item.funcargs.get("page") if hasattr(item, "funcargs") else None
        if page:
            try:
                SCREENSHOT_DIR.mkdir(exist_ok=True)
                test_name = (
                    item.name.replace(" ", "_")
                    .replace("/", "_")
                    .replace("[", "_")
                    .replace("]", "_")
                )
                path = SCREENSHOT_DIR / f"FAIL_{test_name}.png"
                page.screenshot(path=str(path), full_page=True)
                print(f"\n[Screenshot] Captured failure screenshot to {path}")
            except Exception as e:
                print(f"\n[Screenshot] Failed to capture: {e}")
