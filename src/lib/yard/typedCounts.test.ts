import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { i41 } from "./invariants";
import { builtCount, typedCounts, typedFeatures } from "./typedFeatures";
import { composeProducts } from "./compose";
import { headerTitle } from "./pdf";
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
  // r3 (rows 738/739): one reader for the checker, compose and the builders: "an open shelf" is 1, "no open shelves" 0.
  assert.deepEqual(typedCounts("coffee table with an open shelf"), { shelves: 1 });
  assert.deepEqual(typedCounts("buffet with no open shelves"), { shelves: 0 });
  assert.deepEqual(typedCounts("cabinet w/o any open shelves"), { shelves: 0 });
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
});

const CARD = [
  /^You asked for .+; this [a-z ]+ has (?:\d+|none)\.$/,
  /^You asked for a double hang; this (?:wardrobe|closet|armoire) is built without one for now\.$/,
  /^You asked for (?:pull out shelves|pull-out drawers|roll out trays|slide out shelves); this (?:cabinet|pantry) is built without them for now\.$/,
  /^You asked for (?:a shelf|shelves|doors|drawers); this [a-z ]+ is built without (?:one|them) for now\.$/,
];

test("class F r2 (Critic rows 733/735): a count note says the header's number; every note is the card's words; capacity is no count", () => {
  const bad: string[] = [];
  for (const [q, said] of [
    ["coffee table without shelves", "You asked for no shelves; this table has 3."],
    ["media console with no shelves", "You asked for no shelves; this console has 2."],
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
    ["buffet with no open shelves", "You asked for no open shelves; this buffet has 2."],
  ]) {
    const p = generateFromPrompt(q);
    const asked = (p.notes ?? []).filter((n) => /^You asked for/.test(n));
    if (asked.join(" | ") !== said) bad.push(`${q}: ${asked.join(" | ")}`);
    for (const n of asked) if (!CARD.some((re) => re.test(n))) bad.push(`${q}: off-card "${n}"`);
    const header = headerTitle(p).match(/· (\d+) shel(?:f|ves)\b/)?.[1];
    const note = asked.join(" ").match(/ has (\d+)\./)?.[1];
    if (header && note && /shel/.test(asked.join(" ")) && header !== note) bad.push(`${q}: header ${header}, note ${note}`);
    if (/an open shelf/.test(q) && header !== "1") bad.push(`${q}: header ${header} for an open shelf`);
  }
  assert.deepEqual(bad, []);
});

test("class F r2 (row 736): count words split part from product as digits do, on every host; more clauses keep the release build", () => {
  const stub = (c: string) => ({ id: c, name: c, prompt: c, notes: [], instances: [], overall: { width: 10, height: 10, depth: 10 },
    panels: [{ id: c, name: "Side", type: "side", materialId: "m", size: { width: 10, height: 10, depth: 10 }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }] }) as unknown as YardProject;
  const split: string[] = [];
  for (const h of ["media console", "sideboard", "credenza", "buffet", "vanity", "desk", "nightstand", "coffee table", "end table"]) {
    for (const s of ["1 open shelf", "one open shelf", "an open shelf", "2 open shelves", "two open shelves", "open shelves", "0 shelves", "zero shelves", "no shelves", "no open shelves", "3 shelves", "three shelves", "twelve shelves"]) {
      if (composeProducts(`${h} with ${s}`, stub)?.notes.some((n) => n.startsWith("Combined:"))) split.push(`${h} with ${s}`);
    }
    if (!composeProducts(`${h} with 2 doors and 1 shelf`, stub)?.notes.some((n) => n.startsWith("Combined:"))) split.push(`${h} with 2 doors and 1 shelf kept no Shelf`);
  }
  assert.deepEqual(split, []);
  assert.ok(composeProducts("picture frame with a shelf", stub));
});
