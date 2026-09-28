/**
 * Affiliate outbound plumbing — inert by default; fake IDs prove tagging/wrapping.
 * Run: node_modules/.bin/tsx scripts/yard-affiliate-guards.ts
 */
import fs from "fs";
import {
  affiliateActive,
  affiliateConfig,
  affiliateDisclosure,
  amazonTagged,
  outboundHref,
  outboundIsAffiliate,
  storeOf,
  wrapTemplate,
} from "../src/lib/yard/outbound";
import { stampAmazon, amazonAssociateTag, shopLinks } from "../src/lib/yard/shop";
import { decorateBom, offersFor, tagNote } from "../src/lib/yard/listings";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf } from "../src/lib/yard/pdf";

function fail(msg: string, extra?: unknown): never {
  console.error("FAIL affiliate", msg, extra ?? "");
  process.exit(1);
}

const FAKE = {
  amazon: "yardtest-20",
  hd: "https://homedepot.sjv.io/c/111/222/8154?u={url}",
  lowes: "https://goto.lowes.com/c/333/444/7890?u={url}",
};

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(vars);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function clearAffiliateEnv() {
  for (const k of [
    "VITE_PUBLIC_AMAZON_ASSOCIATE_TAG",
    "NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG",
    "AMAZON_ASSOCIATES_TAG",
    "AMAZON_ASSOCIATE_TAG",
    "VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE",
    "HOMEDEPOT_AFFILIATE_TEMPLATE",
    "VITE_PUBLIC_LOWES_AFFILIATE_TEMPLATE",
    "LOWES_AFFILIATE_TEMPLATE",
  ]) {
    delete process.env[k];
  }
}

// ── unit: store detection + tagging ─────────────────────────────
clearAffiliateEnv();
if (storeOf("https://www.amazon.com/dp/B0931TYTN4") !== "amazon") fail("store amazon");
if (storeOf("https://www.homedepot.com/s/2x4") !== "homedepot") fail("store hd");
if (storeOf("https://www.lowes.com/search?searchTerm=x") !== "lowes") fail("store lowes");
if (storeOf("https://www.walmart.com/search?q=x") !== "walmart") fail("store walmart");

const tagged = amazonTagged("https://www.amazon.com/dp/B0931TYTN4?psc=1&ref=abc", FAKE.amazon);
if (!tagged.includes("tag=yardtest-20") || !tagged.includes("/dp/B0931TYTN4") || tagged.includes("psc=") || tagged.includes("ref=")) {
  fail("amazon clean product", tagged);
}
const search = amazonTagged("https://www.amazon.com/s?k=wood+glue&ref=sr", FAKE.amazon);
if (!search.includes("tag=yardtest-20") || !search.includes("k=wood+glue") || search.includes("ref=")) {
  fail("amazon clean search", search);
}
const wrapped = wrapTemplate("https://www.homedepot.com/s/2x4", FAKE.hd);
if (wrapped !== `https://homedepot.sjv.io/c/111/222/8154?u=${encodeURIComponent("https://www.homedepot.com/s/2x4")}`) {
  fail("hd wrap", wrapped);
}

clearAffiliateEnv();
if (affiliateActive()) fail("active with no env");
if (affiliateDisclosure()) fail("disclosure with no env");
if (tagNote()) fail("tagNote with no env");
if (outboundHref("https://www.amazon.com/dp/B0931TYTN4") !== "https://www.amazon.com/dp/B0931TYTN4") {
  fail("inert amazon");
}
if (outboundHref("https://www.homedepot.com/s/2x4") !== "https://www.homedepot.com/s/2x4") fail("inert hd");

withEnv(
  {
    VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: FAKE.amazon,
    VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE: FAKE.hd,
    VITE_PUBLIC_LOWES_AFFILIATE_TEMPLATE: FAKE.lowes,
  },
  () => {
    const cfg = affiliateConfig();
    if (cfg.amazonTag !== FAKE.amazon) fail("cfg amazon", cfg);
    if (cfg.homedepotTemplate !== FAKE.hd) fail("cfg hd", cfg);
    if (!affiliateActive(cfg)) fail("active");
    const disc = affiliateDisclosure(cfg);
    if (!disc.includes("Yard may earn a commission") || !disc.includes("Amazon Associate")) fail("disclosure", disc);
    if (tagNote() !== disc) fail("tagNote mismatch", tagNote());

    const a = outboundHref("https://www.amazon.com/dp/B0931TYTN4", cfg);
    if (!a.includes("tag=yardtest-20")) fail("outbound amazon", a);
    if (!outboundIsAffiliate("https://www.amazon.com/dp/B0931TYTN4", cfg)) fail("isAffiliate amazon");

    const h = outboundHref("https://www.homedepot.com/p/foo/123", cfg);
    if (!h.startsWith("https://homedepot.sjv.io/") || !h.includes(encodeURIComponent("https://www.homedepot.com/p/foo/123"))) {
      fail("outbound hd", h);
    }
    const l = outboundHref("https://www.lowes.com/search?searchTerm=2x4", cfg);
    if (!l.startsWith("https://goto.lowes.com/") || !l.includes(encodeURIComponent("https://www.lowes.com/search?searchTerm=2x4"))) {
      fail("outbound lowes", l);
    }
    // Walmart untouched
    if (outboundHref("https://www.walmart.com/search?q=x", cfg) !== "https://www.walmart.com/search?q=x") fail("walmart");
  },
);

// ── every Buy offer goes through outboundHref; prices unchanged ──
clearAffiliateEnv();
const prompts = [
  "pocket vanity",
  "nightstand with one drawer",
  "popsicle stick catapult",
  "3 foot Eiffel Tower from popsicle sticks",
  "40 inch round table with 3 legs",
  "house: linen closet 31.5×78×16",
];

type Snap = { name: string; q: number; u: string; cost: number | null | undefined; offers: { r: string; t: string; h: string; pq: number; pp: number; up: number; pn: number; lt: number; b: boolean }[] };

function snapPlan(prompt: string): Snap[] {
  const plan = buildPlan(generateFromPrompt(prompt));
  return plan.bom.map((b) => ({
    name: b.name,
    q: b.quantity,
    u: b.unit,
    cost: b.estimatedCost,
    offers: (b.offers ?? []).map((o) => ({
      r: o.retailer,
      t: o.title,
      h: o.href,
      pq: o.packQty,
      pp: o.packPrice,
      up: o.unitPrice,
      pn: o.packsNeeded,
      lt: o.lineTotal,
      b: o.best,
    })),
  }));
}

const baseline = snapPlan; // alias
const before: Record<string, Snap[]> = {};
for (const p of prompts) before[p] = snapPlan(p);

// Identical with no env
for (const p of prompts) {
  const after = snapPlan(p);
  if (JSON.stringify(after) !== JSON.stringify(before[p])) fail(`inert drift: ${p}`, { before: before[p][0], after: after[0] });
}

withEnv(
  {
    VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: FAKE.amazon,
    VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE: FAKE.hd,
  },
  () => {
    for (const p of prompts) {
      const after = snapPlan(p);
      const prev = before[p];
      if (after.length !== prev.length) fail(`row count ${p}`);
      for (let i = 0; i < after.length; i++) {
        const a = after[i];
        const b = prev[i];
        if (a.name !== b.name || a.q !== b.q || a.u !== b.u || a.cost !== b.cost) fail(`row meta ${p}`, { a, b });
        if (a.offers.length !== b.offers.length) fail(`offer count ${p}/${a.name}`);
        for (let j = 0; j < a.offers.length; j++) {
          const ao = a.offers[j];
          const bo = b.offers[j];
          if (ao.t !== bo.t || ao.pq !== bo.pq || ao.pp !== bo.pp || ao.up !== bo.up || ao.pn !== bo.pn || ao.lt !== bo.lt || ao.b !== bo.b || ao.r !== bo.r) {
            fail(`price/title drift ${p}/${a.name}`, { ao, bo });
          }
          const expected = outboundHref(bo.h, affiliateConfig());
          if (ao.h !== expected) fail(`href not through outbound ${p}/${a.name}`, { got: ao.h, expected, raw: bo.h });
          if (storeOf(bo.h) === "amazon" && !ao.h.includes(`tag=${FAKE.amazon}`)) fail(`amazon missing tag ${p}`, ao.h);
          if (storeOf(bo.h) === "homedepot" && !ao.h.startsWith("https://homedepot.sjv.io/")) fail(`hd not wrapped ${p}`, ao.h);
        }
      }
    }
  },
);

// offersFor unit: every href is outboundHref of the raw store URL
clearAffiliateEnv();
const popsOff = offersFor("popsicle-standard", 100, { lengthIn: 4.5, widthIn: 0.375, thickIn: 0.08 });
if (!popsOff.length) fail("no popsicle offers");
withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: FAKE.amazon }, () => {
  const on = offersFor("popsicle-standard", 100, { lengthIn: 4.5, widthIn: 0.375, thickIn: 0.08 });
  for (let i = 0; i < on.length; i++) {
    if (on[i].title !== popsOff[i].title || on[i].packPrice !== popsOff[i].packPrice) fail("offersFor price");
    if (popsOff[i].retailer === "amazon" && !on[i].href.includes(`tag=${FAKE.amazon}`)) fail("offersFor amazon tag", on[i].href);
  }
});

// PDF builds with and without affiliate; no crash
clearAffiliateEnv();
{
  const proj = generateFromPrompt("pocket vanity");
  const plan = buildPlan(proj);
  const a = buildPlanPdf(proj, plan).output("arraybuffer").byteLength;
  withEnv(
    { VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: FAKE.amazon, VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE: FAKE.hd },
    () => {
      const b = buildPlanPdf(proj, plan).output("arraybuffer").byteLength;
      if (b < 3000 || a < 3000) fail("pdf size", { a, b });
    },
  );
}

// shopLinks amazon flag + stampAmazon still work
clearAffiliateEnv();
withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: FAKE.amazon }, () => {
  if (amazonAssociateTag() !== FAKE.amazon) fail("amazonAssociateTag");
  const links = shopLinks("wood glue");
  if (!links.find((l) => l.retailer === "amazon")?.href.includes("tag=")) fail("shopLinks tag");
  if (!stampAmazon("https://www.amazon.com/dp/B0CD7PP3R1").includes("tag=")) fail("stampAmazon");
});

// baseline snapshot (no env) matches the frozen file if present
clearAffiliateEnv();
const snapPath = "/workspace/affiliate/baseline_noenv.json";
if (fs.existsSync(snapPath)) {
  const frozen = JSON.parse(fs.readFileSync(snapPath, "utf8")) as Record<string, Snap[]>;
  // Only check the prompts we share with the frozen set
  for (const p of prompts) {
    if (!frozen[p]) continue;
    const now = snapPlan(p);
    // Compare offer hrefs + prices only (prompts that are in both)
    const slim = (rows: Snap[]) =>
      rows.map((r) => ({ name: r.name, q: r.q, cost: r.cost, offers: r.offers.map((o) => ({ r: o.r, t: o.t, h: o.h, pp: o.pp, pq: o.pq })) }));
    if (JSON.stringify(slim(now)) !== JSON.stringify(slim(frozen[p]))) {
      // Soft: log but only fail if a shared row's href drifted
      for (let i = 0; i < Math.min(now.length, frozen[p].length); i++) {
        for (let j = 0; j < Math.min(now[i].offers.length, frozen[p][i].offers.length); j++) {
          if (now[i].offers[j].h !== frozen[p][i].offers[j].h) {
            fail(`baseline href drift ${p}`, { now: now[i].offers[j], was: frozen[p][i].offers[j] });
          }
        }
      }
    }
  }
}

console.log("PASS affiliate: outboundHref central, inert with no env, fake IDs tag Amazon + wrap Home Depot/Lowe's, prices unchanged");
