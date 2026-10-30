"""Two real route interceptions, explicit alerts, and successful retry checks."""
import json

import pytest
from playwright.sync_api import expect

# Both tests simulate an unsuccessful response, so they share mock and negative markers.
pytestmark = [pytest.mark.mock, pytest.mark.negative]


def verify_recovery(page, status, body, alert_text):
    # Shared steps for TC-17 and TC-18; each supplies a different simulated response.
    intercepted = []

    def broken(route):
        # Save the submitted request data, then provide our response instead of the server's.
        intercepted.append(route.request.post_data_json)
        route.fulfill(status=status, content_type="text/event-stream" if status == 200 else "application/json", body=body)

    # Register the mock before opening the chat page or sending a message.
    page.route("**/api/chat", broken)
    page.goto("/chat/table-1")
    field = page.get_by_test_id("multimodal-input")
    expect(field).to_be_editable()
    field.fill("Hello")
    # Listen before clicking Send so we can inspect the response to this exact action.
    with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/api/chat")) as mocked:
        page.get_by_test_id("send-button").click()
    # Confirm our mock was used once and received the message we typed.
    assert mocked.value.status == status
    assert len(intercepted) == 1
    assert intercepted[0]["message"]["parts"][0]["text"] == "Hello"
    # The app should explain the problem and keep the input usable.
    alert = page.get_by_test_id("toast").filter(has_text=alert_text)
    expect(alert).to_be_visible()
    expect(alert).to_have_attribute("role", "alert")
    expect(field).to_be_editable()
    # Replace the failed response with a successful simulated reply for the retry.
    page.unroute("**/api/chat", broken)
    retried = []
    # The chat expects streamed events: start a message, add text, then finish it.
    parts = [{"type": "start", "messageId": "recovered-assistant"},
             {"type": "text-start", "id": "answer"},
             {"type": "text-delta", "id": "answer", "delta": "Connection restored. How can I help?"},
             {"type": "text-end", "id": "answer"},
             {"type": "finish", "finishReason": "stop"}]
    # Each event is a data: line followed by a blank line, as in a normal chat stream.
    stream = "".join(f"data: {json.dumps(part)}\n\n" for part in parts) + "data: [DONE]\n\n"

    def healthy(route):
        # Provide the valid stream and the header required by the app's chat library.
        retried.append(route.request.post_data_json)
        route.fulfill(status=200, content_type="text/event-stream", headers={"x-vercel-ai-ui-message-stream": "v1"}, body=stream)

    # Make a second send to prove the page recovers after the earlier problem.
    page.route("**/api/chat", healthy)
    field.fill("Try again")
    expect(page.get_by_test_id("send-button")).to_be_enabled()
    with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/api/chat")) as recovered:
        page.get_by_test_id("send-button").click()
    # The reply should appear, the input should clear and the input should remain editable.
    assert recovered.value.status == 200
    assert len(retried) == 1
    expect(page.get_by_test_id("message-assistant").get_by_test_id("message-content")).to_have_text("Connection restored. How can I help?")
    expect(field).to_have_value("")
    expect(field).to_be_editable()


def test_mock_empty_api_response(page):
    # TC-17: return HTTP 200 with no content and check the no-response notification.
    verify_recovery(page, 200, "", "No response was received. Please try again.")


def test_mock_server_error_response(page):
    # TC-18: return HTTP 500 with an error message and check that it is shown to the user.
    verify_recovery(page, 500, json.dumps({"error": "Internal server error"}), "Internal server error")
