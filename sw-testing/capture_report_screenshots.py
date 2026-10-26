import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        print("1. Capturing Feature 1: Chat Interface...")
        page.goto("http://localhost:3000/chat/table-1")
        page.wait_for_selector("[data-testid='multimodal-input']", timeout=15000)
        time.sleep(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "feature1_chat_interface.png"))

        print("2. Capturing Feature 2: Menu Page...")
        page.goto("http://localhost:3000/menu")
        page.wait_for_selector("h1", timeout=15000)
        time.sleep(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "feature2_menu_page.png"))

        print("3. Capturing Feature 3: Kitchen Dashboard...")
        page.goto("http://localhost:3000/kitchen")
        page.wait_for_selector("h1", timeout=15000)
        time.sleep(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "feature3_kitchen_dashboard.png"))

        print("4. Capturing Feature 4: QR Table Routing...")
        page.goto("http://localhost:3000/qr")
        page.wait_for_selector("a[href*='/chat/table-']", timeout=15000)
        time.sleep(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "feature4_qr_routing.png"))

        print("5. Capturing Feature 4: Invalid Table Handling...")
        page.goto("http://localhost:3000/chat/nonexistent-table-999")
        page.wait_for_selector("[data-testid='invalid-table-card']", timeout=15000)
        time.sleep(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "feature4_invalid_table.png"))

        report_path = Path("reports/test_report.html").resolve()
        if report_path.exists():
            print("6. Capturing HTML Test Report...")
            page.goto(report_path.as_uri())
            time.sleep(1)
            page.screenshot(path=str(SCREENSHOT_DIR / "html_test_report.png"))

        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    capture_all()
