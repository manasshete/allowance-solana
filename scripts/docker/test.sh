#!/usr/bin/env bash
cd /work
node scripts/sync-idl.mjs
echo "== npm install"
npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -5
echo "== tests"
npx tsx --test tests/allowance.test.ts 2>&1 | tail -120
echo "EXIT=${PIPESTATUS[0]}"
