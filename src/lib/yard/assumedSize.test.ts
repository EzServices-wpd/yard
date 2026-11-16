/**
 * An axis the person did not type is one assumed-size record: the built box.
 * That record is the Assumed note. The header (labelled W × D × H) names the same
 * inches; the unlabelled name stays overall W × H × D.
 * A patch that only rewrites "toolbox" or "crate" fails the novel prompts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { headerTitle } from "./pdf";
import { headerSize } from "./headerSize";
import { inchFrac } from "./inchText";
import { isBedLongWide, typedAxesOf, type Axis } from "./typedAxesRead";
import type { YardProject } from "./types";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

const AXES: Axis[] = ["width", "height", "depth"];
const WORD: Record<Axis, string> = { width: "wide", height: "tall", depth: "deep" };
const near = (a: number, b: number) => Math.abs(a - b) < 0.05;

function shopInches(raw: string): number {
  return raw.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
}

/** Failures of the class rule for one compiled prompt. Empty means it holds. */
export function assumedSizeFailures(p: YardProject, prompt: string): string[] {
  if (p.refused || !p.panels.length || isBedLongWide(p.notes) || p.windowPkg || p.kind === "opening") return [];
  const box = p.overall;
  const typed = typedAxesOf(prompt, false, box);
  const notes = (p.notes ?? []).join("\n");
  const out: string[] = [];
  for (const a of AXES) {
    if (typed.has(a)) continue;
    const shown = headerSize(p);
    // The note names the box, or the finished depth the header prints when fronts stand proud.
    const ok = (v: number) => near(v, box[a]) || near(v, shown[a]);
    const said = [...notes.matchAll(new RegExp(String.raw`Assumed\s+(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*"\s*${WORD[a]}\b`, "gi"))].map((m) => shopInches(m[1]));
    if (!said.some(ok)) out.push(`${a} is ${inchFrac(box[a])}" and no Assumed note says so`);
    else if (said.some((v) => !ok(v))) out.push(`${a} Assumed note disagrees with the built size`);
  }
  const header = headerTitle(p, { features: false });
  const shown = headerSize(p);
  const hm = header.match(/([\d /]+)" W × ([\d /]+)" D × ([\d /]+)" H/);
  if (hm) {
    const got = { width: shopInches(hm[1]), depth: shopInches(hm[2]), height: shopInches(hm[3]) };
    for (const a of AXES) if (!near(got[a], shown[a])) out.push(`header ${a} ${inchFrac(got[a])} ≠ built ${inchFrac(shown[a])}`);
  }
  const trip = p.name.match(/([\d /]+)" × ([\d /]+)" × ([\d /]+)"/);
  if (trip) {
    const nums = [shopInches(trip[1]), shopInches(trip[2]), shopInches(trip[3])];
    const order = [box.width, box.height, box.depth];
    if (nums.some((n, i) => !near(n, order[i]))) out.push(`name ${trip[0]} ≠ overall ${order.map((n) => `${inchFrac(n)}"`).join(" × ")}`);
  }
  return out;
}

const LISTED = [
  "1x4 toolbox",
  "pine 1x4 toolbox 18 long",
  "toolbox 18 long",
  "tote 18 long",
  "caddy 14 long",
  "tool caddy",
  "crate 36 long",
  "dog crate 36 long",
  "dog crate 36 wide",
  "record crate",
];

/** Other boxes, benches and shelves with only a length. Not the listed prompts. */
const NOVEL = [
  "cedar bench 72 long",
  "pine shelf 48 long",
  "oak coffee table 42 long",
  "garden tote 15 long",
  "fishing caddy 11 long",
  "dog crate 42 long",
  "storage bench 50 long",
  "planter box 40 long",
  "pine 1x6 toolbox 22 long",
  "sewing tote 19 long",
  "bookcase 36 long",
  "nightstand 20 long",
];

test("a typed length on a crate, tote, caddy or toolbox is said, and the other axes are Assumed at the built size", () => {
  for (const q of LISTED) assert.deepEqual(assumedSizeFailures(generateFromPrompt(q), q), [], q);
});

test("the same rule holds for other boxes, benches and shelves with only a length", () => {
  assert.ok(NOVEL.length >= 6);
  for (const q of NOVEL) assert.deepEqual(assumedSizeFailures(generateFromPrompt(q), q), [], q);
});

test("pine 1x4 toolbox 18 long: the 1x4 is stock, not a typed depth, and the title matches the header order", () => {
  const q = "pine 1x4 toolbox 18 long";
  const p = generateFromPrompt(q);
  assert.equal(p.overall.width, 18);
  assert.equal(p.overall.height, 3.5);
  assert.equal(p.overall.depth, 10);
  assert.match(p.name, /18" × 3 1\/2" × 10"/);
  assert.match((p.notes ?? []).join("\n"), /Assumed 3 1\/2" tall \(default size\) — type a height to lock it\./);
  assert.match((p.notes ?? []).join("\n"), /Assumed 10" deep \(default size\) — type a depth to lock it\./);
  assert.doesNotMatch((p.notes ?? []).join("\n"), /Assumed 18" wide/);
  assert.match(headerTitle(p, { features: false }), /18" W × 10" D × 3 1\/2" H \(D, H assumed\)/);
  assert.equal(p.spec?.size.width.typed, true);
  assert.equal(p.spec?.size.height.assumed, true);
  assert.equal(p.spec?.size.depth.assumed, true);
});

test("1x4 toolbox: every axis is assumed at the built box, and the title is W × D × H", () => {
  const p = generateFromPrompt("1x4 toolbox");
  assert.equal(p.name, `Toolbox 20" × 3 1/2" × 10"`);
  assert.deepEqual(
    (p.notes ?? []).filter((n) => /^Assumed/.test(n)),
    [
      `Assumed 20" wide (default size) — type a width to lock it.`,
      `Assumed 3 1/2" tall (default size) — type a height to lock it.`,
      `Assumed 10" deep (default size) — type a depth to lock it.`,
    ],
  );
  assert.match(headerTitle(p, { features: false }), /20" W × 10" D × 3 1\/2" H/);
});

test("a crate title uses the header's W × D × H order of the built box", () => {
  const dog = generateFromPrompt("dog crate 36 long");
  assert.equal(dog.overall.width, 36);
  assert.equal(dog.name, `Dog crate 36" × ${inchFrac(dog.overall.height)}" × ${inchFrac(dog.overall.depth)}"`);
  assert.match(headerTitle(dog, { features: false }), new RegExp(`36" W × ${inchFrac(dog.overall.depth)}" D × ${inchFrac(dog.overall.height)}" H`));
  const crate = generateFromPrompt("crate 36 long");
  assert.equal(crate.name, `Crate 36" × 30" × 24"`);
  assert.match((crate.notes ?? []).join("\n"), /Assumed 30" tall \(default size\)/);
  assert.match((crate.notes ?? []).join("\n"), /Assumed 24" deep \(default size\)/);
});
