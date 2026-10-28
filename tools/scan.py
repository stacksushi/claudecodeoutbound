#!/usr/bin/env python3
"""Secret and client-data scan. Prints file and reason only, never the matched text.
Usage: python3 tools/scan.py --staged | --all
Optional inputs (never committed):
  DENYLIST  path to a file of client/agency names, one per line (default: ../outbound-private/.release-denylist if present)
  ENV_FILE  path to a .env whose key values must never appear in files (default: ../outbound-private/.env if present)
"""
import os, re, subprocess, sys

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip() if os.path.isdir(".git") or subprocess.call(["git", "rev-parse"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL) == 0 else os.getcwd()
os.chdir(root)
mode = sys.argv[1] if len(sys.argv) > 1 else "--all"

def files():
    if mode == "--staged":
        out = subprocess.check_output(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"], text=True)
        return [f for f in out.splitlines() if f]
    out = []
    for r, ds, fs in os.walk("."):
        ds[:] = [d for d in ds if d not in (".git", "node_modules", "__pycache__")]
        out += [os.path.join(r, f)[2:] for f in fs]
    return out

def load_lines(path):
    if path and os.path.exists(path):
        return [l.strip() for l in open(path, errors="ignore") if l.strip() and not l.startswith("#")]
    return []

denylist_path = os.environ.get("DENYLIST") or os.path.join("..", "outbound-private", ".release-denylist")
env_path = os.environ.get("ENV_FILE") or os.path.join("..", "outbound-private", ".env")
deny = [d.lower() for d in load_lines(denylist_path)]
env_vals = set()
for l in load_lines(env_path):
    if "=" in l:
        v = l.split("=", 1)[1].strip().strip("'\"")
        if len(v) >= 8: env_vals.add(v)

patterns = [
    (r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{24,}", "secret-like assignment"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key block"),
    (r"\b(apify_api_|ghp_|gho_|xox[bp]-|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})", "known token prefix"),
]
bad = []
for f in files():
    if f in ("tools/scan.py", "tests/scan_selftest.sh") or f.endswith((".zip", ".png", ".jpg")): continue  # the scanner and its own fake-key test
    try: t = open(f, errors="ignore").read()
    except Exception: continue
    low = t.lower()
    for pat, why in patterns:
        if re.search(pat, t): bad.append((f, why))
    for v in env_vals:
        if v in t: bad.append((f, "exact value from your private .env"))
    for d in deny:
        if d in low: bad.append((f, "denylisted name (see private denylist)"))
    for m in re.finditer(r"\b[A-Za-z0-9]{32,}\b", t):
        s = m.group(0)
        if re.search(r"\d", s) and re.search(r"[A-Za-z]", s) and not re.fullmatch(r"[0-9a-f]{40}", s): bad.append((f, "long token-like string")); break
print(f"scan {mode}: {len(files())} files, denylist={len(deny)} names, env values={len(env_vals)}")
if bad:
    for f, why in sorted(set(bad)): print(f"  BLOCKED {f}: {why}")
    sys.exit(1)
print("  clean")
