// Copies the IDL and TS types from `anchor build` into packages/client,
// so the MCP server, facilitator and web app import one source.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "packages/client/src/idl");
mkdirSync(out, { recursive: true });

for (const [from, to] of [
  ["target/idl/allowance.json", "allowance.json"],
  ["target/types/allowance.ts", "allowance.ts"],
]) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.error(`missing ${from}: run anchor build first`);
    process.exit(1);
  }
  copyFileSync(src, join(out, to));
  console.log(`copied ${from} -> packages/client/src/idl/${to}`);
}
