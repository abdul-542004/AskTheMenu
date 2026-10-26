"""
Feature 4 – QR Code & Table Routing (E2E Tests)
================================================
Tests the QR code page and table-based routing:
accessing tables via slug, QR page display, and invalid table handling.

Tests:
  1. [Positive] QR page loads and shows table QR codes
  2. [Positive] Clicking a table link navigates to the correct chat
  3. [Negative] Accessing an invalid table slug shows an error or default state
"""

import pytest
from playwright.sync_api import Page, expect


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 – Positive: QR page loads with table codes
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_qr_page_loads_with_table_codes(page: Page):
    """
    GIVEN  a user navigates to /qr
    WHEN   the page finishes loading
    THEN   the heading mentions "QR" and at least one table card is visible
    """
    page.goto("/qr")

    heading = page.locator("h1")
    expect(heading).to_be_visible(timeout=15_000)
    heading_text = heading.text_content() or ""
    assert "QR" in heading_text, f"Heading should mention QR, got: {heading_text}"

    # Check that table cards with links exist
    table_links = page.locator("a[href*='/chat/table-']")
    expect(table_links.first).to_be_visible(timeout=10_000)
    assert table_links.count() >= 1, "QR page should display at least one table link"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 – Positive: Table link navigates to correct chat page
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_table_link_navigates_to_chat(page: Page):
    """
    GIVEN  a user is on the /qr page
    WHEN   they click the link for Table 1
    THEN   the browser navigates to /chat/table-1 and the chat input is visible
    """
    page.goto("/qr")

    table_link = page.locator("a[href='/chat/table-1']")
    expect(table_link).to_be_visible(timeout=10_000)
    table_link.click()

    # Should navigate to the chat page
    page.wait_for_url("**/chat/table-1", timeout=15_000)
    assert "/chat/table-1" in page.url

    # Chat input should be available
    input_field = page.locator("[data-testid='multimodal-input']")
    expect(input_field).to_be_visible(timeout=15_000)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 – Negative: Invalid table slug shows error or redirects
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.negative
def test_invalid_table_slug_handles_gracefully(page: Page):
    """
    GIVEN  a diner navigates to /chat/nonexistent-table-999
    WHEN   the page processes the request
    THEN   the frontend displays an 'Invalid or Inactive Table' notification card
           with navigation actions to the menu and QR directory without crashing
    """
    page.goto("/chat/nonexistent-table-999")

    # Frontend displays explicit invalid table card
    invalid_card = page.locator("[data-testid='invalid-table-card']")
    expect(invalid_card).to_be_visible(timeout=15_000)

    card_text = invalid_card.text_content() or ""
    assert "Invalid or Inactive Table" in card_text, \
        f"Expected 'Invalid or Inactive Table' in card text, got: {card_text}"
    assert "nonexistent-table-999" in card_text, \
        f"Expected table slug in card text, got: {card_text}"

    # Action links to browse menu or view QR codes are present
    menu_link = page.locator("a[href='/menu']")
    expect(menu_link.first).to_be_visible(timeout=5_000)

    qr_link = page.locator("a[href='/qr']")
    expect(qr_link.first).to_be_visible(timeout=5_000)

    # No unhandled runtime errors
    body_text = page.locator("body").text_content() or ""
    assert "Unhandled Runtime Error" not in body_text, \
        "Page should not show unhandled runtime error"

