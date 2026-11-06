"use client";

import { useEffect, useState } from "react";

/** Agent names are a per-browser convenience (the chain stores only the key), so localStorage is right here. */
const KEY = "allowance:agent-names";

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveAgentName(agent: string, name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [agent]: name }));
  } catch {
    /* storage blocked: the session still works, it just shows the key */
  }
}

export function agentName(agent: string): string | null {
  return read()[agent] ?? null;
}


/** All saved names, read after mount so server and first client render match. */
export function useAgentNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => setNames(read()), []);
  return names;
}
