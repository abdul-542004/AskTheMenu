"""Capture fresh feature illustrations and the measured full-suite HTML summary."""
import uuid

from playwright.sync_api import expect, sync_playwright

from support import ROOT, database_task
from conftest import BASE_URL


def main():
    output = ROOT / "screenshots"
    output.mkdir(exist_ok=True)
    marker = f"SWTEST-{uuid.uuid4()}-"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.set_default_navigation_timeout(90_000)
        expect.set_options(timeout=20_000)
        try:
            page.goto("/chat/table-1")
            expect(page.get_by_test_id("multimodal-input")).to_be_editable()
            page.screenshot(path=str(output / "feature1_chat_interface.png"))
            page.goto("/menu")
            expect(page.locator("article").first).to_be_visible()
            page.screenshot(path=str(output / "feature2_menu_page.png"))
            order = page.request.post("/api/orders", data={"tableSlug": "table-1", "items": [{"name": "Chicken Karahi", "quantity": 1}, {"name": "Garlic Naan", "quantity": 2}], "customerNote": marker + "Extra spicy please"})
            assert order.status == 201, order.text()
            page.goto("/kitchen")
            expect(page.locator(f"[data-order-id='{order.json()['orderId']}']")).to_be_visible()
            page.screenshot(path=str(output / "feature3_kitchen_dashboard.png"))
            page.goto("/qr")
            expect(page.get_by_role("heading", level=1)).to_contain_text("QR Codes")
            images = page.locator("img")
            for image in images.all():
                image.scroll_into_view_if_needed()
                page.wait_for_function("img => img.complete && img.naturalWidth > 0", arg=image.element_handle())
            page.screenshot(path=str(output / "feature4_qr_routing.png"), full_page=True)
            page.goto("/chat/nonexistent-table-999")
            expect(page.get_by_test_id("invalid-table-card")).to_be_visible()
            page.screenshot(path=str(output / "feature4_invalid_table.png"))
            page.goto((ROOT / "reports" / "test_report.html").as_uri())
            expect(page.locator(".passed").first).to_contain_text("46 Passed")
            page.screenshot(path=str(output / "html_test_report.png"))
        finally:
            database_task({"operation": "cleanupOrders", "marker": marker})
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
