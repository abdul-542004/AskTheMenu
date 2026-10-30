"""Feature 2: menu content, category navigation, and missing-route handling."""
import re

import pytest
from playwright.sync_api import expect

# Mark these as end-to-end tests because they interact with the website in a browser.
pytestmark = pytest.mark.e2e


@pytest.mark.positive
def test_menu_page_loads_with_items(page):
    # TC-04 (positive): the menu should display its heading and useful dish details.
    page.goto("/menu")
    # The intentional-bug demo changes the website heading; this expectation stays the same.
    expect(page.get_by_role("heading", level=1)).to_have_text("Restaurant Menu")
    # Each article is a dish card. Check the first card's name, PKR price and allergens.
    cards = page.locator("article")
    expect(cards.first).to_be_visible()
    expect(cards.first.locator("h3")).not_to_be_empty()
    expect(cards.first).to_contain_text(re.compile(r"PKR\s+[\d,]+"))  # For example: PKR 1,650.
    expect(cards.first).to_contain_text("Allergens:")
    # Every menu category should have a visible navigation link.
    for anchor in ("desi-cuisines", "chinese", "continental", "fusion", "staple"):
        expect(page.locator(f"a[href='#{anchor}']")).to_be_visible()


@pytest.mark.positive
def test_category_anchor_scrolls_to_section(page):
    # TC-05 (positive): category links should take the diner to the matching section.
    page.goto("/menu")
    for anchor in ("chinese", "continental", "fusion", "staple", "desi-cuisines"):
        link = page.locator(f"a[href='#{anchor}']")
        # Bring the navigation link back into view after the previous category click.
        link.scroll_into_view_if_needed()
        link.click()
        # Check both the URL fragment and the section's position on the screen.
        expect(page).to_have_url(re.compile(rf"#{anchor}$"))
        expect(page.locator(f"section#{anchor} h2")).to_be_in_viewport()


@pytest.mark.negative
def test_nonexistent_page_returns_404(page):
    # TC-06 (negative): a menu URL that does not exist should show a proper 404 page.
    response = page.goto("/menu/does-not-exist")
    # Check the server response and the message the diner actually sees.
    assert response.status == 404
    expect(page.get_by_role("heading", name="404", exact=True)).to_be_visible()
    expect(page.get_by_text("This page could not be found.", exact=True)).to_be_visible()
