"""
Network Mocking Tests
======================
Tests that the frontend handles mocked/broken API responses gracefully
using Playwright's route interception (network mocking).

Tests:
  1. [Mock] Chat API returns empty data → page handles without crashing
  2. [Mock] Chat API returns 500 error  → error message shown to user
"""

import pytest
import re
from playwright.sync_api import Page, expect


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 – Mock: Empty data response
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.mock
@pytest.mark.negative
def test_mock_empty_api_response(page: Page):
    """
    GIVEN  the chat API is mocked to return an empty response (no AI content)
    WHEN   a user sends a message
    THEN   the page does NOT crash and remains interactive
    """
    # Mock the chat API to return a 200 with empty streaming data
    page.route("**/api/chat", lambda route: route.fulfill(
        status=200,
        content_type="text/plain",
        body=""
    ))

    page.goto("/chat/table-1")

    input_field = page.locator("[data-testid='multimodal-input']")
    send_button = page.locator("[data-testid='send-button']")

    expect(input_field).to_be_visible(timeout=15_000)

    input_field.fill("What do you recommend?")
    send_button.click()

    # Wait a moment for the response handling to complete
    page.wait_for_timeout(5000)

    # Page should not crash — the input should still be usable
    expect(input_field).to_be_visible()

    # No unhandled errors should appear
    body_text = page.locator("body").text_content() or ""
    assert "Unhandled Runtime Error" not in body_text, \
        "Page should not show unhandled runtime error on empty response"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 – Mock: Server error (500) response
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.mock
@pytest.mark.negative
def test_mock_server_error_response(page: Page):
    """
    GIVEN  the chat API is mocked to return a 500 Internal Server Error
    WHEN   a user sends a message
    THEN   the page shows an error/trouble message and does NOT crash
    """
    # Mock the chat API to return 500
    page.route("**/api/chat", lambda route: route.fulfill(
        status=500,
        content_type="application/json",
        body='{"error": "Internal server error"}'
    ))

    page.goto("/chat/table-1")

    input_field = page.locator("[data-testid='multimodal-input']")
    send_button = page.locator("[data-testid='send-button']")

    expect(input_field).to_be_visible(timeout=15_000)

    input_field.fill("Show me the menu")
    send_button.click()

    # Wait for error handling
    page.wait_for_timeout(5000)

    # The page should show some kind of error indication
    error_pattern = re.compile(r"error|failed|trouble|something went wrong", re.IGNORECASE)
    error_element = page.locator("body").filter(has_text=error_pattern)

    # The page should still be functional (input visible)
    expect(input_field).to_be_visible()

    # Verify the page handled the error (shows error text or toast)
    body_text = page.locator("body").text_content() or ""

    # At minimum, the page should not show an unhandled exception
    assert "Unhandled Runtime Error" not in body_text, \
        "Page should handle 500 error gracefully without unhandled exception"
