"""Shared browser/API fixtures, isolated data, and HTML screenshot evidence."""
import base64
import os
import re
import uuid
from pathlib import Path

import pytest
from pytest_html import extras
from playwright.sync_api import expect

from support import database_task

# Default to the local website; BASE_URL can select a different running instance.
ROOT = Path(__file__).parent
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
SCREENSHOT_DIR = Path(os.getenv("SCREENSHOT_DIR", str(ROOT / "screenshots")))


def pytest_configure(config):
    # Give expect() assertions time to wait for the website to update.
    expect.set_options(timeout=20_000)


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    # Keep Playwright's existing settings and add our website URL and window size.
    return {**browser_context_args, "base_url": BASE_URL,
            "viewport": {"width": 1280, "height": 800}}


@pytest.fixture(scope="session")
def api_context(playwright):
    # Session scope creates this API context once for the whole pytest run.
    ctx = playwright.request.new_context(base_url=BASE_URL, timeout=90_000)
    # Visiting the guest-login route stores the session cookie in this context.
    response = ctx.get("/api/auth/guest?redirectUrl=/qr")
    assert response.status == 200, response.text()[:400]
    session = ctx.get("/api/auth/session").json()
    assert session.get("user", {}).get("id"), "A working database/guest session is required"
    # Tests receive ctx here. After they finish, execution continues below yield.
    yield ctx
    ctx.dispose()


@pytest.fixture
def order_factory(api_context):
    # A different marker for each test keeps its temporary orders easy to identify.
    marker = f"SWTEST-{uuid.uuid4()}-"
    created = []

    def create(items=None, note="Test order"):
        # Tests call this function to create a real order with known items.
        payload = {"tableSlug": "table-1",
                   "items": items or [{"name": "Chicken Karahi", "quantity": 1},
                                      {"name": "Garlic Naan", "quantity": 2}],
                   "customerNote": marker + note}
        response = api_context.post("/api/orders", data=payload)
        assert response.status == 201, f"Expected 201, got {response.status}: {response.text()}"
        result = response.json()
        created.append(result["orderId"])
        return result

    # Give the test the create() function, then remove only this test's marked orders.
    yield create
    result = database_task({"operation": "cleanupOrders", "marker": marker})
    assert set(result["deletedIds"]) == set(created), "Test order cleanup mismatch"


@pytest.fixture
def owned_chat(api_context):
    # Prepare a private chat owned by the API session, ready for the DELETE test.
    chat_id = str(uuid.uuid4())
    owner_id = api_context.get("/api/auth/session").json()["user"]["id"]
    database_task({"operation": "seedChat", "id": chat_id, "ownerId": owner_id})
    yield chat_id
    # If the test did not remove the chat, remove it here as cleanup.
    remaining = api_context.get(f"/api/messages?chatId={chat_id}")
    assert remaining.status == 200
    if remaining.json()["userId"] is not None:
        deleted = api_context.delete(f"/api/chat?id={chat_id}")
        assert deleted.status == 200, deleted.text()


@pytest.fixture(autouse=True)
def browser_evidence(request):
    # autouse=True runs this fixture automatically. Pure API tests do not need a page.
    if "page" not in request.fixturenames:
        yield
        return
    page = request.getfixturevalue("page")
    page.set_default_timeout(20_000)
    page.set_default_navigation_timeout(90_000)
    errors, chat_ids = [], set()
    # Record unhandled JavaScript errors so they can fail the test during cleanup.
    page.on("pageerror", lambda error: errors.append(str(error)))

    def track_chat(req):
        # Remember chat IDs used by this test so unrelated conversations are left alone.
        if req.method == "POST" and req.url.split("?")[0].endswith("/api/chat"):
            chat_id = (req.post_data_json or {}).get("id")
            if chat_id:
                chat_ids.add(chat_id)

    page.on("request", track_chat)
    yield
    # The test has finished. Use the same browser session to remove chats it created.
    for chat_id in chat_ids:
        response = page.request.get(f"/api/messages?chatId={chat_id}")
        assert response.status == 200, response.text()
        if response.json().get("userId") is not None:
            deleted = page.request.delete(f"/api/chat?id={chat_id}")
            assert deleted.status == 200, deleted.text()
    assert not errors, f"Unhandled browser errors: {errors}"


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # This pytest hook runs when a setup, test-call or cleanup result is reported.
    outcome = yield
    report = outcome.get_result()
    page = item.funcargs.get("page")
    if report.when == "call" and page and not page.is_closed():
        # Save the browser view after the test, using PASS/FAIL and its browser name.
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        name = re.sub(r"[^A-Za-z0-9_.-]", "_", item.name)
        path = SCREENSHOT_DIR / f"{'FAIL' if report.failed else 'PASS'}_{name}.png"
        png = page.screenshot(path=str(path), full_page=True)
        # Embed the image directly in the HTML report so it opens without extra files.
        report.extras = [*getattr(report, "extras", []),
                         extras.png(base64.b64encode(png).decode("ascii"), name="Browser screenshot")]
        print(f"Screenshot: {path}")
