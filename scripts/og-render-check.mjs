#!/usr/bin/env node
// Renders /api/og on a running build and checks the route's promises: each card is a 1200×630 PNG within the
// time limit; builds past the 6 s budget come back as the default card in about the budget, and GET / stays fast
// while one renders; a repeat is served from the memo; extra parameters get a 308 to the one card URL.
// usage: node scripts/og-render-check.mjs [base] [outDir]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000", out = process.argv[3] ?? "out";
const pocket = readFileSync(new URL("../src/lib/yard/pocket.ts", import.meta.url), "utf8").match(/POCKET_DREAM = `([^`]*)`/)[1];
const token = (prompt) => Buffer.from(JSON.stringify({ prompt, measure: {} })).toString("base64url");
const get = async (path, init) => {
  const t = Date.now(), res = await fetch(base + path, { redirect: "manual", ...init });
  const body = new Uint8Array(await res.arrayBuffer()), v = new DataView(body.buffer);
  return { res, body, ms: Date.now() - t, w: body.length > 24 ? v.getUint32(16) : 0, h: body.length > 24 ? v.getUint32(20) : 0 };
};
mkdirSync(out, { recursive: true });
let bad = 0;
const check = (ok, line) => { console.log(`${ok ? "PASS" : "FAIL"} ${line}`); if (!ok) bad++; };
const site = await get("/api/og");
// [name, prompt, a built card expected, time limit ms]
const cards = [["linen", "linen closet 31.5 wide 78 tall 16 deep", true, 5000], ["pocket-vanity", pocket, true, 5000],
  ["eiffel-sticks", "3 foot Eiffel Tower from popsicle sticks", true, 8000], ["eiffel-30ft", "30 foot Eiffel Tower from popsicle sticks", false, 9000],
  ["eiffel-100ft", "100 foot Eiffel Tower from popsicle sticks", false, 9000], ["deck-100x100", "deck 100 x 100 feet", false, 9000],
  ["toothpick-castle-50ft", "toothpick castle 50 feet", false, 9000]];
for (const [name, prompt, built, limit] of cards) {
  const path = `/api/og?y=${token(prompt)}`;
  const card = get(path);
  await new Promise((r) => setTimeout(r, 500));
  const home = await get("/"); // while the card is being worked out
  const c = await card;
  writeFileSync(`${out}/${name}.png`, c.body);
  const isSite = c.body.length === site.body.length && c.body.every((b, i) => b === site.body[i]);
  const again = await get(path);
  check(c.res.status === 200 && c.res.headers.get("content-type") === "image/png" && c.w === 1200 && c.h === 630 && c.ms < limit && isSite !== built && home.ms < 2000 && again.ms < 300,
    `${name}: ${c.res.status} ${c.w}×${c.h} ${c.body.length} B in ${c.ms} ms (${isSite ? "default card" : "built card"}), GET / during it ${home.ms} ms, repeat ${again.ms} ms · ${c.res.headers.get("cache-control")} → ${out}/${name}.png`);
}
const extra = await get(`/api/og?y=${token("cat tree")}&z=1`);
check(extra.res.status === 308 && extra.res.headers.get("location") === `/api/og?y=${token("cat tree")}`, `extra params: ${extra.res.status} → ${extra.res.headers.get("location")}`);
process.exit(bad ? 1 : 0);
