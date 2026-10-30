"""Fixture setup/cleanup; business operations are exercised through HTTP/UI tests."""
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
APP_DIR = Path(os.getenv("ASKTHEMENU_APP_DIR", str(ROOT.parent / "chatbot")))


def database_task(payload):
    # Use the app's Node database helper only for preparing and cleaning test data.
    # The API test actions themselves still go through the website's HTTP endpoints.
    result = subprocess.run(
        ["node", str(ROOT / "scripts" / "database-fixtures.mjs")], cwd=APP_DIR,
        input=json.dumps(payload), text=True, capture_output=True, timeout=60,
    )
    assert result.returncode == 0, f"Database fixture failed: {result.stderr.strip()}"
    return json.loads(result.stdout)


def kitchen_order(api_context, order_id):
    # Fetch the real kitchen API and require a successful response containing a list.
    response = api_context.get("/api/orders/kitchen")
    assert response.status == 200, response.text()
    body = response.json()
    assert isinstance(body["orders"], list)
    # Return only the order requested by the test, not another existing order.
    return next(order for order in body["orders"] if order["id"] == order_id)
