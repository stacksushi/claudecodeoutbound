#!/usr/bin/env bash
# Release gate for the PUBLIC repo. Never pushes; it prints the push commands.
#   ./release.sh check            levels 0 and 1 (scan, syntax, frontmatter, offline tests)
#   ./release.sh zip              check, then zip only git-TRACKED files (allowlist by construction)
#   ./release.sh tag X.Y.Z        check, require a clean tree and TESTED.md review, then tag vX.Y.Z
set -euo pipefail
cd "$(dirname "$0")"
cmd="${1:-check}"

echo "== level 0: scan"
python3 tools/scan.py --all
echo "== level 0: syntax and frontmatter"
python3 -m py_compile skills/outbound-autopilot/scripts/*.py tools/scan.py && find . -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
for f in $(find skills -name '*.ts'); do node --experimental-strip-types --no-warnings --check "$f"; done
for f in skills/*/SKILL.md; do
  python3 - "$f" <<'PY'
import re, sys
t = open(sys.argv[1]).read(); d = sys.argv[1].split("/")[-2]
m = re.match(r"---\nname: (.+)\ndescription: (.+?)\n---", t, re.S)
assert m and m.group(1).strip().strip('"') == d, f"bad frontmatter: {sys.argv[1]}"
PY
done
echo "== level 1: offline tests"
node --experimental-strip-types --no-warnings --test skills/email-verification/tests/verify-routing.test.ts | grep -E "^ℹ (pass|fail)"
bash tests/selftest.sh
bash tests/scan_selftest.sh
echo "check passed"

case "$cmd" in
  check) ;;
  zip)
    mkdir -p dist && rm -f dist/claude-code-outbound.zip
    git ls-files | grep -v '^\.githooks/' | zip -q dist/claude-code-outbound.zip -@ && echo "built dist/claude-code-outbound.zip from tracked files only" ;;
  tag)
    v="${2:?usage: ./release.sh tag X.Y.Z}"
    [ -z "$(git status --porcelain)" ] || { echo "working tree not clean: commit first"; exit 1; }
    echo; echo "Review TESTED.md before tagging. Areas marked Live must have been re-run for anything you changed:"; sed -n '1,40p' TESTED.md
    [ "${RELEASE_CONFIRM_TESTED:-}" = "1" ] || { echo; echo "Set RELEASE_CONFIRM_TESTED=1 to confirm you reviewed TESTED.md"; exit 1; }
    echo "$v" > VERSION; git add VERSION; git commit -q -m "Release v$v"; git tag "v$v"
    echo "tagged v$v. Push yourself:  git push origin main && git push origin v$v" ;;
  *) echo "unknown command: $cmd"; exit 1 ;;
esac
