import type { Metadata } from "next";

import { explorerAddress, PROGRAM_ID } from "@allowance/client";

import { Footer } from "@/components/Footer";
import { SplitWords } from "@/components/Motion";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Allowance's agentic wallet works: the vault, agent session keys, the MCP server and the rules the program enforces on every payment.",
};

const PARTS = [
  ["Vault", "A program-owned token account per owner. Only the owner's wallet can deposit, withdraw, freeze or unfreeze."],
  ["Agent session", "One per agent key: per-request and daily caps, listed merchants with their own caps, a reputation floor for everyone else, and an expiry. Revocable at any time."],
  ["MCP server", "Runs beside Claude, Cursor or any MCP client and gives the agent wallet tools: get_allowance, transfer, pay_x402, request_approval, check_approval, check_merchant, get_history."],
  ["Approvals", "A payment over the per-request cap becomes an on-chain request. You approve or reject it here; an approved one can be paid exactly once."],
] as const;

const RULES = [
  ["Vault not frozen", "Frozen"],
  ["Session not revoked", "Revoked"],
  ["Session not expired", "Expired"],
  ["Amount above zero, a reason of 1 to 200 bytes", "ZeroAmount, ReasonMissing, ReasonTooLong"],
  ["At or under the per-request cap, unless you approved this exact payment", "OverRequestCap"],
  ["Today's total within the daily cap (resets every 24 hours)", "OverDailyCap"],
  ["A listed merchant within its own daily cap", "OverMerchantCap"],
  ["Unlisted merchants allowed at all", "NotListed"],
  ["Unlisted merchant's Agent Registry accounts passed, genuine and theirs", "ReputationAccountMissing, BadReputationAccount"],
  ["Unlisted merchant's reputation at or above your minimum", "LowReputation"],
  ["Unlisted merchants within their shared daily cap", "OverOtherCap"],
  ["Money only lands in the merchant's own token account", "ConstraintAssociated"],
] as const;

const SIGNERS = [
  ["You (Phantom)", "Create the vault, deposit, withdraw, create and revoke sessions, approve or reject requests, freeze and unfreeze"],
  ["The agent key (MCP server)", "agent_pay and request_approval only. A leaked key can spend at most what the session allows"],
  ["The x402 facilitator", "Pays the network fee for a payment it settles. It can't be an authority on anything"],
] as const;

export default function HowItWorks() {
  return (
    <>
      <TopBar />
      <main id="main" className="container page page--public">
        <div className="pagehead pagehead--hero">
          <div>
            <span className="eyebrow enter">Agentic wallet infrastructure</span>
            <SplitWords text="How it works" accent={["works"]} />
            <p className="muted enter" style={{ "--d": "360ms" } as React.CSSProperties}>
              Program{" "}
              <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
                {PROGRAM_ID.toBase58()}
              </a>{" "}
              on devnet
            </p>
          </div>
        </div>

        <section className="col well well--glass" data-reveal aria-labelledby="parts-h">
          <h2 id="parts-h">The pieces</h2>
          <p className="muted">Allowance is a wallet built for agents: you own the money, each agent gets a key with limits.</p>
          <table className="table">
            <tbody data-stagger>
              {PARTS.map(([part, what]) => (
                <tr key={part}>
                  <td data-label="Piece">
                    <strong>{part}</strong>
                  </td>
                  <td data-label="What it does">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="col well well--glass" data-reveal aria-labelledby="rules-h">
          <h2 id="rules-h">What agent_pay checks, in order</h2>
          <p className="muted">Each rule has its own error, so a refusal names the rule that fired.</p>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Refused with</th>
              </tr>
            </thead>
            <tbody data-stagger>
              {RULES.map(([rule, code]) => (
                <tr key={rule}>
                  <td data-label="Rule">{rule}</td>
                  <td data-label="Refused with">
                    <code>{code}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="col well well--glass" data-reveal aria-labelledby="flow-h">
          <h2 id="flow-h">A paid API call</h2>
          <pre className="logs">{`Claude -> MCP server -> GET paid API -> 402 (price, token, payTo, fee payer)
MCP server builds agent_pay(price, reason) to payTo, signs as the agent
  simulate: refused? the same instruction is sent anyway, lands as a failed tx with the rule
  else:     GET again with PAYMENT-SIGNATURE -> facilitator verifies (simulates every rule),
            co-signs as fee payer, submits -> USDC moves vault -> merchant`}</pre>
        </section>

        <section className="col well well--glass" data-reveal aria-labelledby="sign-h">
          <h2 id="sign-h">Who signs what</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Signer</th>
                <th scope="col">Can</th>
              </tr>
            </thead>
            <tbody data-stagger>
              {SIGNERS.map(([who, can]) => (
                <tr key={who}>
                  <td data-label="Signer">
                    <strong>{who}</strong>
                  </td>
                  <td data-label="Can">{can}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="col well well--glass" data-reveal aria-labelledby="limit-h">
          <h2 id="limit-h">Known limits</h2>
          <p>
            Only x402 facilitators that verify program payments (the @x402/svm smart-wallet mode, with Allowance allowed) can
            settle these payments. Reasons are public on-chain, so an agent should never put secrets in one.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
