#!/usr/bin/env node
// Renders /api/og on a running build for the linen closet, the pocket vanity and a craft-stick build, checks each is a
// 1200×630 PNG back within the time limit, and saves them. usage: node scripts/og-render-check.mjs [base] [outDir]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000", out = process.argv[3] ?? "out", LIMIT_MS = 5000;
const pocket = readFileSync(new URL("../src/lib/yard/pocket.ts", import.meta.url), "utf8").match(/POCKET_DREAM = `([^`]*)`/)[1];
const token = (prompt) => Buffer.from(JSON.stringify({ prompt, measure: {} })).toString("base64url");
const cards = { linen: "linen closet 31.5 wide 78 tall 16 deep", "pocket-vanity": pocket, "eiffel-sticks": "3 foot Eiffel Tower from popsicle sticks" };
mkdirSync(out, { recursive: true });
let bad = 0;
for (const [name, prompt] of Object.entries(cards)) {
  const t = Date.now();
  const res = await fetch(`${base}/api/og?y=${token(prompt)}`);
  const png = new Uint8Array(await res.arrayBuffer()), ms = Date.now() - t;
  const v = new DataView(png.buffer), w = png.length > 24 ? v.getUint32(16) : 0, h = png.length > 24 ? v.getUint32(20) : 0;
  const ok = res.status === 200 && res.headers.get("content-type") === "image/png" && png[1] === 0x50 && w === 1200 && h === 630 && ms < LIMIT_MS;
  writeFileSync(`${out}/${name}.png`, png);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${res.status} ${w}×${h} ${png.length} B in ${ms} ms · ${res.headers.get("cache-control")} → ${out}/${name}.png`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
