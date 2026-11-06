#!/usr/bin/env bash
# Starts the facilitator and paid API with throwaway keys and checks that a paid
# route answers 402 with terms that name our token, the merchant and the fee payer.
# Needs no devnet funds: nothing is paid.
cd /work
T=$(mktemp -d)
for k in facilitator a b c; do solana-keygen new --no-bip39-passphrase --silent -o "$T/$k.json" >/dev/null; done
export FACILITATOR_KEYPAIR="$T/facilitator.json"
export MERCHANT_A=$(solana-keygen pubkey "$T/a.json") MERCHANT_B=$(solana-keygen pubkey "$T/b.json") MERCHANT_C=$(solana-keygen pubkey "$T/c.json")

(cd apps/facilitator && npx tsx src/index.ts > "$T/fac.log" 2>&1 &)
sleep 4
(cd apps/paid-api && npx tsx src/index.ts > "$T/api.log" 2>&1 &)
sleep 5

echo "== facilitator /supported"; curl -s localhost:4020/supported; echo
echo "== GET /summary without payment"
curl -s -D "$T/h" -o "$T/b" "localhost:4021/summary?url=https://solana.com"
head -1 "$T/h"
H=$(grep -i '^payment-required:' "$T/h" | cut -d' ' -f2- | tr -d '\r')
node -e 'const j=JSON.parse(Buffer.from(process.argv[1],"base64").toString());console.log(JSON.stringify({x402Version:j.x402Version,resource:j.resource?.url,accepts:j.accepts},null,2))' "$H"
echo "== expected payTo $MERCHANT_A, feePayer $(solana-keygen pubkey $FACILITATOR_KEYPAIR)"
echo "== logs"; cat "$T/fac.log" "$T/api.log"
