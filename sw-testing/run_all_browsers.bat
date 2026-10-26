@echo off
REM ═══════════════════════════════════════════════════════════════════════
REM  run_all_browsers.bat – Cross-Browser Test Runner
REM  Runs the full test suite on Chromium, Firefox, and WebKit
REM ═══════════════════════════════════════════════════════════════════════

echo.
echo ====================================================================
echo   AskTheMenu – Software Testing: Cross-Browser Test Suite
echo ====================================================================
echo.

REM ── Ensure we're in the sw-testing directory ──────────────────────────
cd /d "%~dp0"

REM ── Check if BASE_URL is set, default to localhost:3000 ───────────────
if "%BASE_URL%"=="" set BASE_URL=http://localhost:3000

echo BASE_URL = %BASE_URL%
echo.

REM ── Run on Chromium ───────────────────────────────────────────────────
echo ============================================================
echo   [1/3] Running tests on CHROMIUM...
echo ============================================================
pytest --browser chromium --html=reports/report_chromium.html --self-contained-html -v
echo.

REM ── Run on Firefox ────────────────────────────────────────────────────
echo ============================================================
echo   [2/3] Running tests on FIREFOX...
echo ============================================================
pytest --browser firefox --html=reports/report_firefox.html --self-contained-html -v
echo.

REM ── Run on WebKit ─────────────────────────────────────────────────────
echo ============================================================
echo   [3/3] Running tests on WEBKIT...
echo ============================================================
pytest --browser webkit --html=reports/report_webkit.html --self-contained-html -v
echo.

echo ====================================================================
echo   All browsers tested! Reports saved in reports/ folder:
echo     - reports/report_chromium.html
echo     - reports/report_firefox.html
echo     - reports/report_webkit.html
echo ====================================================================
echo.
pause
