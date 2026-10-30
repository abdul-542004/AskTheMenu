#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x venv/bin/python ]]; then
  exec venv/bin/python run_all_browsers.py "$@"
else
  exec python3 run_all_browsers.py "$@"
fi
