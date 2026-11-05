// Critic probe for #225 NR-1 (audit mode, not a fix; do not merge). Run from the repo root: npx tsx --test scripts/nr1.critic.test.ts
// Reports one CRITIC JSON line per prompt (diff head vs release from the CI logs) and asserts the claims the Critic tests:
// (A) class F (#229) counts/features typed beside a size are still built or noted (I41) in every size spelling;
// (B) a spelled count of feet/legs ("four feet") is not read as a size; (C) stock names with an adjective keep their size;
// (D) a spelled size beside a class F count builds like its digit spelling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { i41 } from "../src/lib/yard/invariants";
import { canonicalMeasures } from "../src/lib/yard/measureText";
import { normalizeUserPrompt } from "../src/lib/yard/voiceHonesty";

globalThis.fetch = (async () => { throw new Error("network is off in this probe"); }) as typeof fetch;

const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 10);
type Obs = { prompt: string; canon: string; norm: string; name: string; W: number; D: number; H: number; usd: number; pieces: number; refused: string | null; notes: string[]; i41: string[]; cut: string; bom: string[] };
const seen = new Map<string, Obs>();
// run-unit-tests.ts prints nothing of a passing file's stdout, so CRITIC lines also go to the runner's own stdout (the job log).
const SINK = (() => {
  let fd: number | null = null;
  try {
    for (let pid = process.ppid, i = 0; i < 10 && pid > 1; i++) {
      if (/run-unit-tests/.test(fs.readFileSync(`/proc/${pid}/cmdline`, "utf8"))) { if (fd != null) fs.closeSync(fd); fd = fs.openSync(`/proc/${pid}/fd/1`, "a"); }
      pid = Number(fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[1]);
    }
  } catch { /* not on Linux CI */ }
  return fd;
})();
const emit = (line: string) => { console.log(line); if (SINK != null) try { fs.writeSync(SINK, line + "\n"); } catch { /* ignore */ } };
function obs(prompt: string): Obs {
  const got = seen.get(prompt);
  if (got) return got;
  let o: Obs;
  try {
    const p = generateFromPrompt(prompt);
    const pl = buildPlan(p);
    o = {
      prompt, canon: canonicalMeasures(prompt), norm: normalizeUserPrompt(prompt), name: p.name,
      W: p.overall.width, D: p.overall.depth, H: p.overall.height, usd: p.refused ? 0 : pl.totals.estCostUsd, pieces: pl.totals.pieces,
      refused: p.refused ?? null, notes: p.notes ?? [], i41: i41(p, prompt).map((v) => v.msg),
      cut: h(pl.cutList.map((c) => [c.name, c.lengthIn, c.widthIn, c.thicknessIn, c.quantity, c.material])),
      bom: pl.bom.map((b) => `${b.name} x${b.quantity}`),
    };
  } catch (e) {
    o = { prompt, canon: "", norm: "", name: `THREW ${(e as Error).message}`, W: -1, D: -1, H: -1, usd: -1, pieces: -1, refused: null, notes: [], i41: [], cut: "", bom: [] };
  }
  seen.set(prompt, o);
  emit(`CRITIC ${JSON.stringify(o)}`);
  return o;
}
const box = (o: Obs) => `${o.W}x${o.D}x${o.H} $${o.usd} ${o.pieces}p ${o.refused ? "REFUSED" : ""}`;

// (D) spelled / unit size beside class F counts: each group must build the same box and price.
const HOSTS = ["bookcase", "nightstand", "desk", "dresser", "media console", "wardrobe"];
const SIZE_GROUPS: string[][] = [
  ["30 wide", "2 1/2 ft wide", "2.5 ft wide", "2'6\" wide", "2 ft 6 in wide", "thirty inches wide", "two and a half feet wide", "762 mm wide", "76.2 cm wide"],
  ["72 tall", "6 ft tall", "seventy-two inches tall", "1829mm tall", "6' tall"],
];
const FEATS = ["with three shelves", "with 1 shelf", "with an open shelf", "with two drawers", "with two doors", "with four casters", "with double hang"];

test("D: a spelled or unit size beside a class F count builds like its digit spelling, and I41 holds", () => {
  const bad: string[] = [];
  for (const host of HOSTS) for (const f of FEATS) for (const g of SIZE_GROUPS) {
    const ref = obs(`${host} ${g[0]} ${f}`);
    for (const s of g.slice(1)) {
      const o = obs(`${host} ${s} ${f}`);
      if (box(o) !== box(ref)) bad.push(`${o.prompt}: ${box(o)} != digit ${box(ref)}`);
      if (o.i41.length) bad.push(`${o.prompt}: I41 ${o.i41.join("; ")}`);
    }
  }
  // Count after the size and size after the count (word order).
  for (const host of ["bookcase", "nightstand", "dresser"]) for (const f of ["with three shelves", "with two drawers"]) {
    const a = obs(`${host} ${f} 2 1/2 ft wide`), b = obs(`${host} ${f} 30 wide`);
    if (box(a) !== box(b)) bad.push(`${a.prompt}: ${box(a)} != ${box(b)}`);
  }
  emit(`CRITIC_BAD ${JSON.stringify(bad)}`);
  assert.deepEqual(bad, []);
});

// (A) the owner's named interactions.
test("A: owner's class F x size interactions", () => {
  const bad: string[] = [];
  for (const [q, digit] of [
    ["bookcase 2 1/2 ft wide with three shelves", "bookcase 30 wide with three shelves"],
    ["a 2 ft 6 in desk with 2 drawers", "a 30 inch desk with 2 drawers"],
    ["desk 2 ft 6 in wide with 2 drawers", "desk 30 wide with 2 drawers"],
    ["bookcase 30 wide with two 1/2 inch shelves", "bookcase 30 wide with two shelves"],
    ["bookcase 30 wide with two half inch shelves", "bookcase 30 wide with two 1/2 inch shelves"],
    ["bookcase 30 wide with three twelve inch shelves", "bookcase 30 wide with three 12 inch shelves"],
    ["bookcase two and a half feet wide with three shelves", "bookcase 30 wide with three shelves"],
    ["nightstand two feet wide with one drawer", "nightstand 24 wide with one drawer"],
    ["dresser 1.2 m wide with six drawers", "dresser 47 1/4 wide with six drawers"],
    ["closet 6 ft wide with two rods", "closet 72 wide with two rods"],
    ["wardrobe 4 ft wide with double hang", "wardrobe 48 wide with double hang"],
    ["media console 3 ft wide with 1 shelf", "media console 36 wide with 1 shelf"],
    ["desk 4 ft wide with an open shelf", "desk 48 wide with an open shelf"],
  ] as const) {
    const o = obs(q), d = obs(digit);
    if (o.i41.length) bad.push(`${q}: I41 ${o.i41.join("; ")}`);
    if (box(o) !== box(d)) bad.push(`${q}: ${box(o)} != ${digit}: ${box(d)}`);
  }
  emit(`CRITIC_BAD ${JSON.stringify(bad)}`);
  assert.deepEqual(bad, []);
});

// (B) "N feet" as legs: a count of feet is not a size. Digits ("4 feet") are pre-existing; the spelled form is the NR-1 question.
test("B: a spelled count of feet / legs is not read as a size", () => {
  const bad: string[] = [];
  for (const [q, plain] of [
    ["coffee table with four feet", "coffee table"],
    ["cabinet on four feet", "cabinet"],
    ["dresser with six feet", "dresser"],
    ["nightstand with four feet", "nightstand"],
    ["bench with four feet", "bench"],
    ["stool with three feet", "stool"],
    ["table with four foot legs", "table"],
    ["bookcase with two foot shelves", "bookcase"],
    ["bookcase with five one foot shelves", "bookcase"],
    ["coffee table 40 wide with four feet", "coffee table 40 wide"],
    ["side table with three feet", "side table"],
    ["cabinet 30 wide on four feet", "cabinet 30 wide"],
  ] as const) {
    const o = obs(q), p = obs(plain);
    obs(q.replace(/\b(four|six|three|two|one|five)\b/, (w) => String(["zero", "one", "two", "three", "four", "five", "six"].indexOf(w))));
    if (o.W !== p.W || o.D !== p.D || o.H !== p.H) bad.push(`${q}: ${box(o)} vs "${plain}" ${box(p)} (norm "${o.norm}")`);
  }
  emit(`CRITIC_BAD ${JSON.stringify(bad)}`);
  assert.deepEqual(bad, []);
});

// (C) stock and hardware names with a word between the size and the stock noun keep their typed size.
test("C: stock names with an adjective keep their size and build like release", () => {
  const bad: string[] = [];
  for (const [q, same] of [
    ["shelf from 1 1/2 inch oak dowels", "shelf from 1 1/2 inch dowels"],
    ["towel bar from 1 1/2 inch copper pipe", "towel bar from 1 1/2 inch pipe"],
    ["closet with a 1 1/4 inch closet rod", "closet with a 1 1/4 inch rod"],
    ["bench with 2 1/2 inch deck screws", "bench with 2 1/2 inch screws"],
    ["pipe shelf 1 1/2 inch black pipe", "pipe shelf 1 1/2 inch pipe"],
    ["bookcase from 1 1/2 inch cedar boards", "bookcase from 1 1/2 inch boards"],
    ["coat rack with 2 1/2 inch hooks", "coat rack with hooks"],
    ["dresser with 3 1/2 inch handles", "dresser"],
    ["dresser with 2 1/2 inch drawer pulls", "dresser"],
    ["nightstand with 1 1/4 inch knobs", "nightstand"],
    ["desk with a 1 1/2 inch top", "desk with a 1.5 inch top"],
    ["bench with 1 1/2 inch hardwood dowel legs", "bench with 1 1/2 inch dowel legs"],
    ["planter box from 3/4 inch cedar plywood", "planter box from 3/4 inch plywood"],
    ["bookcase from half inch birch plywood", "bookcase from 1/2 inch birch plywood"],
    ["toy box from quarter inch birch plywood", "toy box from 1/4 inch birch plywood"],
    ["wine rack from 1 1/2 inch pine dowels", "wine rack from 1 1/2 inch dowels"],
    ["swing with 1 1/2 inch manila rope", "swing with 1 1/2 inch rope"],
  ] as const) {
    const o = obs(q);
    obs(same);
    if (o.name.startsWith("THREW")) bad.push(`${q}: ${o.name}`);
    // Report-only on the twin; the build diff vs release is read from the CRITIC lines.
    if (/\d\.\d+ inch/.test(o.canon) && !/\d\.\d+ inch/.test(q)) emit(`CRITIC_NOTE ${JSON.stringify({ q, canon: o.canon })}`);
  }
  emit(`CRITIC_BAD ${JSON.stringify(bad)}`);
  assert.deepEqual(bad, []);
});

// (E) dollhouse / castle / bridge with counts (NR-1 adopted sites beside class F words).
test("E: report-only: adopted reader sites with class F words", () => {
  for (const q of [
    "dollhouse 3 ft tall with two doors", "dollhouse 36 tall with two doors", "dollhouse two and a half feet tall with 3 rooms",
    "dollhouse 30 tall one inch plywood", "dollhouse 30 tall 1 inch plywood", "dollhouse 2 1/2 ft tall with 4 windows",
    "castle from toothpicks 2 1/2 ft with two towers", "castle from toothpicks 30 with two towers",
    "popsicle stick bridge 2 1/2 ft long", "popsicle stick bridge 30 long", "skewer bridge 18 1/2 inch with two towers",
    "toy box 2 1/2 ft wide with a lid", "toy box 30 wide with a lid", "toy box 2 1/2 ft wide with four casters", "toy box 30 wide with four casters",
    "shoe rack 2 1/2 ft wide with 3 shelves", "shoe rack 30 wide with 3 shelves",
    "plant stand 3 ft tall with three tiers", "plant stand 36 tall with three tiers",
    "pantry cabinet 2 ft wide 7 ft tall with pull out shelves", "pantry cabinet 24 wide 84 tall with pull out shelves",
    "bookcase 36 wide 6 ft tall with 0 shelves", "bookcase 36 wide 72 tall with 0 shelves",
    "linen closet 30x18x72", "bookcase 914.4 x 457.2 x 762 mm",
  ]) obs(q);
  assert.ok(true);
});
