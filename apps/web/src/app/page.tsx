import Link from "next/link";

import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";

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
        <section className="hero">
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
        </section>

        <section className="section" aria-labelledby="pay-h">
          <h2 id="pay-h">How a payment is checked</h2>
          <div className="steps">
            <div className="step">
              <span className="figure">1</span>
              <h3>Your agent hits a paid API</h3>
              <p>The API answers HTTP 402 with a price, a token and who to pay.</p>
            </div>
            <div className="step">
              <span className="figure">2</span>
              <h3>It asks the program to pay</h3>
              <p>agent_pay checks the session: caps, expiry, merchant, reputation, the freeze switch.</p>
            </div>
            <div className="step">
              <span className="figure">3</span>
              <h3>The chain says yes or no</h3>
              <p>A yes moves USDC from your vault to the merchant. A no lands on-chain with the rule that fired.</p>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="no-h">
          <h2 id="no-h">What a refusal looks like</h2>
          <div className="refusals">
            {REFUSALS.map(([code, text]) => (
              <div className="refusal" key={code}>
                <code>{code}</code>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
