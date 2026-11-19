/**
 * Build id (launch plan A1): one id per generated build, carried by every event about it (Buy clicks, exports,
 * thumbs, "Tell the shop"), so the daily digest can say what happened to a build. It is made from the build itself:
 * the typed words, the size to 1/16", the stock, the kind and the parts. The same build gives the same id on the
 * server and in any browser, and nothing about a person goes into it.
 *
 * It is derived, never stored on the project and never read by the engine, so no plan output (Buy, cuts, steps,
 * notes, price) can depend on it: the canaries and the I46 ratchet cannot move.
 */
export const BID = /^b[0-9a-f]{15}$/;

type BuildLike = {
  prompt?: string;
  typedPrompt?: string;
  kind?: string;
  primaryMaterialId?: string;
  overall?: { width: number; height: number; depth: number };
  panels?: { name?: string }[];
};

/** 60 bits from two independent 32-bit string hashes (cyrb53's mixing), as 15 hex digits. Not a secret; a name. */
function hash60(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0").slice(1) + (h1 >>> 0).toString(16).padStart(8, "0"));
}

const sixteenth = (n: number | undefined) => (Number.isFinite(n) ? Math.round((n as number) * 16) / 16 : 0);

/** The build's id: "b" + 15 hex digits. */
export function buildIdOf(p: BuildLike): string {
  const words = (p.typedPrompt ?? p.prompt ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const o = p.overall;
  const size = o ? `${sixteenth(o.width)}x${sixteenth(o.height)}x${sixteenth(o.depth)}` : "";
  const parts = (p.panels ?? []).map((x) => x.name ?? "").join(",");
  return `b${hash60([words, size, p.primaryMaterialId ?? "", p.kind ?? "", String(p.panels?.length ?? 0), parts].join("|"))}`;
}
