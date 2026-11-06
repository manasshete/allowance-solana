import type { ReactNode } from "react";

export function Skeleton({ rows = 4, onInk = false }: { rows?: number; onInk?: boolean }) {
  return (
    <div className={`skeleton${onInk ? " skeleton--ink" : ""}`} aria-busy="true">
      <span className="visually-hidden">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <h3>Couldn&apos;t read this from devnet</h3>
      <p>{(error as Error)?.message ?? String(error)}</p>
      {retry && (
        <button type="button" className="btn btn--ghost" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
