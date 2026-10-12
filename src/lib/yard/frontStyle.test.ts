import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromPrompt } from "./promptMain";
import { STRESS_PROMPTS } from "./stressPrompts";
import type { Panel } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const goldens = JSON.parse(readFileSync(join(here, "promptSnapshots.goldens.json"), "utf8")) as { prompt: string }[];
const PROMPTS = [...new Set(["pocket vanity 38 wide 102 tall 17 deep", "wardrobe", "pantry cabinet", "media console with doors", "medicine cabinet", "sideboard with doors", ...goldens.map((g) => g.prompt), ...STRESS_PROMPTS])];
const r = (n: number) => Math.round(n * 1000) / 1000;
const box = (ps: Panel[]) => {
  const x0 = Math.min(...ps.map((p) => p.position.x)), y0 = Math.min(...ps.map((p) => p.position.y));
  const x1 = Math.max(...ps.map((p) => p.position.x + p.size.width)), y1 = Math.max(...ps.map((p) => p.position.y + p.size.height));
  return [r(x0), r(y0), r(x1 - x0), r(y1 - y0)].join(",");
};

it("every door style keeps each hung front's exact size, reveal and position (slab vs shaker)", () => {
  let swept = 0;
  for (const prompt of PROMPTS) {
    const slab = generateFromPrompt(prompt);
    const doors = slab.panels.filter((p) => p.type === "door" && p.leaf == null);
    if (!doors.length || /shaker/i.test(prompt)) continue;
    const shaker = generateFromPrompt(`${prompt} with shaker fronts`);
    const leaves = new Map<string, Panel[]>();
    for (const p of shaker.panels) if (p.leaf?.id) leaves.set(p.leaf.id, [...(leaves.get(p.leaf.id) ?? []), p]);
    if (!leaves.size) continue;
    const want = doors.map((d) => box([d])).sort();
    const got = [...leaves.values()].map(box).sort();
    assert.deepEqual(got, want, `${prompt}: leaves ${got.join(" | ")} vs slab ${want.join(" | ")}`);
    swept++;
  }
  assert.ok(swept >= 3, "swept at least one build with hung doors");
});
