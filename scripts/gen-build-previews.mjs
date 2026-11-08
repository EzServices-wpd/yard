// Snapshot a few known builds into tiny front-view part rects with their step index, for the
// pending "Building" animation. Which prompt gets which preview: src/components/workspace/build-preview-match.ts. Reads engine OUTPUTS only; rerun after big model changes:
//   node scripts/gen-build-previews.mjs
import { createJiti } from "jiti";
import { writeFileSync } from "node:fs";
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../src", import.meta.url).pathname } });
const { generateFromPrompt } = await jiti.import("../src/lib/yard/promptMain.ts");
const { buildPlan } = await jiti.import("../src/lib/yard/report.ts");
const { buildOrder } = await jiti.import("../src/components/workspace/build-order.ts");
const SAMPLES = [
  { id: "coop", prompt: "chicken coop" },
  { id: "linen", prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep" },
  { id: "desk", prompt: "desk 60 x 30 x 29 with 24 inch knee space" },
  { id: "table", prompt: "dining table 60 x 36 x 30" },
  { id: "bench", prompt: "entry bench 48 wide 18 tall 16 deep" },
  { id: "bookcase", prompt: "bookcase 36 wide 72 tall 12 deep" },
];
const out = [];
for (const s of SAMPLES) {
  const project = generateFromPrompt(s.prompt);
  const plan = buildPlan(project);
  const { at, n } = buildOrder(project, plan);
  const rects = [];
  for (const p of project.panels) rects.push([p.position.x, p.position.y, p.size.width, p.size.height, at.get(p.id) ?? n]);
  for (const i of project.instances) {
    if (!i.from || !i.to) continue;
    const t = i.section?.width ?? 1.5;
    const x0 = Math.min(i.from.x, i.to.x), x1 = Math.max(i.from.x, i.to.x), y0 = Math.min(i.from.y, i.to.y), y1 = Math.max(i.from.y, i.to.y);
    rects.push([x1 - x0 < t ? x0 - t / 2 : x0, y1 - y0 < t ? y0 - t / 2 : y0, Math.max(x1 - x0, t), Math.max(y1 - y0, t), at.get(i.id) ?? n]);
  }
  if (!rects.length) continue;
  const minX = Math.min(...rects.map((r) => r[0])), minY = Math.min(...rects.map((r) => r[1]));
  const maxX = Math.max(...rects.map((r) => r[0] + r[2])), maxY = Math.max(...rects.map((r) => r[1] + r[3]));
  const r1 = (v) => Math.round(v * 10) / 10;
  out.push({ id: s.id, w: r1(maxX - minX), h: r1(maxY - minY), steps: n + 1,
    parts: rects.map(([x, y, w, h, k]) => [r1(x - minX), r1(maxY - (y + h)), r1(w), r1(h), k]) });
  console.log(s.id, rects.length, "parts", n, "steps");
}
writeFileSync(new URL("../src/components/workspace/build-previews.json", import.meta.url), JSON.stringify(out) + "\n");
