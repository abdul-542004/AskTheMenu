#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  run_all_browsers.sh – Cross-Browser Test Runner
#  Runs the full test suite on Chromium, Firefox, and WebKit
# ═══════════════════════════════════════════════════════════════════════

set -e

cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo ""
echo "===================================================================="
echo "  AskTheMenu – Software Testing: Cross-Browser Test Suite"
echo "===================================================================="
echo "BASE_URL = $BASE_URL"
echo ""

echo "============================================================"
echo "  [1/3] Running tests on CHROMIUM..."
echo "============================================================"
pytest --browser chromium --html=reports/report_chromium.html --self-contained-html -v || true
echo ""

echo "============================================================"
echo "  [2/3] Running tests on FIREFOX..."
echo "============================================================"
pytest --browser firefox --html=reports/report_firefox.html --self-contained-html -v || true
echo ""

echo "============================================================"
echo "  [3/3] Running tests on WEBKIT..."
echo "============================================================"
pytest --browser webkit --html=reports/report_webkit.html --self-contained-html -v || true
echo ""

echo "===================================================================="
echo "  All browsers tested! Reports saved in reports/ folder:"
echo "    - reports/report_chromium.html"
echo "    - reports/report_firefox.html"
echo "    - reports/report_webkit.html"
echo "===================================================================="
