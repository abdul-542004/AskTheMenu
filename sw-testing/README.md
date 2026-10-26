# AskTheMenu – Software Testing Suite (Python + Playwright)

A comprehensive test suite for the **AskTheMenu** chatbot, built with **Python**, **Playwright**, and **pytest** to fulfil the Software Testing course's Complex Engineering Activity requirements.

---

## 📋 Requirements Coverage

| Requirement | Status | Details |
|---|---|---|
| **Playwright with Python** | ✅ | All tests use `pytest-playwright` |
| **4 features × 3 E2E tests (12 total)** | ✅ | Chat, Menu, Kitchen, QR/Routing |
| **Positive + Negative mix** | ✅ | 8 positive + 4 negative E2E tests |
| **4 API tests (CRUD)** | ✅ | POST, GET, PATCH, DELETE |
| **2 Network mocking tests** | ✅ | Empty data + server error |
| **Cross-browser (Chromium, Firefox, WebKit)** | ✅ | `run_all_browsers.bat` |
| **Intentional bug + failing test** | ✅ | `test_intentional_bug.py` |
| **HTML report + screenshots** | ✅ | `pytest-html` + auto-capture on fail |

---

## 🗂️ Project Structure

```
sw-testing/
├── conftest.py                 # Shared fixtures (base_url, api_context, screenshot-on-failure)
├── pytest.ini                  # Pytest config with markers and HTML report
├── requirements.txt            # Python dependencies
├── run_all_browsers.bat        # Cross-browser runner (Windows)
├── run_all_browsers.sh         # Cross-browser runner (Linux/macOS)
├── README.md                   # This file
│
├── tests/
│   ├── __init__.py
│   │
│   │   # ── Feature E2E Tests (4 features × 3 tests = 12 tests) ──
│   ├── test_chat_interface.py      # Feature 1: Chat (2 positive, 1 negative)
│   ├── test_menu_page.py           # Feature 2: Menu (2 positive, 1 negative)
│   ├── test_kitchen_dashboard.py   # Feature 3: Kitchen (2 positive, 1 negative)
│   ├── test_qr_table_routing.py    # Feature 4: QR/Routing (2 positive, 1 negative)
│   │
│   │   # ── API CRUD Tests (4 tests) ──
│   ├── test_api_crud.py            # POST, GET, PATCH, DELETE
│   │
│   │   # ── Network Mocking Tests (2 tests) ──
│   ├── test_network_mocking.py     # Empty response + 500 error
│   │
│   │   # ── Intentional Bug Test (1 test) ──
│   └── test_intentional_bug.py     # Demonstrates test catching a bug
│
├── reports/                    # Generated HTML test reports (auto-created)
│   ├── test_report.html
│   ├── report_chromium.html
│   ├── report_firefox.html
│   └── report_webkit.html
│
└── screenshots/                # Failure screenshots (auto-created)
    └── FAIL_*.png
```

---

## 🚀 Setup Instructions

### 1. Create a Python virtual environment

```bash
cd sw-testing
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Playwright browsers

```bash
playwright install
```

### 4. Start the AskTheMenu dev server

In a separate terminal:

```bash
cd ../chatbot
pnpm dev
```

Wait until `http://localhost:3000` is accessible.

---

## ▶️ Running Tests

### Run all tests (default: Chromium)

```bash
pytest
```

### Run by category (using markers)

```bash
# Only E2E tests
pytest -m e2e

# Only API tests
pytest -m api

# Only mocking tests
pytest -m mock

# Only the intentional bug test
pytest -m bug

# Only positive tests
pytest -m positive

# Only negative tests
pytest -m negative
```

### Run on a specific browser

```bash
pytest --browser chromium
pytest --browser firefox
pytest --browser webkit
```

### Run on all 3 browsers at once

```bash
# Windows
run_all_browsers.bat

# macOS / Linux
bash run_all_browsers.sh
```

### Run with headed mode (see the browser)

```bash
pytest --headed
```

### Run against a deployed URL

```bash
set BASE_URL=https://your-deployed-url.vercel.app
pytest
```

---

## 📊 Test Reports

After running, open the HTML report:

```bash
start reports/test_report.html          # Windows
open reports/report_chromium.html       # macOS
```

Failure screenshots are auto-saved to `screenshots/FAIL_<test_name>.png`.

---

## 🐛 Intentional Bug Demonstration

The file `tests/test_intentional_bug.py` contains a test that **intentionally fails**:

- The app is configured with GPT-OSS models (`GPT-OSS 120B` and `GPT-OSS 20B`)
- The test attempts to find and select `"Llama 3.3 70B Versatile"` from the Model Selector list
- It fails because that model is not supported, demonstrating that the test suite catches configuration regressions
- When it fails, Playwright captures a full screenshot showing the open dropdown list

**To demonstrate:**
1. Run: `pytest -m bug`
2. Observe the FAIL result
3. Check `screenshots/FAIL_test_intentional_bug_select_unsupported_model_chromium_.png`
4. Show the red entry in the HTML report

---

## 📝 Test Case Summary Table

| # | Test | Feature | Type | Marker | Expected |
|---|------|---------|------|--------|----------|
| 1 | `test_chat_page_loads_with_input_and_send_button` | Chat | E2E | positive | PASS |
| 2 | `test_send_message_and_receive_ai_response` | Chat | E2E | positive | PASS |
| 3 | `test_empty_message_is_not_sent` | Chat | E2E | negative | PASS |
| 4 | `test_menu_page_loads_with_items` | Menu | E2E | positive | PASS |
| 5 | `test_category_anchor_scrolls_to_section` | Menu | E2E | positive | PASS |
| 6 | `test_nonexistent_page_returns_404` | Menu | E2E | negative | PASS |
| 7 | `test_kitchen_dashboard_loads` | Kitchen | E2E | positive | PASS |
| 8 | `test_kitchen_shows_orders_or_empty_state` | Kitchen | E2E | positive | PASS |
| 9 | `test_kitchen_handles_api_failure_gracefully` | Kitchen | E2E | negative | PASS |
| 10 | `test_qr_page_loads_with_table_codes` | QR/Routing | E2E | positive | PASS |
| 11 | `test_table_link_navigates_to_chat` | QR/Routing | E2E | positive | PASS |
| 12 | `test_invalid_table_slug_handles_gracefully` | QR/Routing | E2E | negative | PASS |
| 13 | `test_create_order_with_valid_data` | Orders API | CRUD | positive | PASS |
| 14 | `test_read_kitchen_orders` | Orders API | CRUD | positive | PASS |
| 15 | `test_update_order_status_with_invalid_status` | Orders API | CRUD | negative | PASS |
| 16 | `test_delete_chat_without_auth` | Chat API | CRUD | negative | PASS |
| 17 | `test_mock_empty_api_response` | Chat | Mock | negative | PASS |
| 18 | `test_mock_server_error_response` | Chat | Mock | negative | PASS |
| 19 | `test_intentional_bug_select_unsupported_model` | Model Selector | Bug | negative | **FAIL** |

**Total: 19 tests** (12 E2E + 4 API + 2 Mock + 1 Bug)

---

## 🔍 Features Tested vs. Not Tested

### ✅ Features Tested
1. **Chat Interface** – page load, message send/receive, empty input handling
2. **Menu Page** – item display, category navigation, 404 for invalid routes
3. **Kitchen Dashboard** – page load, order display, API error resilience
4. **QR Code & Table Routing** – QR page display, table linking, invalid slug

### ❌ Features Not Tested (with reasons)
1. **AI Response Quality** – Requires live LLM (Groq API), non-deterministic output, not suitable for automated testing
2. **Order Placement via Chat** – Requires the LLM to invoke `placeOrder` tool, which is non-deterministic
3. **File/Image Attachments** – Multimodal input exists but is secondary to core menu chat
4. **User Authentication** – Auth is bypassed in AskTheMenu MVP (redirects to guest), not a real feature
5. **Dark Mode Toggle** – Cosmetic feature, low priority for functional testing
6. **Real-time Kitchen Polling** – SWR polling tested indirectly via API mocking; full WebSocket testing out of scope
