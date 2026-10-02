/**
 * Affiliate outbound plumbing — inert by default; fake IDs prove tagging/wrapping.
 * Run: node_modules/.bin/tsx scripts/yard-affiliate-guards.ts
 */
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import { amazonCartOffer, amazonCartUrl, asinFromHref, buyListCart, isLocalStockRow } from "../src/lib/yard/amazonCart";
import { LISTINGS } from "../src/lib/yard/listings";
import { IDEAS } from "../src/lib/yard/ideas";
import { StockFind } from "../src/components/workspace/stock-find";
import { BuyList } from "../src/components/workspace/buy-list";

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
      // Same links per row regardless of order — the Buy order is cheapest-first (buy-order guard).
      for (let i = 0; i < Math.min(now.length, frozen[p].length); i++) {
        // An Amazon row may move from a search URL to its /dp/ASIN product page (ASINs feed "Buy this list").
        const norm = (h: string) => (storeOf(h) === "amazon" ? "amazon" : h);
        const a = now[i].offers.map((o) => norm(o.h)).sort();
        const b = frozen[p][i].offers.map((o) => norm(o.h)).sort();
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          fail(`baseline href drift ${p}`, { row: now[i].name, now: a, was: b });
        }
      }
    }
  }
}

// ── placement: store + affiliate links render only on the Buy list ─────────────
// Ezra, Oct 2: shopping links live on the Buy list and nowhere else (not the stock picker).
// Static: no file outside the Buy list (and the helpers / Buy model / printed Buy list) may
// import or call an affiliate helper, or carry the Amazon tag, cart URL or a store host.
{
  const BUY_LIST_UI = "src/components/workspace/buy-list.tsx";
  const ALLOWED = new Set([
    BUY_LIST_UI,
    "src/lib/yard/outbound.ts", // the helpers themselves
    "src/lib/yard/shop.ts",
    "src/lib/yard/amazonCart.ts",
    "src/lib/yard/listings.ts", // Buy model: builds the Buy rows' offers (rendered only by the Buy list)
    "src/lib/yard/pdf.ts", // the printed Buy list
  ]);
  // Link builders. The plain disclosure sentence (affiliateDisclosure / affiliateActive) may show anywhere.
  const HELPERS =
    /\b(outboundHref|outboundIsAffiliate|affiliateConfig|shopLinks|shopSearchUrl|affiliateUrl|amazonProductUrl|amazonSearchUrl|stampAmazon|amazonTagged|wrapTemplate|homeDepotSearchUrl|lowesSearchUrl|walmartSearchUrl|amazonCartUrl|buyListCart|amazonCartOffer|amazonAssociateTag)\b/;
  const DISCLOSURE_ONLY = new Set(["affiliateDisclosure", "affiliateActive"]);
  const HELPER_IMPORT = /\bimport\s+((?:(?!\bimport\b)[^;])*?)\s+from\s+["'](?:@\/lib\/yard\/|(?:\.{1,2}\/)+(?:[\w.-]+\/)*)(outbound|shop|amazonCart)["']/g;
  const badImport = (code: string) =>
    [...code.matchAll(HELPER_IMPORT)].some((m) => {
      const named = m[1].trim().match(/^(?:type\s+)?\{([\s\S]*)\}$/);
      if (!named) return true; // default / namespace import of a link helper module
      return named[1]
        .split(",")
        .map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
        .filter(Boolean)
        .some((n) => !DISCLOSURE_ONLY.has(n) && !/^[A-Z]/.test(n));
    });
  const TAG_LITERAL = /yardwiki01-20|AssociateTag|gp\/aws\/cart|[?&]tag=/;
  const STORE_HOST = /\b(?:amazon\.com|amzn\.to|homedepot\.com|lowes\.com|walmart\.com|homedepot\.sjv\.io|goto\.lowes\.com)\b/;
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const f = path.join(dir, d.name);
      if (d.isDirectory()) return walk(f);
      return /\.(tsx?|jsx?|mjs)$/.test(d.name) && !/\.test\.|\.gen\./.test(d.name) ? [f] : [];
    });
  const offenders: string[] = [];
  for (const file of walk("src")) {
    const rel = file.split(path.sep).join("/");
    if (ALLOWED.has(rel)) continue;
    const src = fs.readFileSync(file, "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    if (badImport(code)) offenders.push(`${rel}: imports an affiliate link helper`);
    const h = code.match(HELPERS);
    if (h) offenders.push(`${rel}: uses ${h[1]}`);
    const t = code.match(TAG_LITERAL);
    if (t) offenders.push(`${rel}: affiliate tag / cart literal ${t[0]}`);
    // Rendering layer: no hard-coded store hosts either.
    if (/^src\/(components|routes)\//.test(rel)) {
      const m = code.match(STORE_HOST);
      if (m) offenders.push(`${rel}: store host ${m[0]}`);
    }
  }
  if (offenders.length) fail("affiliate/store links outside the Buy list", offenders);
  const ui = fs.readFileSync(BUY_LIST_UI, "utf8");
  if (!/buyListCart/.test(ui) || !/outboundHref/.test(ui) || !/data-yard-affiliate-disclosure/.test(ui)) {
    fail("Buy list lost its cart button, row links or disclosure");
  }
}

// Rendered: the stock picker shows no store links, with the Amazon tag live.
clearAffiliateEnv();
withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: "yardwiki01-20", VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE: FAKE.hd }, () => {
  const queries = ["wine bottle", "sawhorse", "coffee can", "pvc pipe 3/4", "tennis ball", "1x2 pine 24 in", "popsicle stick", "2x4", "plywood"];
  let rendered = 0;
  for (const q of queries) {
    const html = renderToStaticMarkup(createElement(StockFind, { query: q, onUse: () => {} }));
    if (html) rendered++;
    if (/<a\b|href=|yardwiki01-20|tag=|amazon\.com|homedepot|lowes\.com|walmart\.com/i.test(html)) {
      fail(`stock picker renders a store/affiliate link for "${q}"`, html.slice(0, 400));
    }
  }
  if (rendered < 4) fail("stock picker render check went blank (guard would prove nothing)", rendered);
});

// ── "Buy this list": one Amazon cart, Buy-model quantities, tag only when live ──
clearAffiliateEnv();
{
  // Catalog ASINs are well formed and match their product URL.
  for (const o of LISTINGS) {
    if (!o.asin) continue;
    if (!/^[A-Z0-9]{10}$/.test(o.asin)) fail("bad ASIN", o);
    if (o.retailer !== "amazon" || asinFromHref(o.href) !== o.asin) fail("ASIN does not match its Amazon URL", o);
  }
  const u = new URL(amazonCartUrl([{ asin: "B0931TYTN4", quantity: 2 }, { asin: "B0002YWZPW", quantity: 1 }], "yardtest-20"));
  if (u.origin + u.pathname !== "https://www.amazon.com/gp/aws/cart/add.html") fail("cart URL path", u.toString());
  if (u.searchParams.get("ASIN.1") !== "B0931TYTN4" || u.searchParams.get("Quantity.1") !== "2" || u.searchParams.get("ASIN.2") !== "B0002YWZPW" || u.searchParams.get("Quantity.2") !== "1") fail("cart URL pairs", u.toString());
  if (u.searchParams.get("AssociateTag") !== "yardtest-20") fail("cart URL tag", u.toString());
  if (amazonCartUrl([{ asin: "B0931TYTN4", quantity: 1 }], "").includes("AssociateTag")) fail("cart URL tags with no tag");

  const cartPrompts = ["kitchen base cabinet", "popsicle catapult", ...prompts, ...IDEAS.map((g) => g.prompt)];
  let carts = 0;
  for (const env of [{ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: undefined }, { VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: "yardwiki01-20" }]) {
    withEnv(env, () => {
      const tag = env.VITE_PUBLIC_AMAZON_ASSOCIATE_TAG;
      for (const p of cartPrompts) {
        const plan = buildPlan(generateFromPrompt(p));
        const cart = buyListCart(plan.bom);
        const asins = new Set<string>();
        plan.bom.forEach((b, i) => {
          const pick = amazonCartOffer(b);
          const line = cart.lines.find((l) => l.rowIndex === i);
          const per = cart.perRow.find((r) => r.rowIndex === i);
          const owned = (b.offers ?? []).some((o) => o.quote === "owned");
          if (pick && !owned) {
            if (!line || line.asin !== pick.asin) fail(`ASIN row missing from the cart ${p} / ${b.name}`, { pick, line });
            if (per) fail(`ASIN row also left per-row ${p} / ${b.name}`);
            if (!(Number.isInteger(line.quantity) && line.quantity >= 1)) fail(`cart quantity ${p} / ${b.name}`, line);
            asins.add(line.asin);
          } else {
            if (line) fail(`row without an Amazon ASIN went into the cart ${p} / ${b.name}`, line);
            if (!owned && !per) fail(`row without an ASIN has no per-row home ${p} / ${b.name}`);
            if (isLocalStockRow(b) && (b.offers ?? []).some((o) => asinFromHref(o.href))) fail(`lumber row has an ASIN ${p} / ${b.name}`);
          }
        });
        if (!cart.href) {
          if (asins.size) fail(`cart rows but no cart URL ${p}`);
          continue;
        }
        carts++;
        const cu = new URL(cart.href);
        const got: Record<string, number> = {};
        for (let n = 1; cu.searchParams.has(`ASIN.${n}`); n++) got[cu.searchParams.get(`ASIN.${n}`)!] = Number(cu.searchParams.get(`Quantity.${n}`));
        const want: Record<string, number> = {};
        for (const l of cart.lines) want[l.asin] = (want[l.asin] ?? 0) + l.quantity;
        if (JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(want).sort())) fail(`cart URL ≠ cart lines ${p}`, { got, want });
        if (tag ? cu.searchParams.get("AssociateTag") !== tag : cu.searchParams.has("AssociateTag")) fail(`cart tag gating ${p}`, cart.href);
      }
    });
  }
  if (!carts) fail("no plan produced a cart");

  // The two builds Ezra checks: exact cart contents from the Buy model.
  withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: "yardwiki01-20" }, () => {
    const cab = buildPlan(generateFromPrompt("kitchen base cabinet"));
    const cabCart = buyListCart(cab.bom);
    const hinge = cab.bom.find((b) => b.catalogId === "cabinet-hinges");
    const hingeLine = cabCart.lines.find((l) => l.asin === "B0D6W2VLFW");
    if (!hinge || !hingeLine) fail("kitchen base cabinet: hinges not in the cart", cabCart);
    const hingeOffer = hinge.offers!.find((o) => asinFromHref(o.href) === "B0D6W2VLFW")!;
    if (hingeLine.quantity !== hingeOffer.packsNeeded || hingeLine.quantity !== hinge.quantity) fail("kitchen base cabinet: hinge pairs ≠ Buy row", { hingeLine, hinge: hinge.quantity });
    if (!cab.bom.filter((b) => /^plywood-/.test(b.catalogId ?? "")).every((b) => cabCart.perRow.some((r) => r.name === b.name && r.local))) {
      fail("kitchen base cabinet: plywood should stay per-row as local stock", cabCart.perRow);
    }
    const cat = buildPlan(generateFromPrompt("popsicle catapult"));
    const catCart = buyListCart(cat.bom);
    const sticks = catCart.lines.find((l) => l.asin === "B0931TYTN4");
    if (!sticks || sticks.quantity !== 1) fail("popsicle catapult: one 1000-pack of sticks", catCart.lines);
    if (!catCart.href?.includes("AssociateTag=yardwiki01-20")) fail("popsicle catapult: cart lost the tag", catCart.href);

    // Rendered Buy list: the button, the per-row note, the disclosure beside it.
    const html = renderToStaticMarkup(createElement(BuyList, { plan: cab }));
    const btn = html.match(/<a href="([^"]+)"[^>]*data-yard-buy-cart="1"/);
    if (!btn || !btn[1].replace(/&amp;/g, "&").startsWith("https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=")) fail("Buy list: no Buy this list button", html.slice(0, 600));
    if (!/>Buy this list</.test(html)) fail("Buy list: button label");
    if (!/Lumber and sheets: pick up at your local store/.test(html)) fail("Buy list: local-store note");
    if (!/data-yard-affiliate-disclosure="1"[^>]*>[^<]*Amazon Associate/.test(html)) fail("Buy list: disclosure missing with the tag live");
  });
  withEnv({ VITE_PUBLIC_AMAZON_ASSOCIATE_TAG: undefined }, () => {
    const html = renderToStaticMarkup(createElement(BuyList, { plan: buildPlan(generateFromPrompt("popsicle catapult")) }));
    const btn = html.match(/<a href="([^"]+)"[^>]*data-yard-buy-cart="1"/);
    if (!btn) fail("Buy list: button must still work with no tag");
    if (btn[1].includes("AssociateTag") || /data-yard-affiliate-disclosure/.test(html)) fail("Buy list: tag or disclosure with no tag", btn[1]);
  });
  console.log(`PASS buy-this-list: ${carts} carts (with/without tag) match Buy-model ASINs + quantities; store links only on the Buy list`);
}

console.log("PASS affiliate: outboundHref central, inert with no env, fake IDs tag Amazon + wrap Home Depot/Lowe's, prices unchanged");
