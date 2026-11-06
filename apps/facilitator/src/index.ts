/**
 * x402 facilitator for Allowance payments.
 *
 * It is the stock @x402/svm ExactSvmScheme with smart-wallet verification on and
 * the Allowance program on the allowlist. For a transaction that calls
 * agent_pay instead of a plain token transfer, the scheme:
 *   - checks the facilitator's fee-payer key appears in no instruction,
 *   - checks compute-budget limits,
 *   - simulates the transaction (so every Allowance rule runs),
 *   - requires exactly one inner transferChecked of the price to payTo's token account,
 * then co-signs as fee payer and submits on /settle.
 *
 * Endpoints match what @x402/core's HTTPFacilitatorClient calls:
 *   GET /supported, POST /verify, POST /settle  (body: { x402Version, paymentPayload, paymentRequirements })
 */
import express from "express";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Facilitator } from "@x402/core/facilitator";
import { SOLANA_DEVNET_CAIP2, toFacilitatorSvmSigner } from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";

import { PROGRAM_ID } from "@allowance/client";
import { loadDotEnv, readKeypairBytes, rpcUrl } from "@allowance/client/env";

loadDotEnv();

const PORT = Number(process.env.FACILITATOR_PORT ?? 4020);
const keypairPath = process.env.FACILITATOR_KEYPAIR ?? "keys/facilitator.json";

const kitSigner = await createKeyPairSignerFromBytes(readKeypairBytes(keypairPath));
const signer = toFacilitatorSvmSigner(kitSigner, { defaultRpcUrl: rpcUrl() });

const facilitator = new x402Facilitator().register(
  SOLANA_DEVNET_CAIP2,
  new ExactSvmScheme(signer, undefined, {
    enableSmartWalletVerification: true,
    smartWalletAllowedPrograms: [PROGRAM_ID.toBase58()],
  }),
);

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/supported", (_req, res) => {
  res.json(facilitator.getSupported());
});

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    log("verify", result.isValid ? "valid" : `invalid: ${result.invalidReason}`);
    res.json(result);
  } catch (e) {
    log("verify", `error: ${(e as Error).message}`);
    res.status(400).json({ isValid: false, invalidReason: (e as Error).message, payer: "" });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    log("settle", result.success ? `ok ${result.transaction}` : `failed: ${result.errorReason}`);
    res.json(result);
  } catch (e) {
    log("settle", `error: ${(e as Error).message}`);
    res.status(400).json({ success: false, errorReason: (e as Error).message, transaction: "", network: SOLANA_DEVNET_CAIP2 });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, feePayer: kitSigner.address, program: PROGRAM_ID.toBase58() });
});

app.listen(PORT, () => {
  log("start", `facilitator on :${PORT}, fee payer ${kitSigner.address}, allows ${PROGRAM_ID.toBase58()}`);
});

function log(what: string, msg: string) {
  console.log(`[facilitator] ${new Date().toISOString()} ${what}: ${msg}`);
}
