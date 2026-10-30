"""Feature 3: actual order cards/status transitions and polling error recovery."""
import re

import pytest
from playwright.sync_api import expect

from support import kitchen_order

# These tests use the browser UI; api_context is also used to confirm saved changes.
pytestmark = pytest.mark.e2e


@pytest.mark.positive
def test_kitchen_dashboard_loads(page):
    # TC-07 (positive): staff should see the dashboard and usable order filters.
    page.goto("/kitchen")
    expect(page.get_by_role("heading", name="Kitchen Dashboard", exact=True)).to_be_visible()
    # Filter labels include order counts, so match the start of each button's name.
    for name in ("All Orders", "Active", "Completed"):
        expect(page.get_by_role("button", name=re.compile(rf"^{name}\b"))).to_be_enabled()
    expect(page.get_by_text("Live orders · auto-refreshes every 5s", exact=True)).to_be_visible()


@pytest.mark.positive
def test_kitchen_renders_order_and_updates_status(page, api_context, order_factory):
    # TC-08 (positive): display an order and update it using the kitchen buttons.
    # The fixture creates our own order and removes it after the test.
    order = order_factory(note="Kitchen UI verification")
    page.goto("/kitchen")
    # Select our exact order ID rather than an unrelated order already on the page.
    card = page.locator(f"[data-order-id='{order['orderId']}']")
    expect(card).to_be_visible()
    # Verify the table, customer note, dishes, naan quantity and total price.
    expect(card).to_contain_text("Table 1")
    expect(card).to_contain_text(order["customerNote"])
    expect(card).to_contain_text("Chicken Karahi")
    expect(card).to_contain_text("Garlic Naan")
    expect(card).to_contain_text("2×")
    expect(card).to_contain_text(f"PKR {order['totalPkr']:,}")
    # Follow the normal staff workflow: accept, prepare, then mark the order served.
    for button, status in (("Accept", "accepted"), ("Start Preparing", "preparing"), ("Mark Served", "served")):
        # Capture the PATCH request sent by the button click.
        with page.expect_response(lambda r: r.request.method == "PATCH" and order["orderId"] in r.url) as changed:
            card.get_by_role("button", name=button, exact=True).click()
        assert changed.value.status == 200, changed.value.text()
        # Read the order through the API to confirm the change was saved on the server.
        assert kitchen_order(api_context, order["orderId"])["status"] == status
        if status != "served":
            expect(card.get_by_test_id("order-status")).to_have_text(status.title())
    # A served order should leave Active and appear under Completed without action buttons.
    expect(card).to_have_count(0)
    page.get_by_role("button", name=re.compile(r"^Completed\b")).click()
    expect(card.get_by_test_id("order-status")).to_have_text("Served")
    expect(card.get_by_role("button")).to_have_count(0)
    # Refresh to confirm the served status is saved, rather than only changed on screen.
    page.reload()
    page.get_by_role("button", name=re.compile(r"^Completed\b")).click()
    expect(card.get_by_test_id("order-status")).to_have_text("Served")


@pytest.mark.negative
def test_kitchen_handles_api_failure_gracefully(page, api_context, order_factory):
    # TC-09 (negative): failed requests should show an error and keep the last saved order.
    order = order_factory(note="Polling failure preservation")
    intercepted = []

    def fail(route):
        # Record the refresh request, then replace its response with a simulated HTTP 500.
        intercepted.append(route.request.url)
        route.fulfill(status=500, json={"error": "Simulated kitchen outage"})

    # Register interception before opening the page so its first refresh is covered.
    page.route("**/api/orders/kitchen", fail)
    page.goto("/kitchen")
    banner = page.get_by_test_id("kitchen-polling-error")
    expect(banner).to_be_visible()
    expect(banner).to_contain_text("Showing the last available orders")
    # This proves the error was actually simulated, rather than checking an unused mock.
    assert intercepted, "The polling failure route must be exercised"
    card = page.locator(f"[data-order-id='{order['orderId']}']")
    expect(card).to_be_visible()
    # A rejected update must preserve the order's confirmed status.
    # Also simulate a failed status change when the staff member clicks Accept.
    page.route(f"**/api/orders/{order['orderId']}/status", lambda r: r.fulfill(status=500, json={"error": "Rejected update"}))
    with page.expect_response(lambda r: r.request.method == "PATCH" and order["orderId"] in r.url) as rejected:
        card.get_by_role("button", name="Accept", exact=True).click()
    assert rejected.value.status == 500
    # The error should be visible, and both the UI and server should still say Pending.
    expect(page.get_by_test_id("kitchen-status-error")).to_have_text("Could not update the order. Please try again.")
    expect(card.get_by_test_id("order-status")).to_have_text("Pending")
    assert kitchen_order(api_context, order["orderId"])["status"] == "pending"
    # Remove the refresh mock so Retry reaches the real API again.
    page.unroute("**/api/orders/kitchen", fail)
    with page.expect_response("**/api/orders/kitchen") as recovered:
        banner.get_by_role("button", name="Retry", exact=True).click()
    # Successful recovery should remove the refresh error and keep the order visible.
    assert recovered.value.status == 200
    expect(banner).to_have_count(0)
    expect(card).to_be_visible()
