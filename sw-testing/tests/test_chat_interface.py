"""Feature 1: real chat rendering, live response/persistence, blank input rejection."""
import re

import pytest
from playwright.sync_api import expect

# This marker groups all tests in this file under: pytest -m e2e.
# The page fixture gives each test a fresh browser tab. expect() waits for the UI.
pytestmark = pytest.mark.e2e


@pytest.mark.positive
def test_chat_page_loads_with_input_and_send_button(page):
    # TC-01 (positive): a diner should see the main chat controls for Table 1.
    page.goto("/chat/table-1")
    # The input should accept text, but Send should stay disabled while it is empty.
    expect(page.get_by_test_id("multimodal-input")).to_be_editable()
    expect(page.get_by_test_id("send-button")).to_be_visible()
    expect(page.get_by_test_id("send-button")).to_be_disabled()
    # Open the model selector and check both available model choices.
    selector = page.get_by_test_id("model-selector")
    expect(selector).to_contain_text("GPT-OSS 120B")
    selector.click()
    expect(page.get_by_role("option", name=re.compile(r"GPT-OSS 120B"))).to_be_visible()
    expect(page.get_by_role("option", name=re.compile(r"GPT-OSS 20B"))).to_be_visible()
    page.keyboard.press("Escape")  # Close the dropdown after checking it.


@pytest.mark.positive
def test_send_message_and_receive_ai_response(page):
    # TC-02 (positive): send a real message, receive a reply, then refresh the page.
    page.goto("/chat/table-1")
    field = page.get_by_test_id("multimodal-input")
    expect(field).to_be_editable()
    prompt = "Hello. Please reply with a brief greeting only."
    field.fill(prompt)
    # Start listening before the click so even a fast chat response is captured.
    with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/api/chat"), timeout=90_000) as sent:
        page.get_by_test_id("send-button").click()
    response = sent.value
    # HTTP 200 means the request succeeded; wait for the response stream to finish.
    assert response.status == 200, response.text()
    response.finished()
    # Sending should clear the input and add the diner's message to the conversation.
    expect(field).to_have_value("")
    expect(page.get_by_test_id("message-user")).to_contain_text(prompt)
    assistant = page.get_by_test_id("message-assistant").get_by_test_id("message-content")
    # AI wording can vary. The regex requires some text rather than an exact reply.
    expect(assistant).to_contain_text(re.compile(r"\S"), timeout=60_000)
    # Remember the table's conversation ID so we can check it survives a refresh.
    chat_id = page.evaluate("localStorage.getItem('askthemenu:table-session:table-1')")
    assert chat_id
    page.reload()
    # Both messages and the same conversation ID should still be available.
    expect(page.get_by_test_id("message-user")).to_contain_text(prompt)
    expect(page.get_by_test_id("message-assistant").get_by_test_id("message-content")).to_contain_text(re.compile(r"\S"))
    assert page.evaluate("localStorage.getItem('askthemenu:table-session:table-1')") == chat_id


@pytest.mark.negative
def test_empty_message_is_not_sent(page):
    # TC-03 (negative): blank input must not create a message or call the chat API.
    calls = []
    # Record chat POST requests so the test checks network activity as well as the UI.
    page.on("request", lambda r: calls.append(r.url) if r.method == "POST" and r.url.endswith("/api/chat") else None)
    page.goto("/chat/table-1")
    field, send = page.get_by_test_id("multimodal-input"), page.get_by_test_id("send-button")
    expect(field).to_be_editable()
    original_url = page.url
    # Check both truly empty input and input containing only spaces.
    for value in ("", "   "):
        field.fill(value)
        expect(send).to_be_disabled()
        # Try the keyboard and the button. force=True does not enable a disabled button.
        field.press("Enter")
        send.click(force=True)
    # Observe a bounded interval to detect an incorrectly scheduled send.
    page.wait_for_timeout(800)
    # Nothing should have been sent, displayed as a user bubble, or navigated away.
    assert calls == [], f"Blank input dispatched chat requests: {calls}"
    expect(page.get_by_test_id("message-user")).to_have_count(0)
    assert page.url == original_url
