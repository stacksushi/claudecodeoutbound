#!/usr/bin/env bash
# Links every skill in ./skills into ~/.claude/skills so Claude Code can use them.
# Existing skills are never overwritten. With --relink, existing SYMLINKS are re-pointed here (real folders are never touched).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HOME/.claude/skills"
for d in "$here"/skills/*/; do
  n="$(basename "$d")"
  dest="$HOME/.claude/skills/$n"
  if [ -L "$dest" ] && [ "${1:-}" = "--relink" ]; then rm "$dest" && ln -s "${d%/}" "$dest" && echo "relinked: $n"
  elif [ -e "$dest" ]; then echo "skip (exists): $n (use --relink to re-point a symlink here)"; else ln -s "${d%/}" "$HOME/.claude/skills/$n" && echo "linked: $n"; fi
done
[ -f "$here/.env" ] || { cp "$here/.env.example" "$here/.env"; echo "created .env from .env.example, fill in your keys"; }
echo "Done. Start a new Claude Code session and run /outbound-autopilot"
