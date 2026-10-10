import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

const strips = (q: string) =>
  generateFromPrompt(q).panels.filter((p) => {
    const [t, face, len] = [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b);
    return Math.abs(t - 0.75) < 0.01 && face <= 5.51 && len >= 3 * face && p.type !== "door" && p.type !== "drawer";
  });

describe("with no stock typed, members are lumber where the real object uses lumber", () => {
  for (const q of ["dining chair", "porch swing", "workbench", "blanket ladder", "queen platform bed", "step stool", "cat tree", "bar stool", "potting bench", "chicken coop", "daybed"]) {
    it(q, () => {
      const ply = strips(q).filter((p) => /^plywood/.test(p.materialId ?? ""));
      assert.deepEqual(ply.map((p) => p.name), []);
    });
  }
  it("blanket ladder is two rails and rungs", () => {
    const names = generateFromPrompt("blanket ladder").panels.map((p) => p.name);
    assert.ok(names.includes("Left rail") && names.includes("Right rail") && names.filter((n) => /^Rung \d+$/.test(n)).length >= 3, names.join());
  });
  it("queen platform bed sits 14 inches low", () => {
    assert.equal(generateFromPrompt("queen platform bed").overall.height, 14);
  });
  it("typed stock wins and the form stays", () => {
    const a = generateFromPrompt("bar stool"), b = generateFromPrompt("bar stool from plywood");
    assert.deepEqual(b.panels.map((p) => p.name), a.panels.map((p) => p.name));
    assert.deepEqual(b.overall, a.overall);
    assert.ok(b.panels.every((p) => p.materialId === "plywood-3-4-4x8"));
  });
});
