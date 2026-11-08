"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

import { Card3D } from "@/components/Card3D";
import { useSessions } from "@/lib/hooks";

type Contact = {
  name: string;
  address: string;
  created: number;
};

const STORAGE_KEY = "allowance:contacts";

export default function ContactsPage() {
  const sessions = useSessions();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    name?: string;
    address?: string;
    source?: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load contacts from storage + session merchants
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved: Contact[] = raw ? JSON.parse(raw) : [];

      // Also merge any session merchants
      if (sessions.data) {
        sessions.data.forEach((s) => {
          s.account.merchants.forEach((m) => {
            if (m.label && !saved.some((c) => c.name.toLowerCase() === m.label.toLowerCase())) {
              saved.push({
                name: m.label,
                address: m.merchant.toBase58(),
                created: Date.now(),
              });
            }
          });
        });
      }
      setContacts(saved);
    } catch {
      /* ignore */
    }
  }, [sessions.data]);

  const saveToStorage = (updated: Contact[]) => {
    setContacts(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const cleanName = name.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      setFeedback("Please enter a contact name.");
      return;
    }

    try {
      new PublicKey(cleanAddress);
    } catch {
      setFeedback("Invalid Solana address format.");
      return;
    }

    const updated = [
      ...contacts.filter((c) => c.name.toLowerCase() !== cleanName.toLowerCase()),
      { name: cleanName, address: cleanAddress, created: Date.now() },
    ];
    saveToStorage(updated);
    setName("");
    setAddress("");
    setFeedback(`Saved ${cleanName} as ${cleanAddress.slice(0, 4)}…${cleanAddress.slice(-4)}.`);
  };

  const handleDelete = (nameToDelete: string) => {
    const updated = contacts.filter((c) => c.name !== nameToDelete);
    saveToStorage(updated);
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    const q = testInput.trim().toLowerCase();
    const stripped = q.replace(/^(my|the)\s+/, "");

    if (!q) {
      setTestResult(null);
      return;
    }

    // 1. Check local / session contacts
    const found = contacts.find(
      (c) =>
        c.name.toLowerCase() === q ||
        c.name.toLowerCase() === stripped ||
        c.name.toLowerCase().replace(/^(my|the)\s+/, "") === stripped
    );

    if (found) {
      setTestResult({
        matched: true,
        name: found.name,
        address: found.address,
        source: "Saved contact",
      });
      return;
    }

    // 2. Check if valid Solana base58
    try {
      const pk = new PublicKey(testInput.trim());
      setTestResult({
        matched: true,
        name: "That address",
        address: pk.toBase58(),
        source: "A Solana address, used as given",
      });
    } catch {
      setTestResult({
        matched: false,
      });
    }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Contacts</h1>
          <p className="muted">
            Names your agent can pay, like &ldquo;pay my friend 0.05&rdquo;. Your agent can pay a name only when that
            address is listed as a merchant in its session: the program refuses anyone else.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <div className="col">
          <div className="well">
            <h2>How your agent finds a name</h2>
            <ol className="flow flow--compact">
              <li>
                <p>
                  <strong>Listed in its session.</strong> The labels you give merchants in{" "}
                  <Link href="/app/sessions/new">New session</Link> are on-chain, so the MCP server reads them. Add your
                  friend there to let Claude pay them.
                </p>
              </li>
              <li>
                <p>
                  <strong>In the MCP server&apos;s config.</strong> Names in <code>config/merchants.json</code> on the
                  machine that runs the server.
                </p>
              </li>
              <li>
                <p>
                  <strong>Saved on this page.</strong> Kept only in this browser, so the server can&apos;t see them. Use
                  them to keep addresses handy and check a name below.
                </p>
              </li>
            </ol>
          </div>

          <h2 className="split-title">Saved in this browser</h2>

          {contacts.length === 0 ? (
            <div className="dashed-box">No contacts yet.</div>
          ) : (
            <div className="contacts-list">
              {contacts.map((c) => (
                <div key={c.name} className="contact-row">
                  <div className="contact-info">
                    <span className="contact-name">{c.name}</span>
                    <span className="contact-addr addr mono-id">
                      {c.address.slice(0, 8)}...{c.address.slice(-8)}
                    </span>
                  </div>
                  <div className="contact-actions">
                    <button
                      type="button"
                      className="btn btn--text"
                      onClick={() => {
                        setTestInput(c.name);
                        setTestResult({
                          matched: true,
                          name: c.name,
                          address: c.address,
                          source: "Saved contact",
                        });
                      }}
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      className="btn btn--text"
                      onClick={() => handleDelete(c.name)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Add Contact + Test Resolver */}
        <div className="col">
          <Card3D intensity={10} glare={false}>
            <div className="plate hud-card">
              <h2 className="hud-card__title">Add contact</h2>
              <p className="muted">Kept in this browser. To let your agent pay this person, list the address in a session.</p>

              <form onSubmit={handleAddContact} className="hud-form">
                <div className="field">
                  <label htmlFor="c-name">Name</label>
                  <input
                    id="c-name"
                    type="text"
                    autoComplete="off"
                    placeholder="Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="c-addr">Solana address</label>
                  <input
                    id="c-addr"
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Solana address (base58)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {feedback && <small className="help text-mint">{feedback}</small>}

                <button type="submit" className="btn btn--primary" style={{ width: "fit-content" }}>
                  Save contact
                </button>
              </form>
            </div>
          </Card3D>

          <Card3D intensity={10} glare={false}>
            <div className="plate hud-card" style={{ marginTop: "var(--space-md)" }}>
              <h2 className="hud-card__title">Check a name</h2>
              <p className="muted">Looks up a name the way the MCP server does, against the names saved here and in your sessions.</p>

              <form onSubmit={handleResolve} className="hud-form">
                <div className="field">
                  <label htmlFor="r-input">Name or address</label>
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <input
                      id="r-input"
                      type="text"
                      autoComplete="off"
                      placeholder="Alex or Solana address..."
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn--primary">
                      Resolve
                    </button>
                  </div>
                </div>

                <div className="resolver-output">
                  {testResult === null ? (
                    <span className="muted">Type a saved name, for example &ldquo;my friend&rdquo;.</span>
                  ) : testResult.matched ? (
                    <div className="resolver-success">
                      <span className="pill pill--on-ink text-mint">Found</span>
                      <p>
                        <strong>{testResult.name}</strong> is{" "}
                        <code className="addr">{testResult.address}</code>
                      </p>
                      <small className="muted">{testResult.source}</small>
                    </div>
                  ) : (
                    <div className="resolver-fail">
                      <span className="pill pill--on-ink" style={{ color: "var(--color-refused)" }}>
                        Not found
                      </span>
                      <p className="muted">
                        No contact called &ldquo;{testInput}&rdquo;. Your agent would not know who to pay.
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </Card3D>
        </div>
      </div>
    </>
  );
}
