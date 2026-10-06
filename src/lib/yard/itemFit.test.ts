import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { purposeOf } from "./purpose.ts";
import type { Panel } from "./types.ts";

/** Builds named for what they hold: the title keeps the item and the openings fit it. */
const PURPOSE = [
  "broom closet 20 wide 80 tall 14 deep",
  "maple 1x10 record console 54 wide",
  "towel cabinet",
  "record cabinet 36 wide 48 tall",
  "cedar garbage bin enclosure from 2x4 for two bins",
  "trash can enclosure for 3 cans",
  "recycling bin enclosure",
];

const overlapX = (a: Panel, b: Panel) => Math.min(a.position.x + a.size.width, b.position.x + b.size.width) - Math.max(a.position.x, b.position.x);

/** Clear heights between stacked horizontal plates that share an opening. */
function openings(panels: Panel[]): number[] {
  const plates = panels.filter((p) => ["shelf", "bottom", "top", "counter"].includes(p.type) && p.size.height <= 1 && p.size.width >= 5).sort((a, b) => a.position.y - b.position.y);
  const out: number[] = [];
  for (const a of plates) {
    const above = plates.filter((b) => b.position.y > a.position.y + 1e-6 && overlapX(a, b) > 1);
    if (!above.length) continue;
    const next = Math.min(...above.map((b) => b.position.y));
    out.push(next - (a.position.y + a.size.height));
  }
  return out;
}

describe("Purpose builds keep the item and fit it", () => {
  for (const prompt of PURPOSE) {
    it(prompt, () => {
      const purpose = purposeOf(prompt);
      assert.ok(purpose, "the purpose layer reads the stored item");
      const p = generateFromPrompt(prompt);
      assert.match(p.name.toLowerCase(), new RegExp(purpose.word.split(" ").pop()!.replace(/s$/, "")), `title keeps "${purpose.word}": ${p.name}`);
      const need = purpose.item.clear;
      if (purpose.item.perBay) {
        const posts = p.panels.filter((q) => /^Back post\b/.test(q.name)).sort((a, b) => a.position.x - b.position.x);
        assert.equal(posts.length, purpose.count + 1, "one bay per item");
        for (let k = 1; k < posts.length; k++) assert.ok(posts[k].position.x - (posts[k - 1].position.x + posts[k - 1].size.width) >= (need.w ?? 0), "bay wide enough");
        const front = p.panels.find((q) => /^Front post\b/.test(q.name))!;
        assert.ok(front.position.z - (posts[0].position.z + posts[0].size.depth) >= need.d, "bay deep enough");
        assert.ok(posts[0].size.height >= need.h, "bay tall enough");
        return;
      }
      const clear = openings(p.panels);
      assert.ok(clear.length, "the build has openings");
      if (need.h > 30) assert.ok(Math.max(...clear) >= need.h - 1 / 16, `a bay ${need.h}" tall: ${clear}`);
      else assert.ok(Math.min(...clear) >= need.h - 1 / 16, `every opening ${need.h}" clear: ${clear}`);
      const deep = Math.max(...p.panels.filter((q) => ["shelf", "bottom"].includes(q.type)).map((q) => q.size.depth));
      assert.ok(deep >= need.d - 1 / 16, `inside depth ${deep} for ${need.d}`);
      assert.ok((p.notes ?? []).some((n) => n.includes(purpose.item.label)), "a note says what it is sized for");
    });
  }
  it("a typed species survives the board-size clause", () => {
    const plan = buildPlan(generateFromPrompt("cedar garbage bin enclosure from 2x4 for two bins"));
    assert.ok(plan.bom.some((b) => /^\d*×?\s*Cedar 2×4/.test(b.name) || /Cedar 2×4/.test(b.name)), plan.bom.map((b) => b.name).join("; "));
    const chest = buildPlan(generateFromPrompt("cedar storage chest from 2x4"));
    assert.ok(chest.bom.some((b) => /Cedar 2×4/.test(b.name)), chest.bom.map((b) => b.name).join("; "));
  });
  it("a stored item's own fitting reaches Buy (broom clips in the tall bay)", () => {
    const plan = buildPlan(generateFromPrompt("broom closet 20 wide 80 tall 14 deep"));
    assert.ok(plan.bom.some((b) => /grip clips/i.test(b.name) && b.quantity >= 2), plan.bom.map((b) => b.name).join("; "));
  });
  it("small habitats reuse the 1×6 box with their own features", () => {
    const bee = generateFromPrompt("bee hotel from scrap 1x6");
    assert.ok(bee.panels.some((q) => q.name === "Tier shelf") && !bee.panels.some((q) => q.name === "Front gable"), "open front with tiers");
    assert.ok(buildPlan(bee).bom.some((b) => /nesting tubes/.test(b.name)), "tubes on Buy");
    const bat = generateFromPrompt("bat house");
    assert.ok(bat.panels.some((q) => /^Side spacer/.test(q.name)) && bat.panels.some((q) => q.name === "Upper front board"), "chamber and vent slot");
    assert.equal(generateFromPrompt("nesting box").name.split(" ")[0], "Nesting");
  });
  it("a landmark keeps its published plan proportions", () => {
    const arc = generateFromPrompt("arc de triomphe from popsicle sticks");
    assert.ok(arc.overall.depth < arc.overall.width * 0.7, JSON.stringify(arc.overall));
    // Arc de Triomphe: about 0.9 of its height wide and 0.44 deep, on the outside faces.
    const tall = generateFromPrompt("Arc de Triomphe from craft sticks 12 inches tall").overall;
    assert.ok(Math.abs(tall.width - 10.8) <= 0.5 && Math.abs(tall.depth - 5.3) <= 0.5 && tall.height === 12, JSON.stringify(tall));
  });
});
