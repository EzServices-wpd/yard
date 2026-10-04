import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { weekendUsesLatticeGraph } from "./weekendFamily.ts";
import { detectForm } from "./form.ts";

describe("open notes — rack tiers, closed shaft, cabinet", () => {
  it("a dowel rack is an open frame, not pin shelves", () => {
    const p = generateFromPrompt("dowel rack 24 wide 36 tall");
    const shelves = p.panels.filter((panel) => panel.type === "shelf" || /shelf/i.test(panel.name));
    assert.equal(shelves.length, 0);
    assert.match(p.primaryMaterialId, /dowel/);
    assert.ok(p.instances.length > 0);
  });

  it("a picked sheet outside the sheet-good class is every panel", () => {
    const p = generateFromPrompt("console table 54 wide 30 tall 14 deep from cardboard");
    assert.match(p.primaryMaterialId, /cardboard/);
    assert.ok(p.panels.length > 0);
    assert.equal(p.panels.every((panel) => /cardboard/.test(panel.materialId ?? "")), true);
    assert.ok(p.overall.width > 50);
    assert.ok(p.overall.height > 28);
  });

  it("a closed shaft is not a lattice graph", () => {
    assert.equal(weekendUsesLatticeGraph("lighthouse 18 wide 48 tall", "tower"), false);
    assert.notEqual(detectForm("lighthouse 18 wide 48 tall", { width: 18, height: 48, depth: 18 }).kind, "lattice");
    const p = generateFromPrompt("lighthouse 18 wide 48 tall from cardboard");
    assert.notEqual(p.kind, "lattice");
    assert.notEqual(p.kind, "eiffel");
  });

  it("a cabinet stays a cabinet", () => {
    const p = generateFromPrompt("spice cabinet 12 wide 20 tall 6 deep");
    assert.match(p.name.toLowerCase(), /cabinet/);
    assert.equal(p.name.toLowerCase().includes("rack"), false);
    assert.equal(p.fitted?.unit.doors, true);
    assert.equal((p.fitted?.unit.shelfCount ?? 0) > 0 || p.panels.some((panel) => panel.type === "shelf"), true);
  });

  it("a form that already places members stays that form on a named sheet", () => {
    const p = generateFromPrompt("cardboard robot 14 tall");
    assert.equal(p.kind, "figure");
    assert.match(p.name.toLowerCase(), /robot/);
    assert.match(p.primaryMaterialId, /cardboard/);
    assert.equal(p.panels.some((panel) => /wall|floor/i.test(panel.name)), false);
    assert.ok(p.overall.height > 12);
    assert.ok(p.overall.height < 18);
  });

  it("a sheet at a typed width and height is faces, not a ripped frame", () => {
    const p = generateFromPrompt("cardboard drum 12 wide 16 tall");
    assert.match(p.primaryMaterialId, /cardboard/);
    assert.ok(Math.abs(p.overall.width - 12) < 0.5);
    assert.ok(Math.abs(p.overall.height - 16) < 0.5);
    assert.equal(p.panels.some((panel) => /wall|floor/i.test(panel.name)), true);
    assert.equal(p.panels.some((panel) => /leg|brace/i.test(panel.name)), false);
    assert.ok(p.panels.length < 12);
  });

  it("a general lying body on sheet stock is faces of the typed envelope", () => {
    const p = generateFromPrompt("cardboard suitcase 18 long 12 tall");
    assert.match(p.primaryMaterialId, /cardboard/);
    assert.notEqual(p.kind, "vehicle");
    assert.equal(p.panels.some((panel) => /wall|floor/i.test(panel.name)), true);
    assert.equal(/Ripped into/.test(p.notes.join(" ")), false);
    assert.ok(Math.abs(p.overall.width - 18) < 0.5);
    assert.ok(Math.abs(p.overall.height - 12) < 0.5);
  });

  it("a named sheet with no form of its own stays a shell", () => {
    const p = generateFromPrompt("cardboard mailbox 8 wide 18 tall");
    assert.ok(p.panels.length > 0);
    assert.notEqual(p.kind, "figure");
    assert.match(p.primaryMaterialId, /cardboard/);
  });

  it("a named board section is the member stock, not a class usual", () => {
    const p = generateFromPrompt("pine 1x6 bench 36 long");
    assert.equal(p.primaryMaterialId, "lumber-1x6-8");
    const legs = p.panels.filter((panel) => /leg/i.test(panel.name));
    assert.ok(legs.length > 0);
    for (const leg of legs) {
      assert.equal(leg.materialId, "lumber-1x6-8");
      const cross = [leg.size.width, leg.size.depth].sort((a, b) => a - b);
      assert.ok(Math.abs(cross[0] - 0.75) < 0.05);
      assert.ok(Math.abs(cross[1] - 5.5) < 0.05);
    }
    assert.equal(/2×4|2x4/.test(p.notes.join(" ")), false);
    assert.ok(Math.abs(p.overall.width - 36) < 0.5);
  });
});
