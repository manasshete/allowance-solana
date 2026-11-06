/**
 * The work the paid route sells: fetch a page and return a three-line summary.
 * Extractive (first substantial sentences), so the demo needs no API key.
 */
export async function summarize(url: string): Promise<{ title: string; lines: string[] }> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs");

  const res = await fetch(u, { headers: { "user-agent": "allowance-paid-api/0.1" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Fetching ${u.host} failed with ${res.status}`);
  const html = (await res.text()).slice(0, 500_000);

  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? u.host);
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  );
  const sentences = text.match(/[^.!?]{40,240}[.!?]/g) ?? [];
  const lines = [...new Set(sentences.map((s) => s.trim()))].slice(0, 3);
  return { title, lines: lines.length ? lines : [text.slice(0, 200).trim()] };
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
