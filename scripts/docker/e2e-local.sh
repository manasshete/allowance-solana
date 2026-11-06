#!/usr/bin/env bash
# Full end-to-end run on a local validator: program + seed + facilitator + paid API + demo.
# Uses its own keys dir and env, so it never touches keys/ or .env.
set -u
cd /work
W=$(mktemp -d)
export KEYS_DIR="$W/keys" RPC_URL=http://localhost:8899 MERCHANTS_FILE="$W/none.json"

PROGRAM_ID=$(node -e 'console.log(require("./target/idl/allowance.json").address)')
echo "== validator with Allowance $PROGRAM_ID"
solana-test-validator --reset --quiet --ledger "$W/ledger" \
  --bpf-program "$PROGRAM_ID" target/deploy/allowance.so > "$W/validator.log" 2>&1 &
for i in $(seq 1 60); do solana cluster-version --url $RPC_URL >/dev/null 2>&1 && break; sleep 1; done
solana cluster-version --url $RPC_URL || { tail -20 "$W/validator.log"; exit 1; }

echo "== seed"
(cd "$W" && ln -s /work/node_modules node_modules 2>/dev/null; true)
npx tsx scripts/seed.ts || exit 1
set -a; . ./.env.seed; set +a
mv .env.seed "$W/env.seed"

echo "== facilitator + paid API"
(cd apps/facilitator && npx tsx src/index.ts > "$W/fac.log" 2>&1 &)
sleep 4
(cd apps/paid-api && npx tsx src/index.ts > "$W/api.log" 2>&1 &)
sleep 5

echo "== demo"
OWNER_KEYPAIR="$KEYS_DIR/owner.json" npx tsx scripts/demo.ts
status=$?

echo "== facilitator log"; grep -v ExperimentalWarning "$W/fac.log" | grep -v trace-warnings
echo "EXIT=$status"
exit $status
