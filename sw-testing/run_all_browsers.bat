@echo off
cd /d "%~dp0"
if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" run_all_browsers.py %*
) else (
    python run_all_browsers.py %*
)
exit /b %errorlevel%
