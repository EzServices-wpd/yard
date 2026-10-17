// For each home card with drawers: in 3D, with every drawer fully open, which fixed parts is it in front of (so it
// must paint over them), which fixed parts are in front of it (so it must never paint over them: a desk top, a
// counter), and does it pass through any fixed part? Read by drawer-cover.py. Prints JSON.
// View direction: the overview's iso projection P(v) = ((x−z)·cos30, −y + (x+z)/2) sends (1,1,1) to a point, and the
// drawing shows tops, +x sides and +z fronts, so the viewer sits at +(1,1,1): larger x, y or z is nearer.
import fs from "node:fs";
import { DREAMS } from "../../src/lib/yard/promptDreams";
import { generateFromPrompt } from "../../src/lib/yard/prompt";
import { drawerSpecs } from "../../src/components/home/showcase-drawers";

type Box = { lo: number[]; hi: number[] };
const EPS = 0.01;
const src = fs.readFileSync(new URL("../../src/routes/index.tsx", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const PIECES = ["), src.indexOf("] as const;", src.indexOf("const PIECES = [")));
const pieces = [...block.matchAll(/id: "([^"]+)"[\s\S]*?prompt: ([^\n]+),\n/g)].map(([, id, expr]) => {
  const dream = /DREAMS\.find\(\(d\) => d\.id === "([^"]+)"\)\?\.prompt \?\? "([^"]+)"/.exec(expr);
  const prompt = dream ? (DREAMS.find((d: { id: string }) => d.id === dream[1])?.prompt ?? dream[2]) : JSON.parse(expr);
  return { id, prompt };
});
const box = (p: any, dz = 0): Box => ({ lo: [p.position.x, p.position.y, p.position.z + dz], hi: [p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth + dz] });
const out: Record<string, unknown> = {};
for (const { id, prompt } of pieces) {
  const panels = generateFromPrompt(prompt).panels as any[];
  const specs = drawerSpecs(panels);
  if (!specs.length) continue;
  const moving = new Set(specs.flatMap((s) => s.ids));
  const fixed = panels.filter((p) => !moving.has(p.id));
  out[id] = {
    prompt,
    drawers: specs.map((s) => {
      // Part by part (a drawer front is wider than its box, so one box for the drawer would be wrong):
      // nearer[part] = fixed parts this open part is strictly in front of, so it must paint over them.
      const nearer: Record<string, string[]> = {};
      const behind: Record<string, string[]> = {};
      const through: string[] = [];
      for (const p of panels.filter((q) => s.ids.includes(q.id))) {
        const D = box(p, s.open);
        nearer[p.id] = [];
        behind[p.id] = [];
        for (const f of fixed) {
          const F = box(f);
          const dNear = [0, 1, 2].some((a) => D.lo[a] >= F.hi[a] - EPS), fNear = [0, 1, 2].some((a) => F.lo[a] >= D.hi[a] - EPS);
          if (dNear && !fNear) nearer[p.id].push(f.id);
          else if (fNear && !dNear) behind[p.id].push(f.id);
          else if (!dNear && !fNear) through.push(`${p.name} × ${f.name}`); // an open drawer part overlaps solid wood
        }
      }
      return { ids: s.ids, open: s.open, cut: s.cut, nearer, behind, through };
    }),
  };
}
console.log(JSON.stringify(out));
