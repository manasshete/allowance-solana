#!/usr/bin/env bash
# Installs workspace deps and builds the Next.js dashboard (type-check + production build).
cd /work
npm install --no-audit --no-fund --loglevel=error 2>&1 | grep -v "npm notice" | tail -5
cd apps/web
[ -f .env.local ] || cp .env.example .env.local
npx next build 2>&1 | grep -v -E "^\s*$" | tail -80
echo "EXIT=${PIPESTATUS[0]}"
