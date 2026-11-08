import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { i41 } from "./invariants";
import { builtCount, typedCounts, typedFeatures } from "./typedFeatures";
import { composeProducts } from "./compose";
import { headerTitle } from "./pdf";
import { buildPlan } from "./report";
import { canonicalMeasures } from "./measureText";
import type { YardProject } from "./types";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

test("class F: a typed count is read as a count, 'no X' as zero, never a size", () => {
  assert.deepEqual(typedCounts("nightstand 20 wide 24 tall with 3 shelves"), { shelves: 3 });
  assert.deepEqual(typedCounts("6 drawer dresser with two doors"), { doors: 2, drawers: 6 });
  assert.deepEqual(typedCounts("closet with no rods"), { rods: 0 });
  assert.deepEqual(typedCounts("bookcase without shelves"), { shelves: 0 });
  assert.deepEqual(typedCounts("closet with 2 rails"), { rods: 2 });
  assert.deepEqual(typedCounts("bookcase 36 wide shelves"), {});
  assert.deepEqual(typedCounts("closet with two 1 1/4 rods"), { rods: 2 });
  assert.deepEqual(typedCounts("bed with 2 side rails"), {});
  assert.deepEqual(typedCounts("a holder for 6 fishing rods"), {});
  assert.deepEqual(typedCounts("6 drawer dresser no drawer slides"), { drawers: 6 });
  assert.deepEqual(typedCounts("dresser with no drawer slides"), {});
  assert.deepEqual(typedFeatures("wardrobe 80 tall with double hang"), ["double hang"]);
  assert.deepEqual(typedFeatures("pantry cabinet with pull out shelves"), ["shelves", "pull-outs"]);
  // Card words on card heads only (row 735): no pull-out ask for other wordings or a closet; "0 shelves" asks for none.
  assert.deepEqual(typedFeatures("pantry with slide-out baskets"), []);
  assert.deepEqual(typedFeatures("closet with pull out drawers"), ["drawers"]);
  assert.deepEqual(typedFeatures("coffee table with 0 shelves"), []);
  assert.deepEqual(typedCounts("fishing rod holder for 6 rods"), {});
  // r4 (rows 739/745): one reader for the checker and compose; "no open shelves" is 0, an article is no count.
  assert.deepEqual(typedCounts("coffee table with an open shelf"), {});
  assert.deepEqual(typedCounts("buffet with no open shelves"), { shelves: 0 });
  assert.deepEqual(typedCounts("cabinet w/o any open shelves"), { shelves: 0 });
  assert.deepEqual(typedCounts("bench with twelve shelves"), { shelves: 12 });
});

test("class F: every typed feature word or count is built or named in a note (I41), never dropped", () => {
  const bad: string[] = [];
  for (const q of [
    "wardrobe 48 wide 80 tall 24 deep with double hang",
    "pantry cabinet 24 wide 7 ft tall 24 deep with pull out shelves",
    "nightstand 22 1/2 wide 28 tall 17 deep with an open shelf",
    "media console 38 wide 34 tall 18 deep with 1 shelf",
    "closet with no rods",
    "closet without rods",
    "closet with 2 rails",
    "bookcase with 0 shelves",
    "nightstand 20 wide 24 tall with 3 shelves",
  ]) {
    const p = generateFromPrompt(q);
    const vs = i41(p, q);
    if (vs.length) bad.push(`${q}: ${vs.map((v) => v.msg).join("; ")}`);
    if ((p.notes ?? []).some((n) => n.startsWith("Combined:"))) bad.push(`${q}: a typed part became a second product`);
  }
  assert.deepEqual(bad, []);
});

test("class F: I41 fires on each dropped feature or count once its note is taken away; the note is the card's text", () => {
  const quiet: string[] = [];
  for (const [q, said] of [
    ["wardrobe 48 wide 80 tall 24 deep with double hang", "You asked for a double hang; this wardrobe is built without one for now."],
    ["pantry cabinet 24 wide 7 ft tall 24 deep with pull out shelves", "You asked for pull out shelves; this cabinet is built without them for now."],
    ["closet with no rods", "You asked for no rods; this closet has 1."],
    ["closet without rods", "You asked for no rods; this closet has 1."],
    ["closet with 2 rails", "You asked for 2 rails; this closet has 1."],
    ["bookcase with 0 shelves", "You asked for 0 shelves; this bookcase has 5."],
    ["nightstand 20 wide 24 tall with 3 shelves", "You asked for 3 shelves; this nightstand has 1."],
  ]) {
    const p = generateFromPrompt(q);
    const asked = (p.notes ?? []).filter((n) => /^You asked for/.test(n));
    if (asked.join(" | ") !== said) quiet.push(`${q}: ${asked.join(" | ")}`);
    if (!i41({ ...p, notes: (p.notes ?? []).filter((n) => !asked.includes(n)) }, q).length) quiet.push(`${q}: I41 silent without the note`);
  }
  assert.deepEqual(quiet, []);
});

test("class F controls: a count the build honours adds no note; a bare 'a shelf' on a frame is still its own product", () => {
  for (const q of ["dresser 60 wide 32 tall 20 deep with 9 drawers", "closet 5' wide 80 tall with 3 rods", "bookcase 48 wide with 3 shelves", "kitchen cart with 2 doors on casters", "dollhouse 2 doors 1 inch plywood"]) {
    const p = generateFromPrompt(q);
    if (p.kind !== "opening") assert.deepEqual(i41(p, q), [], q);
    assert.ok(!(p.notes ?? []).some((n) => /^You asked for/.test(n)), q);
  }
  // Shelves count by level, not by piece: 3 shelves across 3 bays are 3, not 9.
  assert.equal(builtCount(generateFromPrompt("bookcase 72 wide with 3 shelves"), "shelves"), 3);
  assert.ok((generateFromPrompt("picture frame with a shelf").notes ?? []).some((n) => n.startsWith("Combined:")));
  // r4 (row 745): the typed words alone pick the structure, so every stock builds the same products.
  for (const q of ["media console with an open shelf", "sideboard 84 wide with 1 shelf", "coffee table 72 wide with an open shelf", "end table with 1 shelf"]) {
    const kinds = [undefined, "plywood-1-4-4x8", "plywood-1-2-4x8", "plywood-3-4-4x8"].map((m) => (generateFromPrompt(q, m).notes ?? []).some((n) => n.startsWith("Combined:")));
    assert.deepEqual(kinds, kinds.map(() => /table/.test(q)), q);
  }
});

const CARD = [
  /^You asked for .+; this [a-z ]+ has (?:\d+|none)\.$/,
  /^You asked for a double hang; this (?:wardrobe|closet|armoire) is built without one for now\.$/,
  /^You asked for (?:pull out shelves|pull-out drawers|roll out trays|slide out shelves); this (?:cabinet|pantry) is built without them for now\.$/,
  /^You asked for (?:a shelf|shelves|doors|drawers); this [a-z ]+ is built without (?:one|them) for now\.$/,
];

test("class F r2 (Critic rows 733/735; r5 B2: a Combined build's header counts its Shelf product, so no count note): a count note says the header's number; every note is the card's words; capacity is no count", () => {
  const bad: string[] = [];
  for (const [q, said] of [
    ["coffee table without shelves", "You asked for no shelves; this table has 3."],
    ["media console with no shelves", ""],
    ["walk in closet without a rod", "You asked for no rod; this closet has 1."],
    ["base cabinet with pull-out shelves and 2 doors", "You asked for pull out shelves; this cabinet is built without them for now."],
    ["fishing rod holder for 6 rods", ""],
    ["pantry with slide-out baskets", ""],
    ["closet with pull out drawers", ""],
    ["cabinet with pull out trays", ""],
    ["coffee table with 0 shelves", ""],
    ["coffee table with no shelves", ""],
    ["end table with zero shelves", ""],
    ["vanity with no shelves", ""],
    ["bench with 1 shelf", ""],
    ["rolling cart with casters and 2 shelves", "You asked for 2 shelves; this cart has 3."],
    ["nightstand with 1 drawer and 1 shelf", ""],
    ["coffee table with an open shelf", ""],
    ["end table with an open shelf", ""],
    ["side table with an open shelf", ""],
    ["buffet with no open shelves", ""],
  ]) {
    const p = generateFromPrompt(q);
    const asked = (p.notes ?? []).filter((n) => /^You asked for/.test(n));
    if (asked.join(" | ") !== said) bad.push(`${q}: ${asked.join(" | ")}`);
    for (const n of asked) if (!CARD.some((re) => re.test(n))) bad.push(`${q}: off-card "${n}"`);
    const header = headerTitle(p).match(/· (\d+) shel(?:f|ves)\b/)?.[1];
    const note = asked.join(" ").match(/ has (\d+)\./)?.[1];
    if (header && note && /shel/.test(asked.join(" ")) && header !== note) bad.push(`${q}: header ${header}, note ${note}`);
  }
  assert.deepEqual(bad, []);
});

test("class F r4 (card 1): only '1 shelf' / 'an open shelf' on a card 1 host stays on the host; the rest keeps the release build", () => {
  const stub = (c: string) => ({ id: c, name: c, prompt: c, notes: [], instances: [], overall: { width: 10, height: 10, depth: 10 },
    panels: [{ id: c, name: "Side", type: "side", materialId: "m", size: { width: 10, height: 10, depth: 10 }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }] }) as unknown as YardProject;
  const split: string[] = [];
  const card1 = ["media console", "sideboard", "credenza", "buffet", "vanity", "desk", "nightstand"];
  for (const h of [...card1, "coffee table", "end table"]) {
    for (const s of ["1 shelf", "1 open shelf", "one open shelf", "an open shelf", "an open shelf.", "a single lower shelf", "1 shelf unit", "2 open shelves", "two open shelves", "open shelves", "zero shelves", "no shelves", "no open shelves", "twelve shelves"]) {
      const host = card1.includes(h) && /^(?:1 shelf|1 open shelf|one open shelf|an open shelf)$/.test(s);
      if (!!composeProducts(`${h} with ${s}`, stub)?.notes.some((n) => n.startsWith("Combined:")) === host) split.push(`${h} with ${s}`);
    }
    if (!composeProducts(`${h} with 2 doors and 1 shelf`, stub)?.notes.some((n) => n.startsWith("Combined:"))) split.push(`${h} with 2 doors and 1 shelf kept no Shelf`);
  }
  // r5 (Critic r4 B1): the whole prompt is the card 1 form; host-word variants, extra parts, "the" and a size after the
  // shelf keep release; a size before "with" and doubled spaces do not change the form.
  for (const [q, host] of [
    ["corner desk with 1 shelf", false], ["buffet cabinet with an open shelf", false], ["vanity mirror with an open shelf", false],
    ["desk organizer with 1 shelf", false], ["nightstand lamp with 1 shelf", false], ["double vanity with 1 shelf", false],
    ["desk with 1 shelf and casters", false], ["desk with 1 wide shelf", false], ["desk with two open shelf", false], ["sideboard with the open shelf", false], ["vanity with an open shelf 30 wide", false],
    ["buffet with 1  shelf", true], ["media console with  an  open  shelf", true], ["desk 60 wide with 1 shelf", true],
    ["vanity 85 wide 34.5 tall with 1 shelf", true], ["the sideboard with 1 shelf", true], ["a vanity with an open shelf", true],
  ] as const) {
    if (!!composeProducts(q, stub)?.notes.some((n) => n.startsWith("Combined:")) === host) split.push(q);
  }
  assert.deepEqual(split, []);
  assert.ok(composeProducts("picture frame with a shelf", stub));
});

test("class F card 1 at every size spelling: a host keeps its own shelf (never a second Shelf product) and builds like its digit size", () => {
  // Critic NR-1 probe A/D (2026-11-05): "desk 4 ft wide with an open shelf" built an 84" "Desk with Shelf" ($363.48)
  // where "desk 48 wide with an open shelf" builds the 48" desk ($318.56). Every spelling the one reader reads is that size.
  const box = (q: string) => {
    const p = generateFromPrompt(q);
    return { o: [p.overall.width, p.overall.depth, p.overall.height], combined: (p.notes ?? []).some((n) => n.startsWith("Combined:")), i41: i41(p, q).length };
  };
  const HOSTS = ["desk", "nightstand", "media console", "sideboard", "vanity"];
  const SIZES: [string, string][] = [
    ["4 ft wide", "48 wide"], ["2 1/2 ft wide", "30 wide"], ["2'6\" wide", "30 wide"], ["2 ft 6 in wide", "30 wide"],
    ["thirty inches wide", "30 wide"], ["two and a half feet wide", "30 wide"], ["762 mm wide", "30 wide"], ["76.2 cm wide", "30 wide"],
    ["6 ft tall", "72 tall"], ["seventy-two inches tall", "72 tall"], ["1829mm tall", "72 tall"], ["6' tall", "72 tall"], ["3 ft wide", "36 wide"],
  ];
  const bad: string[] = [];
  for (const host of HOSTS) for (const [typed, digits] of SIZES) for (const f of ["with 1 shelf", "with an open shelf", "with one shelf"]) {
    const q = `${host} ${typed} ${f}`, got = box(q), want = box(`${host} ${digits} ${f}`);
    if (got.combined) bad.push(`${q}: a second Shelf product`);
    if (got.i41) bad.push(`${q}: I41`);
    if (JSON.stringify(got.o) !== JSON.stringify(want.o)) bad.push(`${q}: ${got.o} != ${digits}: ${want.o}`);
  }
  assert.deepEqual(bad, []);
  // Controls: release's own reading stays (a comma is releaseReads text; a size after the shelf is another clause).
  assert.ok((generateFromPrompt("picture frame with a shelf").notes ?? []).some((n) => n.startsWith("Combined:")));
});

test("class F: every host keeps a typed axis beside a shelf, in every spelling and word order, matching the digit twin", () => {
  // The shelf wording, not a host list, is the class. CARD1 hosts already stayed one piece at "4 ft wide".
  // What still dropped the inches was a separator comma (releaseReads): "thirty inches", "four feet", "762 mm"
  // built the default "<host> with Shelf" while "30 wide" / "48 wide" kept the typed axis. Size-after and
  // comma-before are the same rule. A comma inside a number, an arch, "with four feet" and "two foot shelves" stay release.
  const box = (q: string) => {
    const p = generateFromPrompt(q);
    const panels = p.panels
      .map((x) => `${x.name}|${x.type}|${Math.round(x.size.width * 10) / 10}x${Math.round(x.size.height * 10) / 10}x${Math.round(x.size.depth * 10) / 10}`)
      .sort();
    return {
      name: p.name,
      o: [p.overall.width, p.overall.depth, p.overall.height],
      combined: (p.notes ?? []).some((n) => n.startsWith("Combined:")),
      refused: p.refused ?? null,
      i41: i41(p, q).length,
      panels,
    };
  };
  const HOSTS = ["desk", "nightstand", "media console", "coffee table", "tv console", "bookcase", "end table"];
  const SIZES: [string, string][] = [
    ["3 ft wide", "36 wide"], ["2 1/2 ft wide", "30 wide"], ["762 mm wide", "30 wide"], ["thirty inches wide", "30 wide"],
    ["four feet wide", "48 wide"], ["6 ft tall", "72 tall"], ["six feet tall", "72 tall"], ["1829 mm tall", "72 tall"],
  ];
  const FEATS = ["with 1 shelf", "with an open shelf"];
  const orders = (h: string, size: string, f: string) => [
    `${h} ${size} ${f}`, `${h} ${f} ${size}`, `${h} ${size}, ${f}`, `${h}, ${size} ${f}`, `${h} ${f}, ${size}`,
  ];
  const bad: string[] = [];
  for (const h of HOSTS) for (const [typed, digits] of SIZES) for (const f of FEATS) {
    const forms = orders(h, "SIZE", f);
    for (let i = 0; i < forms.length; i++) {
      const q = forms[i].replace("SIZE", typed);
      const twin = forms[i].replace("SIZE", digits);
      const got = box(q), want = box(twin);
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${q} -> ${JSON.stringify(got)} != ${twin} -> ${JSON.stringify(want)}`);
    }
  }
  for (const [q, twin] of [
    ["coffee table thirty inches wide, with one shelf", "coffee table 30 wide, with one shelf"],
    ["end table 762 mm wide, with 1 open shelf", "end table 30 wide, with 1 open shelf"],
    ["bedside table 2'6\" wide, with an open shelf", "bedside table 30 wide, with an open shelf"],
    ["console table five feet wide, with an open shelf", "console table 60 wide, with an open shelf"],
    ["media console 3 ft wide with 1 shelf", "media console 36 wide with 1 shelf"],
    ["nightstand 2 1/2 ft wide with 1 shelf", "nightstand 30 wide with 1 shelf"],
    ["coffee table 4 ft wide with an open shelf", "coffee table 48 wide with an open shelf"],
    ["desk 4 ft wide, with an open shelf", "desk 48 wide, with an open shelf"],
    ["vanity with an open shelf 2 1/2 ft wide", "vanity with an open shelf 30 wide"],
    ["desk with an open shelf 4 ft wide", "desk with an open shelf 48 wide"],
  ] as const) {
    const got = box(q), want = box(twin);
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${q} -> ${JSON.stringify(got)} != ${twin} -> ${JSON.stringify(want)}`);
  }
  assert.deepEqual(bad, []);

  // Steps and parts (cut list and Buy), not the price, for the spellings that used to drop the axis.
  const plan = (q: string) => {
    const p = generateFromPrompt(q);
    const pl = buildPlan(p);
    return {
      name: p.name,
      o: [p.overall.width, p.overall.depth, p.overall.height],
      steps: pl.instructions.map((s) => s.title),
      cuts: pl.cutList.map((c) => [c.name, c.quantity, c.lengthIn, c.widthIn, c.thicknessIn, c.material]),
      bom: pl.bom.map((b) => [b.name, b.quantity]),
    };
  };
  const headlines: [string, string][] = [
    ["nightstand thirty inches wide, with 1 shelf", "nightstand 30 wide, with 1 shelf"],
    ["coffee table 762 mm wide, with 1 shelf", "coffee table 30 wide, with 1 shelf"],
    ["nightstand four feet wide, with 1 shelf", "nightstand 48 wide, with 1 shelf"],
    ["bookcase six feet tall, with 1 shelf", "bookcase 72 tall, with 1 shelf"],
    ["bookcase 1829 mm tall, with an open shelf", "bookcase 72 tall, with an open shelf"],
    ["desk with 1 shelf, thirty inches wide", "desk with 1 shelf, 30 wide"],
    ["tv console 3 ft wide with 1 shelf", "tv console 36 wide with 1 shelf"],
    ["coffee table 4 ft wide with an open shelf", "coffee table 48 wide with an open shelf"],
  ];
  const planBad: string[] = [];
  for (const [q, twin] of headlines) {
    if (JSON.stringify(plan(q)) !== JSON.stringify(plan(twin))) planBad.push(`${q} != ${twin}`);
  }
  assert.deepEqual(planBad, []);

  // Not this class: release still owns these. A comma inside a number, an arch, a count of feet, a part's own length.
  assert.equal(canonicalMeasures("bookcase 914 mm wide, 1829 mm tall"), "bookcase 914 mm wide, 1829 mm tall");
  assert.equal(canonicalMeasures("shelf unit 30 wide, 1 m tall"), "shelf unit 30 wide, 1 m tall");
  assert.equal(canonicalMeasures("garden arch four feet wide, with an open shelf"), "garden arch four feet wide, with an open shelf");
  assert.equal(canonicalMeasures("coffee table with four feet"), "coffee table with four feet");
  assert.equal(canonicalMeasures("bookcase with two foot shelves"), "bookcase with two foot shelves");
  assert.equal(canonicalMeasures("desk 1,200 mm wide, with 1 shelf"), "desk 1,200 mm wide, with 1 shelf");
  for (const q of ["nightstand thirty inches wide, with 1 shelf", "coffee table 762 mm wide, with an open shelf", "bookcase six feet tall, with 1 shelf"]) {
    assert.equal(canonicalMeasures(canonicalMeasures(q)), canonicalMeasures(q), q);
  }
  assert.ok((generateFromPrompt("picture frame with a shelf").notes ?? []).some((n) => n.startsWith("Combined:")));
  assert.equal(generateFromPrompt("coffee table with four feet").overall.width, generateFromPrompt("coffee table").overall.width);
  assert.equal(generateFromPrompt("bookcase with two foot shelves").overall.height, generateFromPrompt("bookcase").overall.height);
});
