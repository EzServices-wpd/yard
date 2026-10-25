import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { hangingClearanceIssues, HANGER_CLEAR_IN, HANGER_MIN_DEPTH_IN, CLOSET_SHELF_CLEAR_IN, SHELF_CLEAR_FLOOR_IN, ROD_BAY_MAX_IN, sideHangFits, hangerInterior, rodBayTop, rodDropIn, unsupportedFloorSpan } from "./hangingClearance.ts";
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
  assert.equal(plan.totals.estCostUsd.toFixed(2), "193.68"); // #149 anti-tip kit (Ezra-approved, release 583efe86)
  assert.equal(linen.panels.filter((x) => /rod/i.test(x.name)).length, 0);
  const pantry = generateFromPrompt("pantry cabinet");
  assert.equal(pantry.overall.depth, 16);
  assert.equal(pantry.panels.filter((x) => /rod/i.test(x.name)).length, 0);
});

it("the rod step uses the same drop as the rod in the model", () => {
  const p = generateFromPrompt("wardrobe");
  const rod = p.panels.find((x) => /hanging rod/i.test(x.name))!;
  // Row 394: measured from the hat over the rod (the top of the hanging bay), not the top of the box.
  const drop = rodDropIn(rodBayTop(rod, p.panels, p.overall.height), rod.position.y);
  assert.equal(drop, 9);
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
  assert.match(tall, /1 fixed hat shelf over the rod and 1 adjustable \(3 pieces\)/);
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

it("row 391: a typed shelf count of 13 or more is never cut to the hat; a typed 0 stays a default", () => {
  for (const [q, n] of [["wardrobe with 13 shelves", 13], ["wardrobe with 20 shelves", 20], ["wardrobe 96 tall with 13 shelves", 13], ["wardrobe with a hanging rod and 13 shelves", 13], ["closet system with 15 shelves", 15]] as const) {
    const p = generateFromPrompt(q);
    assert.equal(p.refused ?? null, null, q);
    assert.equal(shelfLines(p.panels), n, q);
  }
  assert.match(headerTitle(generateFromPrompt("wardrobe with 13 shelves")), /· 13 shelves/);
  assert.equal(shelfLines(generateFromPrompt("wardrobe with 0 shelves").panels), shelfLines(generateFromPrompt("wardrobe").panels));
});

it("row 392: plural or 'hanging' rods hang clothes; a shallow box with rods is refused; two rods asked are built as a pair", () => {
  for (const q of ["closet with 2 rods 88 tall", "closet with rods", "closet with two rods 96 tall", "closet with hanging rods", "closet organizer with rods"]) {
    const p = generateFromPrompt(q);
    assert.ok(rodsOf(q).length >= 1, q);
    assert.equal(p.overall.depth, 24, q);
  }
  assert.equal(rodsOf("wardrobe 96 tall with 2 rods").length, 2);
  const shallow = generateFromPrompt("closet with rods 16 deep");
  assert.equal(shallow.panels.length, 0);
  assert.match(shallow.refused ?? "", /needs at least 22" deep so clothes can hang/);
});

it("row 393: a wide drawer wardrobe carries the drawer-bay floor on bay dividers under the drawer bank, with no span over the limit", () => {
  for (const q of ["wardrobe 76 wide with drawers", "wardrobe 80 wide with drawers", "wardrobe 82 wide with 3 drawers", "wardrobe 80 wide with 2 drawers"]) {
    const p = generateFromPrompt(q);
    const i7 = checkBuild(p, q, buildPlan(p)).filter((v) => v.id === "I7" && /Drawer bay bottom/.test(v.msg));
    assert.deepEqual(i7, [], q);
    const bays = p.panels.filter((x) => /^Bay divider \d+$/.test(x.name)).map((x) => x.position.x);
    for (const d of p.panels.filter((x) => /drawer bay divider/i.test(x.name)).filter(() => !/2 drawers/.test(q))) {
      assert.ok(bays.some((x) => Math.abs(x - d.position.x) < 0.05), `${q}: ${d.name} has no bay divider under it`);
    }
    for (const rod of rodsOf(q)) assert.ok(rod.size.width <= ROD_BAY_MAX_IN, q);
  }
});

it("row 432: 'hanging' or 'rails' naming another hung thing is not a clothes rod; only a wardrobe or closet build is refused for depth", () => {
  for (const q of ["pantry closet 12 deep with hanging baskets", "pantry closet 16 deep with hanging baskets", "closet 14 deep with hanging shoe organizer", "closet 16 deep with drawer rails", "closet with hanging file rails 15 deep", "garage closet 18 deep with hanging tools"]) {
    const p = generateFromPrompt(q);
    assert.ok(!p.refused && p.panels.length > 0, `${q}: ${p.refused}`);
  }
  assert.equal(rodsOf("closet 16 deep with drawer rails").length, 0);
  for (const q of ["pantry closet with hanging baskets", "closet with hanging shoe organizer"]) assert.ok(generateFromPrompt(q).overall.depth < HANGER_MIN_DEPTH_IN, q);
});

it("row 433: a typed rod count that does not fit is refused naming the height, never cut to one rod", () => {
  for (const q of ["closet with 2 rods", "closet with two rods", "closet with 2 rods 84 tall", "wardrobe with 2 rods"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.panels.length, 0, q);
    assert.match(p.refused ?? "", /needs at least 88" tall for 2 rods\. Nothing is built at 84"\./, q);
  }
  const three = generateFromPrompt("closet with 3 rods");
  assert.equal(three.panels.length, 0);
  assert.match(three.refused ?? "", /for 3 rods, taller than a 4×8 sheet cuts\. A closet up to 96" tall holds 2; one 44" wide and 88" tall holds 3\. Nothing is built at 84"\./);
  assert.equal(rodsOf("closet with 2 rods 88 tall").length, 2);
  assert.equal(rodsOf("closet 96 wide with 3 rods").length, 3);
  // The named height itself builds exactly the count.
  // Row 462: under 88" a 60" box splits into 3 bays, one rod each (every rod at least 18").
  assert.equal(rodsOf("closet 60 wide with 3 rods").length, 3);
  assert.equal(rodsOf("closet 60 wide 88 tall with 3 rods").length, 3);
  assert.equal(rodsOf("closet 44 wide 88 tall with 3 rods").length, 3);
});

it("row 438: a typed rod count is built exactly over the finished bays, or a note names the count built", () => {
  const cases: [string, number][] = [
    ["closet 48 wide 96 tall with 3 rods", 3], ["closet 60 wide 96 tall with 3 rods", 3], ["closet 72 wide 96 tall with 3 rods", 3],
    ["closet 48 wide 88 tall with 3 rods", 3], ["closet 72 wide 96 tall with 5 rods", 5], ["closet 120 wide 96 tall with 5 rods", 5],
  ];
  for (const [q, n] of cases) {
    const rods = rodsOf(q);
    assert.equal(rods.length, n, q);
    assert.equal(new Set(rods.map((r) => r.name)).size, rods.length, `${q}: rod names repeat`);
  }
  for (const q of ["closet two rods 70 wide 96 tall", "wardrobe 80 wide 2 rods 96 tall"]) {
    const p = generateFromPrompt(q);
    assert.equal(rodsOf(q).length, 3, q);
    assert.match(p.notes.join(" "), /You asked for 2 rods\. 3 rods are built, one in each of the 3 bays: a rod can't pass through a divider\./, q);
  }
  assert.deepEqual(rodsOf("closet with 2 rods 96 tall").map((r) => r.name).sort(), ["Lower hanging rod", "Upper hanging rod"]);
});

it("row 439: a rod size is not a rod count", () => {
  const plain = rodsOf("closet with rods").length;
  for (const q of ["closet with 1 1/4 rods", "closet with 1-1/4 rods", "wardrobe with 1 1/4 hanging rods", "closet with 3/4 rods", "closet with 2.5 rods", "closet with 2-3 rods", "closet with 2 1/2 rods"]) {
    const p = generateFromPrompt(q);
    assert.ok(!p.refused, `${q}: ${p.refused}`);
    assert.equal(rodsOf(q).length, plain, q);
  }
  for (const q of ["closet with 2 rods", "closet with two rods"]) assert.match(generateFromPrompt(q).refused ?? "", /for 2 rods/, q);
});

it("row 440: when drawers take the lower tier, the one-rod note names the drawers, not a height the box already has", () => {
  const notes = generateFromPrompt("wardrobe 96 tall with drawers and 2 rods").notes.join(" ");
  assert.match(notes, /You asked for 2 rods\. One rod is built: the drawers leave room for one rod/);
  assert.doesNotMatch(notes, /needs the box at least 88/);
});

it("row 446: a rod length is not a rod count; a singular rod counts only after 1-6", () => {
  const like = (q: string, twin: string) => {
    const p = generateFromPrompt(q);
    assert.ok(!p.refused, `${q}: ${p.refused}`);
    assert.equal(rodsOf(q).length, rodsOf(twin).length, q);
  };
  like("closet with a 36 rod", "closet with a rod");
  like("closet 24 rod", "closet 24 wide with a rod");
  like("closet with 96 rod", "closet with a rod");
  like("wardrobe with a 36 rod", "wardrobe with a rod");
  assert.match(generateFromPrompt("closet with 2 rod").refused ?? "", /for 2 rods/);
});

it("row 450: a count next to a rod size is read; a typed count that drops a typed double hang says so", () => {
  assert.equal(rodsOf("closet with two 1 1/4 rods 96 tall").length, 2);
  assert.match(generateFromPrompt("closet 96 tall double hang 1 rod").notes.join(" "), /You asked for 1 rod and double hang/);
  assert.doesNotMatch(generateFromPrompt("closet 48 wide 88 tall with 3 rods").notes.join(" "), /double hang\. The count wins/);
});

it("row 449: a 39-43 wide box builds the typed 3 or 4 rods exactly (the count is never cut)", () => {
  for (const n of [3, 4]) for (const w of [39, 40, 43]) for (const h of [88, 96]) {
    const q = `closet ${w} wide ${h} tall with ${n} rods`;
    assert.equal(generateFromPrompt(q).refused, undefined, q);
    assert.equal(rodsOf(q).length, n, q);
  }
});

it("row 461: a hanging rod never runs through a center support (39-43 wide, 60-80 tall)", () => {
  for (const q of ["wardrobe 40 wide 76 tall", "wardrobe 42 wide 60 tall", "closet 41 wide 72 tall with a rod", "wardrobe 43 wide 80 tall with a rod", "closet 40 wide 88 tall with 3 rods"]) {
    const p = generateFromPrompt(q);
    assert.deepEqual(checkBuild(p, q, buildPlan(p)).filter((v) => v.id === "I26").map((v) => v.msg), [], q);
  }
});

it("row 461: '2 rods' at 80\" tall in a 39-43 wide box builds exactly 2, side by side, not a refusal", () => {
  for (const q of ["closet 40 wide 80 tall with 2 rods", "wardrobe 42 wide 80 tall with 2 rods", "closet 39 wide 80 tall with 2 rods"]) {
    assert.equal(generateFromPrompt(q).refused, undefined, q);
    assert.equal(rodsOf(q).length, 2, q);
  }
});

it("row 463: a double hang that ends with more rods than typed does not say the count won", () => {
  const notes = generateFromPrompt("closet 72 wide 96 tall double hang 2 rods").notes.join(" ");
  assert.doesNotMatch(notes, /The count wins/);
  assert.match(notes, /You asked for 2 rods and double hang\. There is no double-hang pair: each of the 3 bays gets one rod/);
  assert.match(generateFromPrompt("closet 72 wide 96 tall double hang 1 rod").notes.join(" "), /You asked for 1 rod and double hang\./); // row 475
});

it("row 462: 62-68 wide under 88\" tall builds the typed 3 rods in 3 bays, as release did, not a refusal", () => {
  for (const prog of ["closet", "wardrobe"]) for (let w = 62; w <= 68; w++) for (const h of [60, 72, 80]) {
    const q = `${prog} ${w} wide ${h} tall with 3 rods`;
    assert.equal(generateFromPrompt(q).refused, undefined, q);
    const rods = rodsOf(q);
    assert.equal(rods.length, 3, q);
    assert.ok(Math.min(...rods.map((r) => r.size.width)) >= 18, q);
  }
  assert.match(generateFromPrompt("closet 40 wide 72 tall with 3 rods").refused ?? "", /needs at least 88" tall for 3 rods/);
});

it("row 483: a rod rebuild keeps the typed prompt (prompt bar, PDF 'You asked for', feedback, saved plans), never the engine's 'and n bays' / 'double hang'", () => {
  for (const q of ["closet 62 wide 80 tall with 3 rods", "wardrobe 64 wide 72 tall with 3 rods", "closet 60 wide with 3 rods", "closet 44 wide 96 tall with 3 rods"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.refused, undefined, q);
    assert.equal(rodsOf(q).length, 3, q);
    assert.equal(p.prompt, q, q);
  }
});
