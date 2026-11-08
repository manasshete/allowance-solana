import type { CSSProperties } from "react";

/** Payments drifting around the vault: green ones settle, gold ones bounce off a rule. Pure CSS motion. */
const CHIPS = [
  { kind: "ok", top: "8%", left: "4%", label: "Paid", amt: "0.01", note: "summarize example.com", d: 0 },
  { kind: "no", top: "18%", left: "62%", label: "Refused", amt: "0.50", note: "OverRequestCap", d: 1.2 },
  { kind: "ok", top: "70%", left: "66%", label: "Paid", amt: "0.50", note: "on approval", d: 2.1 },
  { kind: "no", top: "78%", left: "2%", label: "Refused", amt: "0.01", note: "Frozen", d: 0.6 },
] as const;

export function HeroVisual() {
  return (
    <div className="hv" aria-hidden="true">
      <div className="hv__parallax">
        <div className="hv__halo" />
        <svg className="hv__gauge" viewBox="0 0 400 400">
          <defs>
            <linearGradient id="hv-ramp" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="var(--color-purple)" />
              <stop offset="1" stopColor="var(--color-green)" />
            </linearGradient>
          </defs>
          <circle className="hv__ring hv__ring--outer" cx="200" cy="200" r="186" />
          <circle className="hv__ring hv__ring--dash" cx="200" cy="200" r="160" />
          <circle className="hv__track" cx="200" cy="200" r="128" />
          <circle className="hv__arc" cx="200" cy="200" r="128" />
          <circle className="hv__ring" cx="200" cy="200" r="96" />
        </svg>
        <div className="hv__core">
          <span className="hv__label">Daily cap</span>
          <span className="hv__figure">
            0.51<small>/ 1.00</small>
          </span>
          <span className="hv__unit">USDC spent today</span>
        </div>
        <span className="hv__orbit hv__orbit--a">
          <span className="hv__dot hv__dot--ok" />
        </span>
        <span className="hv__orbit hv__orbit--b">
          <span className="hv__dot hv__dot--no" />
        </span>
      </div>
      {CHIPS.map((c) => (
        <div
          key={c.note}
          className={`hv__chip hv__chip--${c.kind}`}
          style={{ top: c.top, left: c.left, "--d": `${c.d}s` } as CSSProperties}
        >
          <span className="hv__chip-top">
            <strong>{c.label}</strong>
            <span className="num">{c.amt} USDC</span>
          </span>
          <span className="hv__chip-note">{c.note}</span>
        </div>
      ))}
    </div>
  );
}
