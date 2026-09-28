/**
 * Buy order honesty guard.
 *
 * The Buy list says "cheapest first". This fails if any Buy row's offers are not sorted by price
 * for the amount needed, if "Best" is anything but the cheapest offer, if a row with a real price
 * difference has no Best, or if the order depends on which store it is or on an affiliate ID.
 *
 * Run: node_modules/.bin/tsx scripts/yard-buy-order-guards.ts
 */
import fs from "fs";
import { GALLERY } from "../src/lib/yard/gallery";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { LISTINGS, compareOffersByPrice, offersFor, sortOffersByPrice } from "../src/lib/yard/listings";
import { storeOf } from "../src/lib/yard/outbound";
import type { ShopOffer } from "../src/lib/yard/types";

function fail(msg: string, extra?: unknown): never {
  console.error("FAIL buy-order", msg, extra ?? "");
  process.exit(1);
}

const TAG_KEYS = ["VITE_PUBLIC_AMAZON_ASSOCIATE_TAG", "VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE"];
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const EPS = 1e-9;

/** Every Buy row: cheapest first, Best = the cheapest, one Best at most, Best when prices differ. */
function checkRow(where: string, offers: ShopOffer[]) {
  if (!offers.length) return;
  for (let i = 1; i < offers.length; i++) {
    const a = offers[i - 1];
    const b = offers[i];
    if (a.lineTotal > b.lineTotal + EPS) fail(`not cheapest-first (total) ${where}`, { a, b });
    if (Math.abs(a.lineTotal - b.lineTotal) <= EPS && a.unitPrice > b.unitPrice + EPS) {
      fail(`not cheapest-first (per piece tie-break) ${where}`, { a, b });
    }
  }
  const bests = offers.filter((o) => o.best);
  if (bests.length > 1) fail(`more than one Best ${where}`, bests);
  const minTotal = Math.min(...offers.map((o) => o.lineTotal));
  if (bests.length === 1) {
    const best = bests[0];
    if (best !== offers[0]) fail(`Best is not the first (cheapest) offer ${where}`, { best, first: offers[0] });
    if (best.lineTotal > minTotal + EPS) fail(`Best is not the cheapest ${where}`, { best, minTotal });
    if (!(best.packPrice > 0) && offers.some((o) => o.packPrice > 0)) fail(`Best is a zero-price row ${where}`, best);
  }
  const pricesDiffer = offers.some((o) => Math.abs(o.lineTotal - minTotal) > EPS);
  if (pricesDiffer && bests.length === 0) fail(`checked prices differ but no Best ${where}`, offers);
}

// ── unit: the comparator ignores the store ─────────────────────
{
  const base = { title: "Wood glue", packQty: 1, label: "", href: "", packPrice: 0, packsNeeded: 1, best: false, checkedAt: "" };
  const am = { ...base, retailer: "amazon", lineTotal: 5.47, unitPrice: 5.47 } as ShopOffer;
  const hd = { ...base, retailer: "homedepot", lineTotal: 4.98, unitPrice: 4.98 } as ShopOffer;
  const wm = { ...base, retailer: "walmart", lineTotal: 4.98, unitPrice: 4.98 } as ShopOffer;
  const s1 = sortOffersByPrice([am, hd, wm]);
  const s2 = sortOffersByPrice([wm, hd, am]);
  if (s1[0].retailer === "amazon" || s1[2].retailer !== "amazon") fail("unit: pricier Amazon sorted ahead", s1);
  if (s1.map((o) => o.retailer).join() !== s2.map((o) => o.retailer).join()) fail("unit: order depends on input order", { s1, s2 });
  if (compareOffersByPrice(am, hd) <= 0) fail("unit: compare favours Amazon");
  // Per-piece breaks a total tie; smaller pack breaks a per-piece tie.
  const bigPack = { ...base, retailer: "amazon", lineTotal: 10, unitPrice: 0.01, packQty: 1000 } as ShopOffer;
  const smallPack = { ...base, retailer: "lowes", lineTotal: 10, unitPrice: 0.02, packQty: 500 } as ShopOffer;
  if (sortOffersByPrice([smallPack, bigPack])[0] !== bigPack) fail("unit: per-piece tie-break");
}

// ── source: no store preference left in the sort ───────────────
{
  const src = fs.readFileSync("src/lib/yard/listings.ts", "utf8");
  if (/retailer\s*===\s*"amazon"\s*\?\s*0/.test(src)) fail("source: Amazon-first rank is back in listings.ts");
  if (/best:\s*i\s*===\s*0/.test(src)) fail("source: Best = first index (not cheapest) is back in listings.ts");
}

// ── every catalog listing group, many quantities ───────────────
const catalogIds = [...new Set(LISTINGS.map((o) => o.catalogId))];
for (const id of catalogIds) {
  for (const n of [1, 2, 3, 7, 25, 100, 260, 1200]) {
    const offers = offersFor(id, n) as unknown as ShopOffer[];
    checkRow(`offersFor(${id}, ${n})`, offers);
    if (offers.length && !offers.some((o) => o.best)) fail(`checked listings but no Best: ${id}`);
  }
}

// ── every gallery plan + canaries, with and without affiliate IDs ──
const prompts = [
  ...GALLERY.map((g) => g.prompt),
  "pocket vanity",
  "nightstand with one drawer",
  "house: linen closet 31.5×78×16",
];
type RowKey = string;
const orderOf = (p: string): RowKey[] =>
  buildPlan(generateFromPrompt(p)).bom.map((b) => `${b.name}|${b.quantity}|${(b.offers ?? []).map((o) => `${o.retailer}:${o.title}:${o.lineTotal}:${o.best ? 1 : 0}`).join(",")}`);

let rows = 0;
let withBest = 0;
for (const env of [
  Object.fromEntries(TAG_KEYS.map((k) => [k, undefined])),
  { VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: "yardtest-20", VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE: undefined },
]) {
  withEnv(env, () => {
    for (const p of prompts) {
      const plan = buildPlan(generateFromPrompt(p));
      for (const b of plan.bom) {
        const offers = b.offers ?? [];
        checkRow(`${p} / ${b.name}`, offers);
        rows++;
        const best = offers.find((o) => o.best);
        if (best) {
          withBest++;
          if (b.estimatedCost != null && Math.abs(b.estimatedCost - best.lineTotal) > 0.005) {
            fail(`row cost is not the Best total ${p} / ${b.name}`, { cost: b.estimatedCost, best: best.lineTotal });
          }
        }
        for (const o of offers) {
          if (storeOf(o.href) === "amazon" && env.VITE_PUBLIC_AMAZON_ASSOCIATE_TAG && !o.href.includes("tag=yardtest-20")) {
            fail(`Amazon link lost its tag ${p} / ${b.name}`, o.href);
          }
        }
      }
    }
  });
}
// Same order and same Best whether or not an affiliate ID is on.
for (const p of prompts) {
  const off = withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: undefined }, () => orderOf(p));
  const on = withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: "yardtest-20" }, () => orderOf(p));
  if (JSON.stringify(off) !== JSON.stringify(on)) fail(`order changes with affiliate ID: ${p}`, { off, on });
}

console.log(`PASS buy-order: ${rows} Buy rows cheapest-first, Best = cheapest (${withBest} with a Best), no store preference, same with or without affiliate IDs`);
