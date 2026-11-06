#!/usr/bin/env bash
# SOL needed to upgrade the program vs SOL held by our devnet wallets.
cd /work
U=${RPC_URL:-https://api.devnet.solana.com}
size=$(stat -c %s target/deploy/allowance.so)
echo "program .so: $size bytes"
solana rent "$size" --url "$U"
for k in deployer owner agent facilitator reviewer-0 reviewer-1 reviewer-2; do
  [ -f "keys/$k.json" ] && echo "$k $(solana balance -k "keys/$k.json" --url "$U")"
done
