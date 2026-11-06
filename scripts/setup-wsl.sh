#!/usr/bin/env bash
# One-time toolchain setup for building Allowance inside WSL Ubuntu 24.04.
# Run it yourself from Ubuntu:  bash "/mnt/l/5th semister/allowance solana/scripts/setup-wsl.sh"
# It asks for your sudo password once (system build packages).
set -euo pipefail

echo "== 1/5 system packages (needs sudo)"
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev libudev-dev llvm libclang-dev protobuf-compiler curl git

echo "== 2/5 Rust (official rustup installer)"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

echo "== 3/5 Solana CLI (official Anza installer)"
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "== 4/5 Anchor 0.32.1 via avm"
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install 0.32.1
avm use 0.32.1

echo "== 5/5 Node 22 via nvm"
curl -so- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22

# Devnet wallet for deploys (skip if you already have one)
solana config set --url devnet
[ -f "$HOME/.config/solana/id.json" ] || solana-keygen new --no-bip39-passphrase -o "$HOME/.config/solana/id.json"

echo
rustc --version; solana --version; anchor --version; node --version
echo "Done. Open a new Ubuntu terminal so PATH changes apply."
