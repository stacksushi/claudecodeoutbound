#!/usr/bin/env bash
# Proves the scanner blocks a fake key and a denylisted name, and passes clean text.
set -u
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/r" && cd "$T/r" && git init -q && cp "$OLDPWD/tools/scan.py" . && mkdir tools && mv scan.py tools/
export DENYLIST="$T/deny.txt" ENV_FILE="$T/none.env"; echo "acme-secret-client" > "$DENYLIST"
echo "hello world" > a.txt && git add a.txt && python3 tools/scan.py --staged >/dev/null && echo "PASS: clean file accepted" || { echo "FAIL: clean file rejected"; exit 1; }
echo "REOON_API_KEY=abcdefghijklmnopqrstuvwxyz123456" > b.txt && git add b.txt && python3 tools/scan.py --staged >/dev/null && { echo "FAIL: key not caught"; exit 1; } || echo "PASS: key-like value blocked"
git reset -q b.txt; rm b.txt; echo "contract for Acme-Secret-Client" > c.txt && git add c.txt && python3 tools/scan.py --staged >/dev/null && { echo "FAIL: denylisted name not caught"; exit 1; } || echo "PASS: denylisted name blocked"
