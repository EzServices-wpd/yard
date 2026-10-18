/**
 * F17 front sections (I31) and hollow drawers (I32). Rule: doors, drawers and shelves never share one opening or
 * volume, and asked drawers always build. A drawer count gets its own drawer section (columns past ~36"), doors their
 * own door section, shelves only in door or open sections; "drawers" with no doors builds no doors; slides are the
 * longest standard length that fits the inside depth; drawer bottoms are the cut list's 1/4" ply in steps and cut list.
 * Every drawer is a hollow box of 5 parts (front, two sides, back, 1/4" ply bottom) sharing one drawerId, open on top.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { i31, i32 } from "./invariants.ts";
import { drawerBoxes } from "./hollowDrawers.ts";
import { slideForDepth } from "./stockLook.ts";
import { woodCutPieceCount } from "./shopPlural.ts";
import type { YardProject } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SWEEP: string[] = JSON.parse(readFileSync(join(here, "../../../evals/sweeps/f17-prompts.json"), "utf8"));
const doors = (p: YardProject) => p.panels.filter((x) => x.type === "door").length;
const shelves = (p: YardProject) => p.panels.filter((x) => x.type === "shelf").length;

describe("F17 front sections (I31)", () => {
  it("the 20-prompt sweep of doors-and-drawers builds passes I31 and builds every asked drawer", () => {
    assert.equal(SWEEP.length, 20);
    for (const q of SWEEP) {
      const p = generateFromPrompt(q);
      assert.deepEqual(i31(p, q, buildPlan(p)).map((v) => v.msg), [], q);
      assert.ok(drawerBoxes(p.panels).length > 0, `${q}: drawers built`);
    }
  });
  it("a drawers-only ask builds no doors and no shelf through a drawer (filing cabinet)", () => {
    for (const q of ["filing cabinet 2 drawers", "filing cabinet 4 drawers 18 wide 52 tall 24 deep"]) {
      const p = generateFromPrompt(q);
      assert.equal(doors(p), 0, q);
      assert.equal(shelves(p), 0, q);
    }
    assert.equal(drawerBoxes(generateFromPrompt("filing cabinet 4 drawers 18 wide 52 tall 24 deep").panels).length, 4);
  });
  it("doors and drawers get separate sections; typed counts build exactly", () => {
    for (const [q, nd, nr] of [
      ["tool cabinet 24 wide 36 tall 12 deep with 2 doors and 3 drawers", 2, 3],
      ["hall cabinet 36 wide 34 tall 14 deep with 2 doors and 2 drawers", 2, 2],
      ["file cabinet 20 wide 30 tall 24 deep with 1 door and 1 drawer", 1, 1],
      ["kitchen island 48 wide 36 tall 24 deep with 2 drawers and 2 doors", 2, 2],
      ["nightstand with a drawer and a door", 1, 1],
    ] as const) {
      const p = generateFromPrompt(q);
      assert.equal(doors(p), nd, q);
      assert.equal(drawerBoxes(p.panels).length, nr, q);
      const fronts = p.panels.filter((x) => /drawer front/i.test(x.name));
      for (const d of p.panels.filter((x) => x.type === "door")) assert.ok(fronts.every((f) => d.position.y >= f.position.y + f.size.height - 0.05 || d.position.y + d.size.height <= f.position.y + 0.05), `${q}: ${d.name} clear of the drawer fronts`);
    }
  });
  it("walnut dresser 6 drawers 60 wide: two columns, slides fit the box, 1/4 in ply bottoms in steps and cut list", () => {
    const p = generateFromPrompt("walnut dresser 6 drawers 60 wide");
    const plan = buildPlan(p);
    const boxes = drawerBoxes(p.panels);
    assert.equal(boxes.length, 6);
    assert.ok(boxes.every((b) => b.size.width <= 36), boxes.map((b) => b.size.width).join(","));
    assert.equal(new Set(boxes.map((b) => Math.round(b.position.x))).size, 2);
    const slide = plan.bom.find((b) => /slide/i.test(b.name));
    const len = Number(slide?.name.match(/(\d+)\s*(?:"|in)/)?.[1]);
    assert.equal(len, slideForDepth(p.overall.depth - 0.25));
    assert.ok(boxes.every((b) => Math.abs(b.size.depth - len) < 0.01), "box depth = slide length");
    const bottom = plan.cutList.find((c) => c.name === "Drawer bottom");
    assert.equal(bottom?.quantity, 6);
    assert.equal(bottom?.thicknessIn, 0.25);
    assert.match(bottom!.id, /^plywood-1-4/);
    assert.doesNotMatch(plan.instructions.map((s) => `${s.title} ${s.body ?? ""}`).join("\n"), /Drawer bottom[s]? \(\d+ boards/i);
  });
  it("the default kitchen island and a jewelry box with drawers build fronts", () => {
    const island = generateFromPrompt("kitchen island");
    assert.ok(drawerBoxes(island.panels).length >= 1 && doors(island) >= 1);
    for (const q of ["jewelry box with drawers", "jewelry box 12 wide 8 tall 8 deep with 3 drawers"]) assert.ok(drawerBoxes(generateFromPrompt(q).panels).length >= 1, q);
    assert.equal(drawerBoxes(generateFromPrompt("jewelry box 12 wide 8 tall 8 deep with 3 drawers").panels).length, 3);
  });
  it("linen has no drawers", () => {
    assert.equal(drawerBoxes(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep").panels).length, 0);
  });
});

describe("F17 hollow drawers (I32)", () => {
  const DRAWER_BUILDS = [...SWEEP, "dresser", "nightstand", "pocket vanity", "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", "drawer unit 24 wide"];
  it("every drawer is 5 parts sharing one drawerId: front, two sides, back and a 1/4 in bottom, open on top", () => {
    for (const q of DRAWER_BUILDS) {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      assert.deepEqual(i32(p, plan).map((v) => v.msg), [], q);
      const ids = new Set(p.panels.filter((x) => x.drawerId).map((x) => x.drawerId!));
      assert.ok(ids.size > 0, q);
      for (const id of ids) {
        const parts = p.panels.filter((x) => x.drawerId === id);
        const kinds = parts.map((x) => x.drawerPart).sort().join(",");
        assert.equal(kinds, "back,bottom,front,side,side", `${q} ${id}`);
        const bottom = parts.find((x) => x.drawerPart === "bottom")!;
        assert.equal(bottom.size.height, 0.25, `${q} ${id} bottom`);
        // Open top: no part of any kind lies over the box between its sides.
        const box = drawerBoxes(parts)[0]!;
        const top = box.position.y + box.size.height;
        const lid = p.panels.find((x) => x.drawerId === id && x.drawerPart !== "front" && x.drawerPart !== "side" && x.position.y > bottom.position.y + 0.3 && x.size.height < 1 && x.size.width > box.size.width * 0.5);
        assert.equal(lid, undefined, `${q} ${id}: open top under ${top}`);
      }
    }
  });
  it("the model's parts and the cut list agree, so price and Buy follow the hollow parts", () => {
    for (const q of ["nightstand 20 wide 16 deep 24 tall with one drawer", "walnut dresser 6 drawers 60 wide", "filing cabinet 2 drawers"]) {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      assert.equal(woodCutPieceCount(p), plan.totals.pieces, q);
      const sides = plan.cutList.filter((c) => c.name === "Drawer side").reduce((n, c) => n + c.quantity, 0);
      assert.equal(sides, 2 * drawerBoxes(p.panels).length, `${q}: one Drawer side row family, two per drawer`);
    }
  });
  it("a solid drawer block fails I32 (the red the fix closed)", () => {
    const p = generateFromPrompt("nightstand");
    const solid = { ...p, panels: [...p.panels.filter((x) => !x.drawerId || x.drawerPart === "front").map((x) => ({ ...x, drawerId: undefined, drawerPart: undefined })), ...drawerBoxes(p.panels).map((b) => ({ ...b, drawerId: undefined }))] };
    assert.ok(i32(solid, buildPlan(solid)).length > 0);
  });
});
