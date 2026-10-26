"""
Intentional Bug Demonstration Test
====================================
This test is designed to FAIL on purpose by introducing a known bug.

The "bug" is: Attempting to select a model ("Llama 3.3 70B Versatile") that is
NOT in the app's model selector list (since AskTheMenu is configured for GPT-OSS only).

PURPOSE: To demonstrate that our test suite catches regressions. After
         showing the failure screenshot, the test can be corrected.

Steps to demonstrate:
  1. Run this test → it will FAIL (times out looking for the missing model)
  2. Capture the failure screenshot (auto-saved to screenshots/)
  3. Show the HTML report with the red FAIL entry
  4. Then "fix" the bug by selecting a supported model ("GPT-OSS 120B")
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.bug
@pytest.mark.e2e
def test_intentional_bug_select_unsupported_model(page: Page):
    """
    [INTENTIONAL BUG TEST]

    GIVEN  a diner is on the chat page (/chat/table-1)
    WHEN   they click the Model Selector dropdown to switch models
    THEN   they expect to find "Llama 3.3 70B Versatile" in the list

    NOTE: This test is EXPECTED TO FAIL because "Llama 3.3 70B Versatile"
          is not in the app's supported model list (the app uses GPT-OSS only).
          This demonstrates our test suite catches configuration regressions.
    """
    page.goto("/chat/table-1")

    # Locate and click the Model Selector button
    model_selector_button = page.locator("[data-testid='model-selector']")
    expect(model_selector_button).to_be_visible(timeout=15_000)
    model_selector_button.click()

    # ─── INTENTIONAL BUG ───────────────────────────────────────────────
    # The app only supports GPT-OSS models ("GPT-OSS 120B", "GPT-OSS 20B").
    # This test intentionally asserts that "Llama 3.3 70B Versatile" exists,
    # simulating a bug where code expects an unsupported or removed model.
    #
    # To fix this bug, change the search text to "GPT-OSS 120B".
    target_model_option = page.locator(
        "[role='option'], [data-slot='command-item'], [data-testid*='model-item']"
    ).filter(has_text="Llama 3.3 70B Versatile")

    expect(target_model_option).to_be_visible(timeout=5_000)
    # ───────────────────────────────────────────────────────────────────

    # Attempt to click if found (will not reach here due to expected failure)
    target_model_option.click()
