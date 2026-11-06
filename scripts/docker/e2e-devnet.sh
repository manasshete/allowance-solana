#!/usr/bin/env bash
# The demo on devnet against the deployed program. Keys live in keys/ (gitignored);
# the deployer funds the demo wallets so no faucet is needed.
set -u
cd /work
export RPC_URL=${RPC_URL:-https://api.devnet.solana.com} KEYS_DIR=keys MERCHANTS_FILE=keys/none.json
D=keys/deployer.json
# The demo uses its own 6-decimal test token (devnet USDC needs Circle's faucet).
# The first run creates it and remembers it in keys/demo-mint.env so reruns reuse the same vault.
DEMO_MINT=""
[ -f keys/demo-mint.env ] && . keys/demo-mint.env
export USDC_MINT="$DEMO_MINT"

for k in owner agent facilitator merchant-a merchant-b merchant-c; do
  [ -f "keys/$k.json" ] || solana-keygen new --no-bip39-passphrase --silent -o "keys/$k.json" >/dev/null
done
fund() { # key, SOL wanted
  local addr bal
  addr=$(solana-keygen pubkey "keys/$1.json")
  bal=$(solana balance "$addr" --url "$RPC_URL" | awk '{print $1}')
  if awk "BEGIN{exit !($bal < $2/2)}"; then
    solana transfer "$addr" "$2" --keypair "$D" --url "$RPC_URL" --allow-unfunded-recipient --fee-payer "$D" >/dev/null && echo "funded $1 $addr with $2 SOL"
  else echo "$1 $addr has $bal SOL"; fi
}
fund owner 0.8; fund facilitator 0.3; fund agent 0.15

echo "== seed (devnet)"
npx tsx scripts/seed.ts || exit 1
set -a; . ./.env.seed; set +a
echo "DEMO_MINT=$USDC_MINT" > keys/demo-mint.env

T=$(mktemp -d)
echo "== facilitator + paid API"
(cd apps/facilitator && npx tsx src/index.ts > "$T/fac.log" 2>&1 &)
sleep 5
(cd apps/paid-api && npx tsx src/index.ts > "$T/api.log" 2>&1 &)
sleep 6

echo "== demo"
OWNER_KEYPAIR=keys/owner.json npx tsx scripts/demo.ts
status=$?
echo "== facilitator log"; grep -v -e ExperimentalWarning -e trace-warnings "$T/fac.log"
echo "== balances"; for k in deployer owner agent facilitator; do echo "$k $(solana balance -k keys/$k.json --url $RPC_URL)"; done
echo "EXIT=$status"
exit $status
