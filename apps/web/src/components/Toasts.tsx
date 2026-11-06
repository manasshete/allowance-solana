"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { explorerTx } from "@allowance/client";

type Toast = { id: number; text: string; sig: string | null; kind: "ok" | "error" };
const Ctx = createContext<(text: string, sig: string | null, kind?: Toast["kind"]) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, sig: string | null, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, sig, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <span>{t.text}</span>
            {t.sig && (
              <a href={explorerTx(t.sig)} target="_blank" rel="noreferrer">
                View tx
              </a>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
