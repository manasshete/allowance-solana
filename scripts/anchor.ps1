# Runs the Anchor toolchain in the official Docker image (no local Rust/Solana/Anchor needed).
#   .\scripts\anchor.ps1 build   -> anchor build, copies target/deploy, idl, types to the host
#   .\scripts\anchor.ps1 test    -> syncs the IDL into packages/client, npm install, LiteSVM tests
#   .\scripts\anchor.ps1 shell   -> a shell in the container at the repo root
param([ValidateSet("build", "test", "shell")][string]$Task = "build")

$root = Split-Path -Parent $PSScriptRoot
$image = "solanafoundation/anchor:v0.32.1"
# Build output, cargo downloads and Linux node_modules live in Docker volumes:
# compiling on the Windows drive is several times slower.
$common = @(
  "-v", "${root}:/work",
  "-v", "${root}:/host",
  "-v", "allowance-target:/work/target",
  "-v", "allowance-cargo-registry:/root/.cargo/registry",
  "-v", "allowance-node-modules:/work/node_modules",
  "-w", "/work"
)

switch ($Task) {
  "build" { docker run --rm @common $image bash scripts/docker/build.sh }
  "test"  { docker run --rm @common $image bash -c "mkdir -p target/deploy target/idl && cp -r /host/target/deploy/. target/deploy/ && cp -r /host/target/idl/. target/idl/ && mkdir -p target/types && cp -r /host/target/types/. target/types/ && bash scripts/docker/test.sh" }
  "shell" { docker run --rm -it @common $image bash }
}
