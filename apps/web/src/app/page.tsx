import Link from "next/link";

import { Footer } from "@/components/Footer";
import { HeroVisual } from "@/components/HeroVisual";
import { CountUp, Marquee, SplitWords } from "@/components/Motion";
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

/** The layers of the infrastructure, bottom to top. */
const STACK = [
  ["Vault", "A program-owned wallet", "One vault per owner, held by the Allowance program on Solana. Only your Phantom wallet can withdraw; agents never hold your keys."],
  ["Session keys", "One key per agent", "Each agent gets its own session: per-request and daily caps, listed merchants, a reputation floor and an expiry. Revoke one without touching the rest."],
  ["MCP server", "The agent's interface", "Claude, Cursor or any MCP client gets wallet tools: check its allowance, pay a person by name, pay an x402 API, ask you for approval."],
  ["Policy engine", "Enforced on-chain", "agent_pay checks every rule inside the transaction. Over-cap requests wait for your approval, and one switch freezes every agent at once."],
] as const;

const TOOLS = ["get_allowance", "transfer", "pay_x402", "request_approval", "check_approval", "check_merchant", "get_history"];

/** The three things that happen to every payment, in order. */
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

const CODES = [
  "Frozen",
  "Revoked",
  "Expired",
  "OverRequestCap",
  "OverDailyCap",
  "OverMerchantCap",
  "NotListed",
  "LowReputation",
  "OverOtherCap",
  "ReasonMissing",
  "BadReputationAccount",
  "ConstraintAssociated",
];

const STATS = [
  { to: 7, label: "wallet tools for any MCP agent", suffix: "" },
  { to: 12, label: "rules checked on every payment", suffix: "" },
  { to: 1, label: "switch freezes every agent", suffix: "" },
  { to: 0, label: "servers hold your keys", suffix: "" },
] as const;

export default function Landing() {
  return (
    <>
      <TopBar />
      <main id="main">
        <section className="hero2">
          <div className="container hero2__inner">
            <div className="hero2__copy">
              <span className="eyebrow enter" style={{ "--d": "0ms" } as React.CSSProperties}>
                <span className="live-dot" aria-hidden="true" /> Agentic wallet infrastructure on Solana
              </span>
              <SplitWords
                className="hero2__title"
                text="Wallets for AI agents, with rules the chain enforces"
                accent={["Wallets", "chain"]}
                delay={120}
              />
              <p className="hero2__lead enter" style={{ "--d": "620ms" } as React.CSSProperties}>
                Allowance gives every agent its own spending key on a vault you control. Agents pay APIs over x402 and people by
                name through MCP; caps, merchants, approvals and a kill switch are enforced by a Solana program, not a server.
              </p>
              <div className="hero__actions enter" style={{ "--d": "760ms" } as React.CSSProperties}>
                <Link className="btn btn--primary btn--lg btn--glow" href="/app">
                  Launch app <span className="btn__arrow" aria-hidden="true">→</span>
                </Link>
                <Link className="btn btn--ghost btn--lg" href={`/app?view=${DEMO_OWNER}`}>
                  View the demo vault
                </Link>
              </div>
            </div>
            <div className="hero2__visual enter" style={{ "--d": "300ms" } as React.CSSProperties}>
              <HeroVisual />
            </div>
          </div>
          <a className="scroll-cue" href="#how" aria-label="Scroll to how a payment is checked">
            <span />
          </a>
        </section>

        <div className="band" aria-label="Rules that can refuse a payment">
          <Marquee speed={48}>
            {CODES.map((c) => (
              <span key={c} className="band__item">
                <code>{c}</code>
              </span>
            ))}
          </Marquee>
        </div>

        <section className="container stats-band" aria-label="Allowance in numbers">
          <dl data-stagger>
            {STATS.map((s) => (
              <div key={s.label} className="bigstat spot">
                <dt>{s.label}</dt>
                <dd>
                  <CountUp to={s.to} suffix={s.suffix} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="stack" className="container section2" aria-labelledby="stack-h">
          <header className="section2__head" data-reveal>
            <span className="eyebrow">The infrastructure</span>
            <h2 id="stack-h">Everything an agent needs to hold and spend money</h2>
            <p className="muted">
              A wallet, a key per agent, a tool interface and a policy engine. You stay the owner; the agent only ever gets a
              capped session.
            </p>
          </header>
          <ol className="stack" data-stagger>
            {STACK.map(([name, tag, text], i) => (
              <li key={name} className="stack__layer spot">
                <span className="stack__n num">0{i + 1}</span>
                <div className="stack__copy">
                  <h3>{name}</h3>
                  <span className="stack__tag">{tag}</span>
                </div>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <div className="tools" data-reveal>
            <span className="tools__label">MCP tools your agent gets</span>
            <ul data-stagger>
              {TOOLS.map((t) => (
                <li key={t}>
                  <code>{t}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="container section2" aria-labelledby="pay-h">
          <header className="section2__head" data-reveal>
            <span className="eyebrow">How it works</span>
            <h2 id="pay-h">How an agent payment is checked</h2>
            <p className="muted">Three steps, every time, in one Solana transaction. Nothing to trust in between.</p>
          </header>
          <ol className="flow2" data-stagger>
            {FLOW.map(([title, text], i) => (
              <li key={title} className="flow2__step spot">
                <span className="flow2__n num">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="container section2 section2--split" aria-labelledby="board-h">
          <header className="section2__head" data-reveal>
            <span className="eyebrow">Live on devnet</span>
            <h2 id="board-h">What the chain said</h2>
            <p className="muted">
              Five agent payments from the devnet demo run, newest last. Every refusal is a real failed transaction that names
              its rule.
            </p>
            <Link className="btn btn--ghost" href={`/app?view=${DEMO_OWNER}`}>
              Open the demo vault read-only <span className="btn__arrow" aria-hidden="true">→</span>
            </Link>
          </header>
          <figure className="board board--glass spot" data-reveal="scale">
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
              <tbody data-stagger>
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
          </figure>
        </section>

        <section id="refusals" className="container section2" aria-labelledby="no-h">
          <header className="section2__head" data-reveal>
            <span className="eyebrow eyebrow--gold">Refusals</span>
            <h2 id="no-h">What a refusal looks like</h2>
            <p className="muted">A no is never a timeout or a vague error. It is a rule with a name.</p>
          </header>
          <div className="refusals" data-stagger>
            {REFUSALS.map(([code, text]) => (
              <div key={code} className="refusal">
                <code>{code}</code>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="container cta" aria-labelledby="cta-h">
          <div className="cta__panel spot" data-reveal="scale">
            <h2 id="cta-h">Give your agent a wallet it can&apos;t misuse</h2>
            <p className="muted">Create a vault, fund it, and issue your agent a capped session key in under a minute.</p>
            <div className="hero__actions">
              <Link className="btn btn--primary btn--lg btn--glow" href="/app">
                Launch app <span className="btn__arrow" aria-hidden="true">→</span>
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/how-it-works">
                Read the rules
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
