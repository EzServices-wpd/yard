import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { projectSolids } from "../src/lib/yard/pdfDraw.ts";
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { recipePrompt } from "../src/lib/yard/recipeIdeas.ts";

// Class: a rod draws as a rod and a cone/dome as its curved shell, never the part's bounding box.
test("every strut, cone and dome draws about the size of its real shape", () => {
  let seen = 0;
  for (const q of ["kids tipi", ...RECIPES.recipes.map((r) => recipePrompt(r))]) {
    const p = generateFromPrompt(q), S = projectSolids(p);
    for (const part of p.panels) {
      const s = S.find((x) => x.id === part.id)!;
      if (part.strut) {
        seen++;
        assert.ok(s.stick, `${q}: ${part.name} is a rod`);
        const len = Math.hypot(s.stick!.b.x - s.stick!.a.x, s.stick!.b.y - s.stick!.a.y, s.stick!.b.z - s.stick!.a.z);
        const { a, b } = part.strut;
        assert.ok(Math.abs(len - Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])) < 0.01 && Math.abs(s.stick!.w - 2 * part.strut.r) < 0.01);
      } else if (part.form) {
        seen++;
        assert.ok(s.faces.length > 12, `${q}: ${part.name} is curved`);
        const cx = part.position.x + part.size.width / 2, cz = part.position.z + part.size.depth / 2;
        for (const pt of s.faces.flatMap((f) => f.pts)) assert.ok(((pt.x - cx) / (part.size.width / 2)) ** 2 + ((pt.z - cz) / (part.size.depth / 2)) ** 2 <= 1.001);
      }
    }
  }
  assert.ok(seen > 0, "fixtures have rods or curved parts");
});
