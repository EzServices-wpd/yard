import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { getCatalogItem } from "./catalog.ts";

// A part cut from dowel uses a dowel its section fits, and a part smaller than any sold dowel is flagged.
for (const q of ["abacus", "water wheel"]) {
  it(`${q}: dowel parts use the right size or say how to turn them down`, () => {
    const p = generateFromPrompt(q);
    for (const part of p.panels.filter((x) => /^dowel-/.test(x.materialId))) {
      const [a, b] = [part.size.width, part.size.height, part.size.depth].sort((x, y) => x - y);
      const d = getCatalogItem(part.materialId)!.dims.diameter!;
      assert.ok(d >= Math.max(a, b) - 0.01, `${part.name} ${d} < ${b}`);
      if (d > Math.max(a, b) + 1 / 16) assert.ok(p.notes.some((n) => n.toLowerCase().startsWith(part.name.replace(/ \d+$/, "").toLowerCase()) && /turn or sand/.test(n)), part.name);
    }
  });
}
