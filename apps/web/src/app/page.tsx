import Link from "next/link";

import { Card3D } from "@/components/Card3D";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { DEMO_OWNER } from "@/lib/config";

/** The agent_pay transactions of the devnet demo run (scripts/demo.ts against the deployed program). */
const DEMO_RUN = [
  ["Summarize example.com for the user", "0.01", "Paid", ""],
  ["Full premium report for the quarterly review", "0.50", "Refused", "OverRequestCap"],
  ["The same report, after the owner approved it", "0.50", "Paid", "on approval"],
  ["Pull data from an unknown provider", "0.01", "Refused", "ReputationAccountMissing"],
  ["Try while frozen", "0.01", "Refused", "Frozen"],
] as const;

/** The three things that happen to every payment, in order (the facts the 3D pipeline cards carried). */
const FLOW = [
  ["Your agent asks to pay", "Claude, Cursor or any MCP client calls a paid x402 API, or pays a contact, and gives a reason."],
  ["The program checks the session", "agent_pay checks the caps, the expiry, the merchant, its reputation and the freeze switch."],
  ["The chain answers", "A yes moves USDC from your vault to the merchant. A no lands on-chain with the rule that fired."],
] as const;

const REFUSALS = [
  ["OverRequestCap", "The API costs 0.50; the session allows 0.05 per request."],
  ["LowReputation", "The merchant's Agent Registry score is below your minimum."],
  ["OverDailyCap", "Today's spending would pass the session's daily cap."],
  ["Frozen", "You hit Freeze all. Every session stops at once."],
] as const;

export default function Landing() {
  return (
    <>
      <TopBar />
      <main className="container">
        <section className="hero hero--split">
          <div className="hero__copy">
            <h1>Give your agent a budget the chain enforces</h1>
            <p className="lead">Caps, merchants and a kill switch live in a Solana program, not on a server.</p>
            <div className="hero__actions">
              <Link className="btn btn--primary" href="/app">
                Launch app
              </Link>
              <Link className="btn btn--ghost" href="/how-it-works">
                How it works
              </Link>
            </div>
          </div>

          <Card3D className="hero__board-wrap" intensity={12}>
            <figure className="board hero__board" data-ui>
              <div className="board__head">
                <div>
                  <h2>What the chain said</h2>
                  <p className="board__sub">Five agent payments from the devnet demo run, newest last.</p>
                </div>
              </div>
              <table className="feed">
                <thead>
                  <tr>
                    <th scope="col">Payment</th>
                    <th scope="col" className="r">
                      USDC
                    </th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_RUN.map(([reason, amount, result, rule]) => (
                    <tr key={reason + rule} className={result === "Refused" ? "is-refused" : ""}>
                      <td data-label="Payment">{reason}</td>
                      <td className="num r figure" data-label="USDC">
                        {amount}
                      </td>
                      <td data-label="Result">
                        <strong>{result}</strong>
                        {rule && <span className="rule">{rule}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <figcaption className="board__sub">
                <Link href={`/app?view=${DEMO_OWNER}`}>Open the demo vault read-only</Link>
              </figcaption>
            </figure>
          </Card3D>
        </section>

        <section className="section" aria-labelledby="pay-h">
          <h2 id="pay-h">How a payment is checked</h2>
          <ol className="flow">
            {FLOW.map(([title, text]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="no-h">
          <h2 id="no-h">What a refusal looks like</h2>
          <div className="refusals">
            {REFUSALS.map(([code, text]) => (
              <Card3D key={code} intensity={14} glare={false}>
                <div className="refusal">
                  <code>{code}</code>
                  <span>{text}</span>
                </div>
              </Card3D>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
