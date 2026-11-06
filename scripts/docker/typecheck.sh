#!/usr/bin/env bash
# Installs workspace deps (Linux node_modules volume) and type-checks every TS package.
cd /work
npm install --no-audit --no-fund --loglevel=error 2>&1 | grep -v "npm notice" | tail -5
status=0
for p in packages/client apps/facilitator apps/paid-api apps/mcp; do
  [ -f "$p/tsconfig.json" ] || continue
  out=$(cd "$p" && npx tsc --noEmit -p . 2>&1)
  if [ -n "$out" ]; then echo "== $p FAILED"; echo "$out" | head -40; status=1; else echo "== $p ok"; fi
done
echo "EXIT=$status"
