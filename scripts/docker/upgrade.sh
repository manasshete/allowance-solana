#!/usr/bin/env bash
# Upgrades the devnet program from target/deploy/allowance.so.
# The upgrade needs a temporary buffer (rent for the whole .so, refunded when it closes), so
# spare SOL from our own demo wallets is gathered into the deployer first and returned after.
set -euo pipefail
cd /work
U=${RPC_URL:-https://api.devnet.solana.com}
PID=$(solana-keygen pubkey keys/allowance-program.json)
D=keys/deployer.json
DADDR=$(solana-keygen pubkey "$D")
bal() { solana balance -k "keys/$1.json" --url "$U" | awk '{print $1}'; }

sweep() { # key, SOL to leave behind
  local amt
  amt=$(awk -v b="$(bal "$1")" -v k="$2" 'BEGIN{a=b-k; if (a>0.001) printf "%.6f", a; else print 0}')
  if [ "$amt" != "0" ]; then
    solana transfer "$DADDR" "$amt" --keypair "keys/$1.json" --fee-payer "keys/$1.json" --url "$U" --allow-unfunded-recipient >/dev/null
    echo "moved $amt SOL from $1 to the deployer"
  fi
}
sweep owner 0.05; sweep facilitator 0.04
for r in reviewer-0 reviewer-1 reviewer-2; do [ -f "keys/$r.json" ] && sweep "$r" 0.002; done
echo "deployer: $(bal deployer) SOL"

have=$(solana program show "$PID" --url "$U" --keypair "$D" | awk '/Data Length/ {print $3}')
need=$(stat -c %s target/deploy/allowance.so)
if [ "$need" -gt "$have" ]; then
  extra=$(( need - have + 1024 ))
  [ "$extra" -lt 10240 ] && extra=10240 # the loader extends by at least 10 KiB
  solana program extend "$PID" "$extra" --keypair "$D" --url "$U" >/dev/null
  echo "extended program data by $extra bytes ($have -> $(( have + extra )))"
fi

solana program deploy target/deploy/allowance.so --program-id keys/allowance-program.json \
  --keypair "$D" --url "$U" --with-compute-unit-price 10000 | tail -2

back() { # key, SOL
  solana transfer "$(solana-keygen pubkey "keys/$1.json")" "$2" --keypair "$D" --url "$U" --allow-unfunded-recipient >/dev/null
  echo "returned $2 SOL to $1"
}
back owner 0.7; back facilitator 0.25
solana program show "$PID" --url "$U" --keypair "$D" | grep -E "Last Deployed|Data Length"
for k in deployer owner facilitator agent; do echo "$k $(bal $k) SOL"; done
