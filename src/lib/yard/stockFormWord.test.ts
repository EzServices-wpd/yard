import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectMaterial } from "./promptHelpers.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

/**
 * A species word against a sheet-form word is that sheet (or the stated substitute),
 * never the species' default 1×4. "boards" stays the board. A plywood part word
 * ("plywood top") does not take the frame.
 */
const SPECIES = ["oak", "maple", "birch", "cherry", "walnut", "pine"] as const;
const SHEETS = ["plywood", "ply", "sheet"] as const;

function woodBuy(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return { project, plan };
}

describe("species sheet form wins over the species default", () => {
  for (const species of SPECIES) {
    for (const form of SHEETS) {
      const prompt = `bookcase from ${species} ${form}`;
      it(`${prompt} is sheet stock, not ${species} 1×4`, () => {
        assert.equal(detectMaterial(prompt).id, "plywood-3-4-4x8");
        const { project, plan } = woodBuy(prompt);
        assert.equal(project.primaryMaterialId, "plywood-3-4-4x8");
        assert.match(project.name, new RegExp(species, "i"));
        const faces = project.panels.filter((p) => Math.min(p.size.width, p.size.height, p.size.depth) > 0.4);
        assert.ok(faces.length > 0);
        assert.ok(faces.every((p) => /^plywood-/.test(p.materialId)), faces.map((p) => `${p.name}:${p.materialId}`).join(", "));
        const sheet = plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8");
        assert.ok(sheet, "Buy lists the 3/4 plywood sheet");
        assert.equal(sheet.estimatedCost, 38.43 * sheet.quantity);
        assert.ok(!plan.bom.some((b) => new RegExp(`${species} 1×4`, "i").test(b.name)));
        const notes = plan.bom.map((b) => b.notes ?? "").join(" ");
        assert.match(notes, new RegExp(`Stock is .+Plywood.+${species} in the title`, "i"));
      });
    }
    it(`bookcase from ${species} boards stays ${species} boards`, () => {
      const prompt = `bookcase from ${species} boards`;
      assert.equal(detectMaterial(prompt).id, "lumber-1x4-8");
      const { project, plan } = woodBuy(prompt);
      assert.equal(project.primaryMaterialId, "lumber-1x4-8");
      assert.ok(plan.bom.some((b) => new RegExp(`${species} 1×4`, "i").test(b.name)));
      assert.ok(!plan.bom.some((b) => b.catalogId === "plywood-3-4-4x8"));
    });
  }

  it("wardrobe 40x72x22 from oak plywood is oak-titled sheets, not 40 oak boards", () => {
    const { project, plan } = woodBuy("wardrobe 40x72x22 from oak plywood");
    assert.equal(project.primaryMaterialId, "plywood-3-4-4x8");
    assert.match(project.name, /Oak Wardrobe/);
    assert.ok(project.panels.filter((p) => p.materialId !== "closet-rod").every((p) => /^plywood-/.test(p.materialId)));
    assert.ok(!plan.bom.some((b) => /Oak 1×4/.test(b.name)));
    const sheet = plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8")!;
    assert.equal(sheet.estimatedCost, 38.43 * sheet.quantity);
    assert.ok(plan.totals.estCostUsd < 400);
  });

  it("oak ply is the same sheet class as oak plywood", () => {
    const ply = woodBuy("wardrobe from oak ply");
    const wood = woodBuy("wardrobe from oak plywood");
    assert.equal(ply.project.primaryMaterialId, wood.project.primaryMaterialId);
    assert.equal(ply.plan.totals.estCostUsd, wood.plan.totals.estCostUsd);
    assert.equal(
      ply.plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8")?.quantity,
      wood.plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8")?.quantity,
    );
  });

  it("1/2 inch oak plywood uses the stocked 1/2 sheet, not the 1×4", () => {
    const prompt = "cabinet from 1/2 inch oak plywood";
    assert.equal(detectMaterial(prompt).id, "plywood-1-2-4x8");
    const { project, plan } = woodBuy(prompt);
    assert.equal(project.primaryMaterialId, "plywood-1-2-4x8");
    assert.ok(plan.bom.some((b) => b.catalogId === "plywood-1-2-4x8"));
    assert.ok(!plan.bom.some((b) => /Oak 1×4/.test(b.name)));
  });

  it("oak table with a plywood top keeps oak boards for the frame", () => {
    const { project, plan } = woodBuy("oak table with a plywood top");
    assert.equal(detectMaterial("oak table with a plywood top").id, "lumber-1x4-8");
    assert.equal(project.primaryMaterialId, "lumber-1x4-8");
    const frame = project.panels.filter((p) => /\b(?:leg|apron)\b/i.test(p.name));
    assert.ok(frame.length >= 4);
    assert.ok(frame.every((p) => /^lumber-/.test(p.materialId)), frame.map((p) => `${p.name}:${p.materialId}`).join(", "));
    assert.ok(plan.bom.some((b) => /Oak 1×4/.test(b.name)));
    assert.equal(plan.totals.estCostUsd, 193.45);
  });

  it("a named board size still beats the species default", () => {
    assert.equal(detectMaterial("oak 1x6 shelf").id, "lumber-1x6-8");
    assert.equal(detectMaterial("pine 2x4 bench").id, "lumber-2x4-8");
    assert.equal(detectMaterial("bookcase from plywood").id, "plywood-3-4-4x8");
  });

  it("a bare species stays the species board", () => {
    const { project, plan } = woodBuy("6-drawer chest from walnut");
    assert.equal(project.primaryMaterialId, "lumber-1x4-8");
    assert.ok(plan.bom.some((b) => /Walnut 1×4/.test(b.name)));
    assert.equal(plan.totals.estCostUsd, 1046.23);
  });
});
