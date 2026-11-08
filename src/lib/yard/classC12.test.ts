/** C12 · every store search a Buy row links to searches that row's Buy name (whole class), plus the C11 PDF line. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { buyQuery, storeSearchTerm, storeTermDrift, alignStoreTerms } from "./listings";
import { OUTBOUND_REL, outboundHref } from "./outbound";
import { pdfCutListIntro } from "./wholeItems";
import { isUnitItem } from "./unitItems";
import { buildPlanPdf } from "./pdf";

const corpus = [...new Set<string>(Object.values(SWEEPS).flatMap((s) => s.prompts))];

test("C12: no Buy row on any sweep build searches a name other than its own (whole class)", () => {
  let searched = 0;
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "C12").map((x) => x.msg), [], q);
    for (const b of plan.bom) for (const o of b.offers ?? []) if (storeSearchTerm(o.href) != null) searched++;
  }
  assert.ok(searched >= 100, `only ${searched} store searches checked`);
});

test("C12: linen's shelf pins search 3/16\" on Amazon; price and header unchanged", () => {
  const plan = buildPlan(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"));
  const pins = plan.bom.find((b) => b.name === '3/16" shelf pins')!;
  assert.ok(pins.offers?.length);
  for (const o of pins.offers!) assert.doesNotMatch(o.href, /5mm/);
  assert.equal(storeSearchTerm(pins.offers!.find((o) => o.retailer === "amazon")!.href), '3/16" shelf pins');
  assert.equal(plan.totals.estCostUsd.toFixed(2), "193.68");
});

test("C12: a stale href or searchQuery is caught, then re-pointed for every store, wrapped or not", () => {
  const stale = {
    name: '3/16" shelf pins', quantity: 1, unit: "pack", searchQuery: "5mm shelf pins", estimatedCost: 6.49,
    offers: (["amazon", "homedepot", "lowes", "walmart"] as const).map((retailer) => ({
      retailer, label: retailer, title: "x", packQty: 1, packPrice: 6.49, unitPrice: 6.49, packsNeeded: 1, lineTotal: 6.49, best: false, checkedAt: "2026-10-16",
      href: { amazon: "https://www.amazon.com/s?k=5mm+shelf+pins", homedepot: "https://www.homedepot.com/s/5mm%20shelf%20pins", lowes: "https://www.lowes.com/search?searchTerm=5mm+shelf+pins", walmart: "https://www.walmart.com/search?q=5mm+shelf+pins" }[retailer],
    })),
  };
  assert.equal(storeTermDrift({ bom: [stale] }).length, 5);
  const fixed = alignStoreTerms(stale);
  assert.deepEqual(storeTermDrift({ bom: [fixed] }), []);
  assert.deepEqual(fixed.offers!.map((o) => o.lineTotal), [6.49, 6.49, 6.49, 6.49]);
  // An Impact-wrapped Home Depot search still reads (and is held to) the wrapped term; sub-ID rules stay in outbound.ts.
  const cfg = { amazonTag: "yard-20", homedepotTemplate: "https://homedepot.sjv.io/c/1/2/3?u={url}", lowesTemplate: "" };
  const wrapped = outboundHref("https://www.homedepot.com/s/5mm%20shelf%20pins", cfg, "buy");
  assert.equal(storeSearchTerm(wrapped), "5mm shelf pins");
  assert.match(wrapped, /subId1=buy/);
  const amz = outboundHref("https://www.amazon.com/s?k=x", cfg, "buy");
  assert.doesNotMatch(amz, /ascsubtag|subId/);
  assert.equal(OUTBOUND_REL, "nofollow sponsored noopener");
  // A product page is a fixed item, not a search.
  assert.equal(storeSearchTerm("https://www.amazon.com/dp/B09NNZB6M9"), null);
  assert.equal(buyQuery('1/4" plywood 4x8 (backer)'), '1/4" plywood 4x8');
  assert.equal(buyQuery("1×4 Board (8 ft)"), "1x4 Board 8 ft");
});

test("C11: whole-item PDF cut lists never say \"as you cut it\"", () => {
  let whole = 0;
  for (const q of [...SWEEPS.c11.prompts, ...SWEEPS.c3.prompts]) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    if (!isUnitItem(p) || !plan.cutList.length || !plan.cutList.every((c) => c.whole)) continue;
    whole++;
    assert.doesNotMatch(pdfCutListIntro(plan), /as you cut it/, q);
  }
  assert.ok(whole >= 8, `only ${whole} all-whole builds`);
  const zp = generateFromPrompt("zip tie");
  const raw = buildPlanPdf(zp, buildPlan(zp)).output();
  assert.doesNotMatch(raw, /as you cut it/);
  const lp = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.match(pdfCutListIntro(buildPlan(lp)), /as you cut it/);
});
