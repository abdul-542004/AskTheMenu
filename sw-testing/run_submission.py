"""Reproduce the final suite, real regression demonstration, reports and ZIP."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
if __name__ == "__main__":
    for script in ("run_all_browsers.py", "demonstrate_bug.py", "capture_report_screenshots.py", "build_submission.py"):
        print(f"Running {script}", flush=True)
        result = subprocess.run([sys.executable, script], cwd=ROOT)
        if result.returncode:
            raise SystemExit(result.returncode)
