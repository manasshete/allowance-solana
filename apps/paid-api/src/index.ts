/**
 * Demo x402 API for the Allowance video.
 *
 * | Route                | Price | payTo       | Shows                                   |
 * | GET /summary?url=    | 0.01  | Merchant A  | happy path (listed merchant)            |
 * | GET /premium-report  | 0.50  | Merchant A  | OverRequestCap, then the approval flow  |
 * | GET /market-data     | 0.01  | Merchant B  | unlisted, passes the reputation gate    |
 * | GET /sketchy-data    | 0.01  | Merchant C  | unlisted, LowReputation                 |
 *
 * Prices are in the vault's token (USDC_MINT), 6 decimals. Payment is verified
 * and settled by apps/facilitator.
 */
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { SOLANA_DEVNET_CAIP2 } from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/server";

import { parseUsdc } from "@allowance/client";
import { loadDotEnv, required, usdcMint } from "@allowance/client/env";

import { summarize } from "./summarize";

loadDotEnv();

const PORT = Number(process.env.PAID_API_PORT ?? 4021);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4020";
const MINT = usdcMint().toBase58();

const merchant = { A: required("MERCHANT_A"), B: required("MERCHANT_B"), C: required("MERCHANT_C") };

const price = (usdc: string) => ({ asset: MINT, amount: parseUsdc(usdc).toString() });
const accepts = (usdc: string, payTo: string) => [
  { scheme: "exact", network: SOLANA_DEVNET_CAIP2 as `${string}:${string}`, price: price(usdc), payTo, maxTimeoutSeconds: 120 },
];

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(
  SOLANA_DEVNET_CAIP2,
  new ExactSvmScheme(),
);

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /summary": { accepts: accepts("0.01", merchant.A), description: "Three-line summary of a web page" },
      "GET /premium-report": { accepts: accepts("0.50", merchant.A), description: "Premium market report" },
      "GET /market-data": { accepts: accepts("0.01", merchant.B), description: "Market data from Merchant B" },
      "GET /sketchy-data": { accepts: accepts("0.01", merchant.C), description: "Data from Merchant C" },
    },
    resourceServer,
  ),
);

app.get("/summary", async (req, res) => {
  const url = String(req.query.url ?? "");
  try {
    res.json({ url, ...(await summarize(url)) });
  } catch (e) {
    res.status(422).json({ error: (e as Error).message });
  }
});

app.get("/premium-report", (_req, res) => {
  res.json({
    title: "Premium report (demo)",
    body: "Sample content for the demo. The point of this route is its 0.50 price, above the session's per-request cap.",
  });
});

app.get("/market-data", (_req, res) => {
  res.json({ source: "Merchant B (demo)", note: "Sample data; the point is that an unlisted merchant passed the reputation gate." });
});

app.get("/sketchy-data", (_req, res) => {
  res.json({ source: "Merchant C (demo)", note: "You should never see this: Merchant C is below the reputation minimum." });
});

app.get("/", (_req, res) => {
  res.json({
    routes: { "/summary?url=": "0.01", "/premium-report": "0.50", "/market-data": "0.01", "/sketchy-data": "0.01" },
    asset: MINT,
    network: SOLANA_DEVNET_CAIP2,
    facilitator: FACILITATOR_URL,
  });
});

app.listen(PORT, () => console.log(`[paid-api] on :${PORT}, facilitator ${FACILITATOR_URL}, asset ${MINT}`));
