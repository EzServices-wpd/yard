import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { hangingClearanceIssues, HANGER_CLEAR_IN, HANGER_MIN_DEPTH_IN, CLOSET_SHELF_CLEAR_IN, SHELF_CLEAR_FLOOR_IN, ROD_BAY_MAX_IN, sideHangFits, hangerInterior, rodDropIn, unsupportedFloorSpan } from "./hangingClearance.ts";
import type { Panel } from "./types.ts";

const PROBES: { id: string; prompt: string; shelves?: number }[] = JSON.parse(
  readFileSync(new URL("../../../evals/wardrobe-probes.json", import.meta.url), "utf8"),
);

const rodsOf = (prompt: string) => generateFromPrompt(prompt).panels.filter((p) => /hanging rod|clothes rod/i.test(p.name));
const longAxis = (p: { size: { width: number; height: number; depth: number } }) =>
  p.size.width >= p.size.height && p.size.width >= p.size.depth ? "width" : p.size.depth >= p.size.height ? "depth" : "height";
const shelfLines = (panels: Panel[]) => {
  const lines = new Set<string>();
  for (const p of panels) {
    if (p.type !== "shelf") continue;
    lines.add(p.name.match(/shelf\s*(\d+)/i)?.[1] ?? p.name);
  }
  return lines.size;
};

it("a clothes rod is side to side in hanger depth, or the build is refused", () => {
  const prompts = [
    "wardrobe", "wardrobe 36 wide", "wardrobe 76 tall", "wardrobe 22 deep", "wardrobe 24 deep", "wardrobe 26 deep",
    "wardrobe 8 deep", "wardrobe 15 3/4 deep", "wardrobe 12 deep", "wardrobe 19 deep", "wardrobe 20 deep",
    "wardrobe with drawers", "wardrobe with a rod", "wardrobe for a 7 ft ceiling",
    "wardrobe 4 feet wide, 6 feet tall, 2 feet deep with a hanging rod",
    "Closet system - 102in tall 80in wide", "closet system 80 wide 102 tall double hang",
    "linen closet 31.5 wide 78 tall 16 deep", "pantry cabinet",
  ];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    assert.deepEqual(hangingClearanceIssues(p), [], q);
    assert.ok(!checkBuild(p, q).some((v) => v.id === "I39"), q);
  }
});

it("an untyped wardrobe hangs side to side in a 24\" box, on a real closet rod", () => {
  for (const q of ["wardrobe", "wardrobe 36 wide", "wardrobe 76 tall"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.overall.depth, 24, q);
    assert.ok(sideHangFits(hangerInterior(p)), q);
    assert.match(headerTitle(p), /24 3\/4" D/, q);
    const rod = rodsOf(q)[0];
    assert.equal(longAxis(rod), "width", q);
    assert.ok(rod.position.y + rod.size.height / 2 >= 64 && rod.position.y + rod.size.height / 2 <= 70, q);
    assert.equal(rod.materialId, "closet-rod");
    assert.ok(buildPlan(p).bom.some((b) => /closet rod/i.test(b.name)), q);
    const dividers = p.panels.filter((x) => /divider/i.test(x.name));
    assert.ok(dividers.every((d) => /^Center divider\b/.test(d.name)), q);
    assert.equal(dividers.filter((d) => /bay divider/i.test(d.name)).length, 0, q);
  }
});

it("a typed 22 or 24 stays, and a typed 8\" depth is refused with the minimum", () => {
  assert.equal(generateFromPrompt("wardrobe 22 deep").overall.depth, 22);
  assert.equal(generateFromPrompt("wardrobe 24 deep").overall.depth, 24);
  assert.equal(longAxis(rodsOf("wardrobe 22 deep")[0]), "width");
  const refused = generateFromPrompt("wardrobe 8 deep");
  assert.equal(refused.panels.length, 0);
  assert.match(refused.refused ?? "", new RegExp(`${HANGER_MIN_DEPTH_IN}`));
  assert.match(refused.refused ?? "", new RegExp(`${HANGER_CLEAR_IN}`));
  assert.match(refused.refused ?? "", /8/);
});

it("below about 20\" inside, a hanging build is refused and names 22\"; a shelves-only closet still builds", () => {
  for (const q of ["wardrobe 12 deep", "wardrobe 15 3/4 deep", "wardrobe 16 deep", "wardrobe 19 deep", "closet system 96 wide 16 deep", "wardrobe 8 deep"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.panels.length, 0, q);
    assert.match(p.refused ?? "", new RegExp(`${HANGER_MIN_DEPTH_IN}`), q);
    assert.doesNotMatch(p.refused ?? "", /pull-out/i, q);
  }
  assert.equal(longAxis(rodsOf("wardrobe 20 deep")[0]), "width");
  const linen = generateFromPrompt("linen closet 24 wide 78 tall 16 deep");
  assert.ok(linen.panels.length > 0 && !linen.panels.some((x) => /rod/i.test(x.name)));
  const closet = generateFromPrompt("closet 30 wide 80 tall 16 deep");
  assert.ok(closet.panels.length > 0 && !closet.refused, "closet");
  assert.equal(closet.panels.filter((x) => /rod/i.test(x.name)).length, 0);
});

it("a wide closet splits the rod with real dividers, and double hang sits near 42 and 84", () => {
  const closet = generateFromPrompt("Closet system - 102in tall 80in wide");
  assert.equal(closet.overall.depth, 24);
  assert.equal(closet.overall.width, 80);
  assert.equal(closet.overall.height, 102);
  const rods = closet.panels.filter((x) => /hanging rod/i.test(x.name));
  assert.equal(rods.length, 3);
  assert.ok(rods.every((r) => longAxis(r) === "width" && r.size.width <= ROD_BAY_MAX_IN));
  assert.ok(closet.panels.filter((x) => /bay divider/i.test(x.name)).length >= 2);
  const doubled = generateFromPrompt("closet system 80 wide 102 tall double hang");
  const ys = [...new Set(doubled.panels.filter((x) => /hanging rod/i.test(x.name)).map((r) => Math.round(r.position.y)))].sort((a, b) => a - b);
  assert.deepEqual(ys, [42, 84]);
  const wide = generateFromPrompt("wardrobe 48 wide");
  const wideRods = wide.panels.filter((x) => /hanging rod/i.test(x.name));
  assert.ok(wideRods.length >= 2 && wideRods.every((r) => r.size.width <= ROD_BAY_MAX_IN));
  assert.ok(wide.panels.some((x) => /center divider|bay divider/i.test(x.name)));
});

it("drawers keep the rod under the drawer bank", () => {
  const rod = rodsOf("wardrobe with drawers")[0];
  assert.ok(rod && longAxis(rod) === "width" && rod.position.y < 64);
});

it("the linen closet canary is unchanged, and a pantry does not grow a rod", () => {
  const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(headerTitle(linen), 'Linen · 31 1/2" W × 16" D × 78" H');
  assert.deepEqual([linen.overall.width, linen.overall.depth, linen.overall.height], [31.5, 16, 78]);
  const plan = buildPlan(linen);
  assert.equal(plan.totals.pieces, 11);
  assert.equal(plan.totals.estCostUsd.toFixed(2), "183.70");
  assert.equal(linen.panels.filter((x) => /rod/i.test(x.name)).length, 0);
  const pantry = generateFromPrompt("pantry cabinet");
  assert.equal(pantry.overall.depth, 16);
  assert.equal(pantry.panels.filter((x) => /rod/i.test(x.name)).length, 0);
});

it("the rod step uses the same drop as the rod in the model", () => {
  const p = generateFromPrompt("wardrobe");
  const rod = p.panels.find((x) => /hanging rod/i.test(x.name))!;
  const drop = rodDropIn(p.overall.height, rod.position.y);
  assert.equal(drop, 18);
  const step = buildPlan(p).instructions.find((s) => /hanging rod/i.test(s.title));
  assert.match(step?.description ?? "", new RegExp(`about ${drop}" down`));
});

/** Clear openings between shelf faces, plus the openings off the rod (or the bottom) and the top. */
function shelfClearGaps(panels: Panel[]): number[] {
  const rows = [...new Map(panels.filter((p) => p.type === "shelf").map((p) => [p.position.y.toFixed(3), p])).values()].sort(
    (a, b) => a.position.y - b.position.y,
  );
  if (!rows.length) return [];
  const thick = rows[0].size.height;
  const top = panels.find((p) => p.type === "top");
  const rod = panels.filter((p) => /hanging rod/i.test(p.name)).sort((a, b) => b.position.y - a.position.y)[0];
  const bottom = panels.find((p) => p.type === "bottom");
  const y0 = rod ? rod.position.y + Math.min(rod.size.width, rod.size.height, rod.size.depth) : bottom ? bottom.position.y + bottom.size.height : 0;
  const y1 = top ? top.position.y : rows[rows.length - 1].position.y + thick;
  const gaps = [rows[0].position.y - y0];
  for (let i = 0; i < rows.length - 1; i++) gaps.push(rows[i + 1].position.y - (rows[i].position.y + thick));
  gaps.push(y1 - (rows[rows.length - 1].position.y + thick));
  return gaps;
}

it("a typed shelf count is built exactly, or refused with no parts", () => {
  const cases: [string, number][] = [
    ...PROBES.filter((p) => p.shelves != null).map((p) => [p.prompt, p.shelves!] as [string, number]),
    ["wardrobe with 8 shelves", 8],
    ["wardrobe with 10 shelves", 10],
    ["wardrobe 36 wide 72 tall with 5 shelves", 5],
    ["wardrobe 72 tall with 4 shelves", 4],
    ["wardrobe 36 tall with 12 shelves", 12],
  ];
  for (const [q, n] of cases) {
    const p = generateFromPrompt(q);
    if (p.refused || !p.panels.length) {
      assert.equal(p.panels.length, 0, q);
      assert.match(p.refused ?? "", /at least [\d /]+" tall/, q);
      continue;
    }
    assert.equal(shelfLines(p.panels), n, q);
    const gaps = shelfClearGaps(p.panels);
    assert.ok(gaps.length > 0 && Math.min(...gaps) >= SHELF_CLEAR_FLOOR_IN - 1e-6, `${q} gap ${Math.min(...gaps)}`);
    assert.ok(Math.min(...gaps) + 1e-6 >= CLOSET_SHELF_CLEAR_IN, `${q} gap ${Math.min(...gaps)}`);
  }
});

it("closet shelves keep about 7\" clear, and a refusal names a count that itself builds", () => {
  assert.ok(CLOSET_SHELF_CLEAR_IN >= SHELF_CLEAR_FLOOR_IN);
  const prompts = [
    "wardrobe",
    "wardrobe 36 tall with 10 shelves",
    "wardrobe 72 tall with 12 shelves",
    "wardrobe 36 wide 72 tall with 5 shelves",
    "wardrobe 72 tall with 4 shelves",
    "wardrobe with 4 shelves",
    "wardrobe with 10 shelves",
    "wardrobe with 8 shelves",
  ];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    if (p.refused || !p.panels.length) {
      assert.equal(p.panels.length, 0, q);
      const height = p.refused?.match(/at least ([\d /]+)" tall/)?.[1];
      const asked = Number(q.match(/(\d+)\s+shel/i)?.[1]);
      assert.ok(height && Number.isFinite(asked), q);
      const againQ = /(?:tall|high)/i.test(q) ? q.replace(/\d[\d /]*\s*(?:tall|high)/i, `${height} tall`) : q.replace(/wardrobe/i, `wardrobe ${height} tall`);
      const again = generateFromPrompt(againQ);
      assert.equal(again.refused, undefined, `${q} named ${height}: ${again.refused}`);
      assert.ok(again.panels.length > 0, `${q} named ${height}`);
      assert.equal(shelfLines(again.panels), asked, againQ);
      const gaps = shelfClearGaps(again.panels);
      assert.ok(gaps.length > 0 && Math.min(...gaps) + 1e-6 >= CLOSET_SHELF_CLEAR_IN, `${q} named ${height} gap ${Math.min(...gaps)}`);
      assert.deepEqual(checkBuild(again, againQ).filter((v) => ["I1", "I3", "I7", "I9", "I13"].includes(v.id)), [], q);
      continue;
    }
    const gaps = shelfClearGaps(p.panels);
    assert.ok(gaps.length > 0 && Math.min(...gaps) + 1e-6 >= CLOSET_SHELF_CLEAR_IN, `${q} gap ${Math.min(...gaps)}`);
  }
  const depth = generateFromPrompt("wardrobe 19 deep");
  assert.match(depth.refused ?? "", new RegExp(`${HANGER_MIN_DEPTH_IN}`));
  const built = generateFromPrompt(`wardrobe ${HANGER_MIN_DEPTH_IN} deep`);
  assert.ok(built.panels.length > 0 && !built.refused);
  assert.equal(longAxis(rodsOf(`wardrobe ${HANGER_MIN_DEPTH_IN} deep`)[0]), "width");
});

it("typed shelves keep about 40\" of hang under the rod, or the rod is left out", () => {
  const cases: [string, number][] = [
    ["wardrobe with 6 shelves", 6],
    ["wardrobe 84 tall with 6 shelves", 6],
    ["wardrobe 72 tall with 4 shelves", 4],
    ["wardrobe 66 tall with 3 shelves", 3],
    ["wardrobe 96 tall with 6 shelves", 6],
    ["wardrobe with 4 shelves", 4],
  ];
  for (const [q, n] of cases) {
    const p = generateFromPrompt(q);
    assert.ok(!p.refused && p.panels.length > 0, q);
    assert.equal(shelfLines(p.panels), n, q);
    const gaps = shelfClearGaps(p.panels);
    assert.ok(gaps.length > 0 && Math.min(...gaps) + 1e-6 >= CLOSET_SHELF_CLEAR_IN, `${q} gap ${Math.min(...gaps)}`);
    const rods = p.panels.filter((x) => /hanging rod/i.test(x.name));
    const note = p.notes.join(" ");
    if (!rods.length) {
      assert.match(note, /hanging rod is left out/, q);
      assert.doesNotMatch(note, /full length|shirts hang/, q);
      continue;
    }
    const y = Math.min(...rods.map((r) => r.position.y));
    assert.ok(y + 1e-6 >= 40, `${q} rod ${y}`);
    if (y + 1e-6 >= 64) assert.match(note, /coats and shirts hang full length/, q);
    else {
      assert.doesNotMatch(note, /full length/, q);
      assert.match(note, /so shirts hang/, q);
    }
  }
});

it("a shelf phrase on a wardrobe is one shelf, not a 12\" deep box", () => {
  for (const q of ["wardrobe with 1 shelf", "wardrobe with a shelf", "wardrobe with one shelf"]) {
    const p = generateFromPrompt(q);
    assert.ok(!p.refused && p.panels.length > 0, q);
    assert.equal(p.overall.depth, 24, q);
    assert.equal(p.overall.height, 84, q);
    assert.equal(shelfLines(p.panels), 1, q);
    const rod = p.panels.find((x) => /hanging rod/i.test(x.name));
    assert.ok(rod && rod.position.y + 1e-6 >= 64, q);
    assert.match(p.notes.join(" "), /coats and shirts hang full length/, q);
  }
});

it("a typed wardrobe depth does not also set the width", () => {
  const p = generateFromPrompt("wardrobe 19 3/4 deep");
  assert.ok(!p.refused && p.panels.length > 0);
  assert.equal(p.overall.depth, 19.75);
  assert.equal(p.overall.width, 36);
  assert.equal(p.overall.height, 84);
});

it("no wardrobe rod or raised floor spans past 42 inches", () => {
  const prompts = [
    "wardrobe", "wardrobe 36 wide", "wardrobe 48 wide", "wardrobe 54 wide", "wardrobe 60 wide", "wardrobe 72 wide", "wardrobe 96 wide",
    "wardrobe 48 wide 72 tall", "wardrobe 60 wide 72 tall", "wardrobe 72 wide 72 tall", "wardrobe 48 wide 96 tall", "wardrobe 72 wide 96 tall",
    "wardrobe with drawers", "wardrobe with 2 drawers", "wardrobe 48 wide with 2 drawers", "wardrobe 54 wide with 2 drawers",
    "wardrobe 60 wide with 3 drawers", "wardrobe 72 wide with 2 drawers", "wardrobe 96 wide with 2 drawers", "wardrobe 72 wide with 3 shelves",
  ];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    assert.ok(p.panels.length > 0 && !p.refused, q);
    for (const rod of p.panels.filter((x) => /hanging rod/i.test(x.name))) {
      assert.ok(rod.size.width <= ROD_BAY_MAX_IN + 1e-6, `${q} ${rod.name} ${rod.size.width}`);
    }
    for (const floor of p.panels.filter((x) => x.type === "bottom" && x.position.y >= 0.3)) {
      const span = unsupportedFloorSpan(floor, p.panels);
      assert.ok(span <= ROD_BAY_MAX_IN + 1e-6, `${q} ${floor.name} spans ${span}`);
    }
    assert.deepEqual(checkBuild(p, q).filter((v) => ["I1", "I7"].includes(v.id)).map((v) => v.id), [], q);
  }
  for (const q of ["wardrobe 48 wide", "wardrobe 72 wide"]) {
    const note = generateFromPrompt(q).notes.join(" ");
    assert.match(note, /fixed hat shelf/, q);
    assert.match(note, /No pinned shelf above the hat/, q);
    assert.doesNotMatch(note, /\d+ adjustable shelf line/, q);
    assert.match(note, /in each of [23] bays/, q);
  }
  const tall = generateFromPrompt("wardrobe 72 wide 96 tall").notes.join(" ");
  assert.match(tall, /fixed hat shelf/);
  assert.match(tall, /1 adjustable shelf line above it/);
  assert.match(tall, /in each of 3 bays/);
  assert.doesNotMatch(tall, /No pinned shelf above the hat/);
});

it("a rod note does not claim shelves above the rod when nothing is there", () => {
  for (const q of ["wardrobe with 2 drawers", "wardrobe 72 wide with 2 drawers", "wardrobe 72 wide 72 tall"]) {
    const note = generateFromPrompt(q).notes.join(" ");
    assert.match(note, /closet rod/, q);
    assert.doesNotMatch(note, /with the shelves above it/, q);
    assert.doesNotMatch(note, /shelves above/, q);
  }
  const four = generateFromPrompt("wardrobe with 4 shelves");
  const shelves = four.panels.filter((p) => p.type === "shelf");
  const lines = new Set(shelves.map((s) => s.position.y.toFixed(2))).size;
  assert.equal(lines, 4);
  assert.match(four.notes.join(" "), /1 fixed hat shelf over the rod and 3 adjustable \(6 pieces\)/);
});

it("every wardrobe probe clears the hanger rule", () => {
  const bad: string[] = [];
  for (const probe of PROBES) {
    const p = generateFromPrompt(probe.prompt);
    const issues = hangingClearanceIssues(p);
    if (issues.length) bad.push(`${probe.id}: ${issues.join("; ")}`);
    if (probe.shelves != null && p.panels.length) assert.equal(shelfLines(p.panels), probe.shelves, probe.id);
  }
  assert.deepEqual(bad, []);
});
