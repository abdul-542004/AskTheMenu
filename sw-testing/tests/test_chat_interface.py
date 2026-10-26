"""
Feature 1 – Chat Interface (E2E Tests)
=======================================
Tests the core chat page at /chat/table-1: loading, sending messages,
and handling empty input.

Tests:
  1. [Positive] Chat page loads with input field and send button
  2. [Positive] User can type and send a message, receives AI response
  3. [Negative] Submitting an empty message does NOT send a request
"""

import pytest
import re
from playwright.sync_api import Page, expect


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 – Positive: Chat page loads correctly
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_chat_page_loads_with_input_and_send_button(page: Page):
    """
    GIVEN  a diner navigates to /chat/table-1
    WHEN   the page finishes loading
    THEN   the multimodal input field and send button are visible
    """
    page.goto("/chat/table-1")

    input_field = page.locator("[data-testid='multimodal-input']")
    send_button = page.locator("[data-testid='send-button']")

    expect(input_field).to_be_visible(timeout=15_000)
    expect(send_button).to_be_visible(timeout=15_000)


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 – Positive: Sending a message and receiving a response
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_send_message_and_receive_ai_response(page: Page):
    """
    GIVEN  a diner is on the chat page
    WHEN   they type "Hello" and click send
    THEN   the input clears and an assistant response appears
    """
    page.goto("/chat/table-1")

    input_field = page.locator("[data-testid='multimodal-input']")
    send_button = page.locator("[data-testid='send-button']")

    expect(input_field).to_be_visible(timeout=15_000)

    input_field.fill("Hello")
    expect(send_button).to_be_enabled(timeout=5_000)
    send_button.click()

    # Input should clear after sending
    expect(input_field).to_have_value("")

    # Wait for assistant response to appear
    assistant_msg = page.locator("[data-testid='message-assistant']").first
    expect(assistant_msg).to_be_visible(timeout=60_000)

    # Verify the response has text content
    content = assistant_msg.text_content()
    assert content is not None and len(content.strip()) > 0, \
        "Assistant response should contain text"


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 – Negative: Empty message is not sent
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.negative
def test_empty_message_is_not_sent(page: Page):
    """
    GIVEN  a diner is on the chat page with an empty input
    WHEN   they click the send button without typing anything
    THEN   no user message bubble appears and the URL does not change
    """
    page.goto("/chat/table-1")

    input_field = page.locator("[data-testid='multimodal-input']")
    send_button = page.locator("[data-testid='send-button']")

    expect(input_field).to_be_visible(timeout=15_000)

    # Ensure input is empty
    expect(input_field).to_have_value("")

    # Verify send button is disabled for empty input (negative test validation)
    expect(send_button).to_be_disabled()

    # Attempting to click with force does not trigger send
    send_button.click(force=True)
    page.wait_for_timeout(1500)

    # No user message bubble should appear
    user_messages = page.locator("[data-testid='message-user']")
    assert user_messages.count() == 0, \
        "No user message should appear when input is empty"
