"""Run the required suite once across Chromium, Firefox, and WebKit."""
import subprocess
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent

if __name__ == "__main__":
    (ROOT / "reports").mkdir(exist_ok=True)
    with (ROOT / "reports" / "full_suite.log").open("w", encoding="utf-8") as log:
        command = [sys.executable, "-m", "pytest", "--browser", "chromium",
                   "--browser", "firefox", "--browser", "webkit",
                   "--junitxml=reports/full_suite.xml", "--tb=short", *sys.argv[1:]]
        process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                   env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        for line in process.stdout:
            print(line, end="", flush=True)
            log.write(line)
        raise SystemExit(process.wait())
