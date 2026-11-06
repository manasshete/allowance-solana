"use client";

import { useState, type ReactNode } from "react";

import { explorerAddress, explorerTx, shortKey } from "@allowance/client";

import { ratio } from "@/lib/format";

export function Meter({ label, spent, cap, text }: { label: string; spent: { toString(): string }; cap: { toString(): string }; text: string }) {
  const r = ratio(spent, cap);
  return (
    <div className="meter">
      <div className="meter__label">
        <span>{label}</span>
        <span className="num">{text}</span>
      </div>
      <div className="bar" role="img" aria-label={`${label}: ${text}`}>
        <span style={{ transform: `scaleX(${r})` }} />
      </div>
    </div>
  );
}

export function TxLink({ sig, children }: { sig: string; children?: ReactNode }) {
  return (
    <a className="tx" href={explorerTx(sig)} target="_blank" rel="noreferrer">
      {children ?? "Explorer"}
    </a>
  );
}

export function Addr({ value, label, link = true }: { value: string; label?: string | null; link?: boolean }) {
  const text = label ?? shortKey(value);
  return link ? (
    <a className="addr" href={explorerAddress(value)} target="_blank" rel="noreferrer" title={value}>
      {text}
    </a>
  ) : (
    <span className="addr" title={value}>
      {text}
    </span>
  );
}

export function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--text"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** A destructive or irreversible action asks once, inline, before it signs. */
export function ConfirmInline({
  label,
  confirmLabel,
  message,
  onConfirm,
  busy,
  danger = false,
}: {
  label: string;
  confirmLabel: string;
  message: ReactNode;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={`btn ${danger ? "btn--danger" : "btn--ghost"} btn--block`} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  return (
    <div className={`confirm${danger ? " confirm--danger" : ""}`}>
      <p>{message}</p>
      <div className="confirm__actions">
        <button
          type="button"
          className={`btn ${danger ? "btn--danger-fill" : "btn--ink"}`}
          disabled={busy}
          aria-busy={busy}
          onClick={onConfirm}
        >
          {busy ? "Waiting for Phantom…" : confirmLabel}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="pagehead__actions">{actions}</div>}
    </div>
  );
}
