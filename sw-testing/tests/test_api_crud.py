"""Four real HTTP CRUD tests; no server error is accepted as success."""
import math
import uuid

import pytest

from support import kitchen_order

# APIRequestContext sends HTTP requests directly, without opening a browser page.
# These cases run once even when browser tests run on three engines.
pytestmark = pytest.mark.api


@pytest.mark.positive
def test_create_order_with_valid_data(api_context, order_factory):
    # TC-13 (Create): order_factory sends POST /api/orders and requires HTTP 201.
    # It creates a uniquely marked order and cleans it up after the test.
    order = order_factory(note="CRUD creation")
    # Check that the server returns a valid order ID, initial status and requested items.
    assert str(uuid.UUID(order["orderId"])) == order["orderId"]
    assert order["status"] == "pending"
    assert [(i["name"], i["quantity"]) for i in order["items"]] == [
        ("Chicken Karahi", 1), ("Garlic Naan", 2)]
    # Calculate the expected prices independently instead of trusting the returned total.
    subtotal = sum(i["unitPricePkr"] * i["quantity"] for i in order["items"])
    assert subtotal > 0
    assert all(i["lineTotalPkr"] == i["quantity"] * i["unitPricePkr"] for i in order["items"])
    assert order["subtotalPkr"] == subtotal
    # For positive amounts, floor(x + 0.5) matches the app's rounding to whole rupees.
    assert order["gstAmountPkr"] == math.floor(subtotal * order["gstRatePct"] / 100 + 0.5)
    assert order["totalPkr"] == subtotal + order["gstAmountPkr"]
    # Read the order back to confirm it was saved with the same total.
    assert kitchen_order(api_context, order["orderId"])["totalPkr"] == order["totalPkr"]
    # Negative check: an order without any items should be rejected with HTTP 400.
    invalid = api_context.post("/api/orders", data={"tableSlug": "table-1", "items": []})
    assert invalid.status == 400
    assert invalid.json()["error"] == "Invalid order data"


@pytest.mark.positive
def test_read_kitchen_orders(api_context, order_factory):
    # TC-14 (Read): create a known order, then find it in GET /api/orders/kitchen.
    created = order_factory(note="CRUD retrieval")
    # kitchen_order checks HTTP 200 and returns the record matching this order ID.
    order = kitchen_order(api_context, created["orderId"])
    # Verify the saved table, customer note and item quantities.
    assert order["status"] == "pending"
    assert order["tableLabel"] == created["tableLabel"]
    assert order["customerNote"] == created["customerNote"]
    assert [(i["menuItemName"], i["quantity"]) for i in order["items"]] == [
        ("Chicken Karahi", 1), ("Garlic Naan", 2)]
    # Negative check: a route that does not exist should return HTTP 404.
    missing = api_context.get("/api/does-not-exist")
    assert missing.status == 404


@pytest.mark.positive
def test_update_order_status(api_context, order_factory):
    # TC-15 (Update): change our new order from pending to accepted using PATCH.
    created = order_factory(note="CRUD update")
    path = f"/api/orders/{created['orderId']}/status"
    response = api_context.patch(path, data={"status": "accepted"})
    # Check the response, then fetch the order again to confirm the update was saved.
    assert response.status == 200, response.text()
    assert response.json()["id"] == created["orderId"]
    assert response.json()["status"] == "accepted"
    assert kitchen_order(api_context, created["orderId"])["status"] == "accepted"
    # Negative check: this status is not allowed and must return HTTP 400.
    invalid = api_context.patch(path, data={"status": "ready_to_fly"})
    assert invalid.status == 400
    assert invalid.json()["error"] == "Invalid status"
    # Rejecting the bad status must leave the previously saved Accepted status unchanged.
    assert kitchen_order(api_context, created["orderId"])["status"] == "accepted"


@pytest.mark.positive
def test_delete_owned_chat(api_context, owned_chat, playwright, base_url):
    # TC-16 (Delete): owned_chat prepares a private chat belonging to our API session.
    path = f"/api/chat?id={owned_chat}"
    # A separate request context has no session cookies, so it represents an anonymous caller.
    anonymous = playwright.request.new_context(base_url=base_url)
    try:
        # Negative check: this caller must receive HTTP 401 rather than delete the chat.
        denied = anonymous.delete(path)
        assert denied.status == 401, denied.text()
        assert denied.json()["code"] == "unauthorized:chat"
    finally:
        anonymous.dispose()  # Release the temporary request context, even if a check fails.
    # Read as the owner to confirm the denied request did not remove the chat.
    before = api_context.get(f"/api/messages?chatId={owned_chat}")
    assert before.status == 200
    assert before.json()["userId"] is not None
    # Now delete using the owner's authenticated context and require HTTP 200.
    response = api_context.delete(path)
    assert response.status == 200, response.text()
    assert response.json()["id"] == owned_chat
    # A final read should show no owner or messages for the removed chat.
    after = api_context.get(f"/api/messages?chatId={owned_chat}")
    assert after.status == 200
    assert after.json()["userId"] is None
    assert after.json()["messages"] == []
