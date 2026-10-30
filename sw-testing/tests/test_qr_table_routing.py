"""Feature 4: QR directory images, table navigation and invalid-table recovery."""
import pytest
from playwright.sync_api import expect

# Group all three QR/table-link browser tests under the e2e marker.
pytestmark = pytest.mark.e2e


@pytest.mark.positive
def test_qr_page_loads_with_table_codes(page):
    # TC-10 (positive): each of the five tables should have a QR image and chat link.
    page.goto("/qr")
    expect(page.get_by_role("heading", level=1)).to_contain_text("QR Codes")
    # range(1, 6) checks tables 1 through 5; Python excludes the final value, 6.
    for number in range(1, 6):
        link = page.locator(f"a[href='/chat/table-{number}']")
        link.scroll_into_view_if_needed()
        expect(link).to_be_visible()
        img = page.get_by_role("img", name=f"QR code for Table {number}", exact=True)
        img.scroll_into_view_if_needed()
        expect(img).to_be_visible()
        # A visible image element could still be broken. Check that its image loaded.
        page.wait_for_function("img => img.complete && img.naturalWidth > 0", arg=img.element_handle())
    # The printable-sheet link should point to the site's QR sheet.
    expect(page.get_by_role("link", name="Printable Sheet")).to_have_attribute("href", "/qr/qr-sheet.html")


@pytest.mark.positive
def test_table_link_navigates_to_chat(page, base_url):
    # TC-11 (positive): clicking Table 1 should open Table 1's chat, not another table.
    page.goto("/qr")
    page.locator("a[href='/chat/table-1']").click()
    # Check the URL, editable chat input and visible table badge together.
    expect(page).to_have_url(base_url.rstrip("/") + "/chat/table-1")
    expect(page.get_by_test_id("multimodal-input")).to_be_editable()
    expect(page.get_by_test_id("table-badge")).to_contain_text("Table 1")


@pytest.mark.negative
def test_invalid_table_slug_handles_gracefully(page):
    # TC-12 (negative): an unknown table should show an error with a way to continue.
    page.goto("/chat/nonexistent-table-999")
    card = page.get_by_test_id("invalid-table-card")
    expect(card).to_be_visible()
    expect(card).to_contain_text("Invalid or Inactive Table")
    expect(card).to_contain_text("nonexistent-table-999")
    # The diner should not be able to chat against an invalid table.
    expect(page.get_by_test_id("multimodal-input")).to_have_count(0)
    # Check the QR recovery link, then actually use Browse Menu to leave the error page.
    expect(card.get_by_role("link", name="View Table QR Codes")).to_have_attribute("href", "/qr")
    card.get_by_role("link", name="Browse Menu").click()
    expect(page.get_by_role("heading", level=1)).to_have_text("Restaurant Menu")
