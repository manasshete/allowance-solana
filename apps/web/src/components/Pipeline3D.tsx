"use client";

import "./three-d.css";
import { useState } from "react";
import { Card3D } from "./Card3D";

const STEPS = [
  {
    step: "01",
    title: "AI Agent Invokes Payment",
    desc: "Claude, Cursor or an autonomous agent calls the MCP tool or hits an x402 URL with a reason.",
    tag: "MCP / x402",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z" />
        <path d="M9 10h.01M15 10h.01" />
        <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
      </svg>
    ),
    color: "#ca9ff5",
  },
  {
    step: "02",
    title: "On-Chain Spending Firewall",
    desc: "The Allowance Anchor program verifies session caps, daily limits, listed contacts, and freeze switches.",
    tag: "Rule Engine",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    color: "#9945FF",
  },
  {
    step: "03",
    title: "Instant Solana Settlement",
    desc: "A pass transfers USDC from the vault to the recipient's ATA. A refusal is sealed on-chain with the exact rule.",
    tag: "ExactSvm / ATA",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: "#14F195",
  },
];

export function Pipeline3D() {
  const [activeStep, setActiveStep] = useState<number>(1);

  return (
    <div className="pipeline-3d">
      <div className="pipeline-3d__beam" aria-hidden="true">
        <div className="pipeline-3d__pulse" />
      </div>

      <div className="pipeline-3d__grid">
        {STEPS.map((s, idx) => (
          <Card3D
            key={s.step}
            className={`pipeline-node ${activeStep === idx ? "is-active" : ""}`}
            intensity={18}
          >
            <div
              className="pipeline-node__inner"
              onMouseEnter={() => setActiveStep(idx)}
            >
              <div className="pipeline-node__head">
                <div
                  className="pipeline-node__icon"
                  style={{ color: s.color, borderColor: s.color }}
                >
                  {s.icon}
                </div>
                <span className="pipeline-node__num figure">{s.step}</span>
              </div>

              <div className="pipeline-node__body">
                <span className="pipeline-node__tag" style={{ color: s.color }}>
                  {s.tag}
                </span>
                <h3 className="pipeline-node__title">{s.title}</h3>
                <p className="pipeline-node__desc">{s.desc}</p>
              </div>

              <div className="pipeline-node__indicator" style={{ background: s.color }} />
            </div>
          </Card3D>
        ))}
      </div>
    </div>
  );
}
