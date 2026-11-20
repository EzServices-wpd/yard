/**
 * The daily feedback digest: one markdown page a person reads in a minute. Pure (no store, no network), so the
 * script, a test and a future cron all render the same page from the same input.
 *
 * Order: the day's counts; the worst builds (thumbs-down plus feedback notes); notes grouped by chip; builds that
 * were printed but never sent to a store, and builds sent to a store but thumbed down.
 */
import type { FeedbackRecord } from "./shop";

/**
 * A stored build. `verified` is set only when the server itself computed the numbers.
 * Anything else (including a record that simply lacks the flag) is not a fact: the page may quote the
 * scrubbed words and must not print a client price, part count, size or family as if Yard measured it.
 */
export type DigestBuild = { prompt: string | null; size?: string; family?: string; parts?: number; usd?: number; tip?: string; first?: string; verified?: true; unverified?: true };
export type DigestInput = {
  day: string; // YYYY-MM-DD, UTC
  feedback: FeedbackRecord[]; // newest first, as stored
  events: Record<string, number>; // ev:<day>: "<bid>|<event>|<detail>" → count
  builds: Record<string, DigestBuild | null>; // bld:<bid>
};

const CHIP_LABEL: Record<string, string> = { "wrong-object": "Wrong object", "wrong-size": "Wrong size", floating: "Parts floating", steps: "Steps confusing", price: "Price off", other: "Other" };
const md = (s: string | null | undefined) => (s ?? "").replace(/[|\\`*_<>[\]]/g, (c) => `\\${c}`).replace(/\s+/g, " ").trim();

export function digestMarkdown(input: DigestInput, worstN = 10): string {
  const { day, events, builds } = input;
  const fb = input.feedback.filter((f) => f.at.slice(0, 10) === day);
  const per = new Map<string, { build: number; export: number; buy: Record<string, number>; up: number; down: number; notes: FeedbackRecord[] }>();
  const of = (bid: string) => {
    let r = per.get(bid);
    if (!r) per.set(bid, (r = { build: 0, export: 0, buy: {}, up: 0, down: 0, notes: [] }));
    return r;
  };
  const totals = { builds: 0, exports: 0, buy: {} as Record<string, number>, up: 0, down: 0 };
  for (const [field, n] of Object.entries(events)) {
    const [bid, ev, detail] = field.split("|");
    if (!bid || !ev) continue;
    const r = of(bid);
    if (ev === "build") { r.build += n; totals.builds += n; }
    else if (ev === "export") { r.export += n; totals.exports += n; }
    else if (ev === "buy") { r.buy[detail] = (r.buy[detail] ?? 0) + n; totals.buy[detail] = (totals.buy[detail] ?? 0) + n; }
    else if (ev === "thumb" && detail === "up") { r.up += n; totals.up += n; }
    else if (ev === "thumb" && detail === "down") { r.down += n; totals.down += n; }
  }
  for (const f of fb) if (f.bid) of(f.bid).notes.push(f);
  const chips: Record<string, number> = {};
  for (const f of fb) for (const c of f.chips) chips[c] = (chips[c] ?? 0) + 1;

  const typed = (prompt: string | null | undefined) => (prompt ? `visitor-typed, unverified: “${md(prompt)}”` : "");
  const name = (bid: string) => {
    const b = builds[bid];
    const fromNote = per.get(bid)?.notes[0];
    return typed(b?.prompt) || typed(fromNote?.prompt) || `build ${bid}`;
  };
  /** Size and family are printed only when the server verified them. Client numbers are never printed. */
  const facts = (bid: string) => (builds[bid]?.verified === true ? builds[bid] : undefined);
  const buys = (r: { buy: Record<string, number> }) => Object.values(r.buy).reduce((a, b) => a + b, 0);
  const lines: string[] = [];
  lines.push(`# Yard feedback digest · ${day}`, "");
  lines.push("## The day", "");
  lines.push(`- Builds shown: **${totals.builds}** · exports: **${totals.exports}** · Buy clicks: **${Object.values(totals.buy).reduce((a, b) => a + b, 0)}**${Object.keys(totals.buy).length ? ` (${Object.entries(totals.buy).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(", ")})` : ""}`);
  lines.push(`- Thumbs: **${totals.up}** up · **${totals.down}** down`);
  lines.push(`- Tell-the-shop notes: **${fb.length}**${Object.keys(chips).length ? ` (${Object.entries(chips).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${CHIP_LABEL[c] ?? c} ${n}`).join(", ")})` : ""}`);
  const noBid = fb.filter((f) => !f.bid).length;
  if (noBid) lines.push(`- ${noBid} note(s) came from an older page with no build id.`);
  lines.push("");

  const worst = [...per.entries()].map(([bid, r]) => ({ bid, r, score: r.down + r.notes.length })).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.r.down - a.r.down || (a.bid < b.bid ? -1 : 1)).slice(0, worstN);
  lines.push(`## Worst builds (${worst.length})`, "");
  if (!worst.length) lines.push("No thumbs-down and no notes about a known build today.", "");
  worst.forEach(({ bid, r }, i) => {
    const b = facts(bid);
    const tip = builds[bid]?.tip;
    lines.push(`${i + 1}. ${name(bid)}${b?.size ? ` · ${md(b.size)}` : ""}${b?.family ? ` · ${md(b.family)}` : ""}${tip ? ` · tip ${md(tip)}` : ""} · ${r.down} down, ${r.up} up, ${r.notes.length} note(s), ${r.export} export(s), ${buys(r)} Buy click(s) · \`${bid}\``);
    for (const n of r.notes.slice(0, 5)) lines.push(`   - ${n.chips.map((c) => CHIP_LABEL[c] ?? c).join(", ") || "note"}${n.note ? `: “${md(n.note)}”` : ""}`);
  });
  if (worst.length) lines.push("");

  lines.push("## Notes by chip", "");
  const byChip = new Map<string, FeedbackRecord[]>();
  for (const f of fb) for (const c of f.chips.length ? f.chips : ["other"]) byChip.set(c, [...(byChip.get(c) ?? []), f]);
  if (!byChip.size) lines.push("No notes today.", "");
  for (const [c, list] of [...byChip.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${CHIP_LABEL[c] ?? c} (${list.length})`);
    for (const f of list.slice(0, 15)) lines.push(`- ${f.prompt ? typed(f.prompt) : "(no prompt)"}${f.size ? ` · ${md(f.size)}` : ""}${f.note ? `: ${md(f.note)}` : ""}`);
    if (list.length > 15) lines.push(`- … ${list.length - 15} more`);
    lines.push("");
  }

  const printedNotBought = [...per.entries()].filter(([, r]) => r.export > 0 && buys(r) === 0).map(([bid]) => bid);
  const boughtButDown = [...per.entries()].filter(([, r]) => buys(r) > 0 && r.down > 0).map(([bid]) => bid);
  lines.push("## Worth a look", "");
  lines.push(`- Printed or copied, never sent to a store: ${printedNotBought.length ? printedNotBought.slice(0, 10).map(name).join("; ") : "none"}`);
  lines.push(`- Sent to a store, then thumbed down: ${boughtButDown.length ? boughtButDown.slice(0, 10).map(name).join("; ") : "none"}`);
  lines.push("");
  return lines.join("\n");
}
