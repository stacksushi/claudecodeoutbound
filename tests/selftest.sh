#!/usr/bin/env bash
# Verifies the render lint passes clean copy and catches known-bad data. Run from the repo root.
set -u
cd "$(dirname "$0")"
L=../skills/outbound-autopilot/scripts/render_lint_sl.py
python3 $L bodies.json subjects.json leads_good.json 20 >/dev/null && echo "PASS: clean copy accepted" || { echo "FAIL: clean copy rejected"; exit 1; }
python3 $L bodies.json subjects.json leads_bad.json 20 >/dev/null && { echo "FAIL: bad data not caught"; exit 1; } || echo "PASS: bad data caught (banned word, article, ALL CAPS rules)"
