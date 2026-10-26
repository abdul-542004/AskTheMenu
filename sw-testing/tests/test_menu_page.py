"""
Feature 2 – Menu Page (E2E Tests)
==================================
Tests the restaurant menu browser at /menu: loading, category navigation,
and handling a non-existent menu page.

Tests:
  1. [Positive] Menu page loads and displays restaurant items
  2. [Positive] Category anchor links scroll to correct section
  3. [Negative] Navigating to a non-existent menu subpage shows 404
"""

import pytest
from playwright.sync_api import Page, expect


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 – Positive: Menu page loads with items
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_menu_page_loads_with_items(page: Page):
    """
    GIVEN  a user navigates to /menu
    WHEN   the page finishes loading
    THEN   the heading "Restaurant Menu" is visible and menu item cards exist
    """
    page.goto("/menu")

    heading = page.locator("h1", has_text="Restaurant Menu")
    expect(heading).to_be_visible(timeout=15_000)

    # At least one article card should be rendered (menu items)
    items = page.locator("article")
    expect(items.first).to_be_visible(timeout=15_000)
    assert items.count() > 0, "Menu page should display at least one item card"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 – Positive: Category anchors navigate to sections
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.positive
def test_category_anchor_scrolls_to_section(page: Page):
    """
    GIVEN  a user is on the /menu page
    WHEN   they click the "Chinese" category anchor
    THEN   the page scrolls to the Chinese section heading
    """
    page.goto("/menu")

    # Wait for the page to load
    heading = page.locator("h1", has_text="Restaurant Menu")
    expect(heading).to_be_visible(timeout=15_000)

    # Click the Chinese category anchor
    chinese_link = page.locator("a[href='#chinese']")
    expect(chinese_link).to_be_visible(timeout=5_000)
    chinese_link.click()

    # The Chinese section heading should now be in view
    chinese_section = page.locator("section#chinese h2")
    expect(chinese_section).to_be_visible(timeout=5_000)

    # Verify the URL hash changed
    assert "#chinese" in page.url, "URL should contain #chinese after clicking anchor"


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 – Negative: Non-existent menu subpage returns 404
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.e2e
@pytest.mark.negative
def test_nonexistent_page_returns_404(page: Page):
    """
    GIVEN  a user navigates to /menu/does-not-exist
    WHEN   the server processes the request
    THEN   a 404 status or "not found" message is shown
    """
    response = page.goto("/menu/does-not-exist")

    # Next.js returns 404 for non-existent routes
    assert response is not None
    assert response.status == 404, \
        f"Expected 404 for non-existent page, got {response.status}"
