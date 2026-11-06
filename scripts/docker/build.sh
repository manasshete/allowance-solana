#!/usr/bin/env bash
# Builds inside solanafoundation/anchor:v0.32.1. cargo-build-sbf ships Cargo 1.84,
# which can't parse crates on edition 2024, so pin those to older releases.
cd /work
pin() { cargo update -p "$1" --precise "$2" >/dev/null 2>&1 && echo "pinned $1 $2" || echo "skip $1 (not in lock or no match)"; }
pin blake3 1.8.2
pin indexmap 2.11.4
pin toml_edit 0.22.27
pin toml_datetime 0.6.11
pin zeroize 1.8.1

echo "== edition-2024 crates still in Cargo.lock"
cargo metadata --format-version 1 --locked 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);for(const p of m.packages)if(p.edition==="2024")console.log(p.name,p.version)})'

echo "== anchor build"
anchor build 2>&1 | grep -v -E '^\s*(Compiling|Downloaded|Downloading)'
status=${PIPESTATUS[0]}
echo "EXIT=$status"
if [ "$status" = 0 ]; then
  mkdir -p /host/target && cp -r target/deploy target/idl target/types /host/target/
  ls -la /host/target/deploy /host/target/idl
fi
