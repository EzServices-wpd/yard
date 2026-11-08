import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { projectSolids, paintOrder, faceSolids, partLetters } from "../src/lib/yard/pdfDraw.ts";
import { stepTones } from "../src/lib/yard/planStepPicture.ts";

// Class: on a dense 120×120 grid, the last-painted face is the nearest face (no slivers of a
// part under a board painted over it), for every step of the fixtures. Cycles break farthest-corner first.
type V = { x: number; y: number; z: number };
const S = Math.cos(Math.PI / 6);
const scr = (p: V) => ({ x: (p.x - p.z) * S, y: -p.y + (p.x + p.z) / 2 });
const inPoly = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
type Face = { n: V; pts: V[] };
const depth = (f: Face, pt: { x: number; y: number }) => {
  const n = f.n, p = f.pts[0], nd = n.x + n.y + n.z;
  if (Math.abs(nd) < 1e-6) return null;
  const bx = pt.x / S, by = bx / 2 - pt.y;
  return bx + by + 3 * ((n.x * (p.x - bx) + n.y * (p.y - by) + n.z * p.z) / nd);
};
function mismatches(ids: Set<string> | null, q: string) {
  const solids = projectSolids(generateFromPrompt(q)).filter((s) => !s.stick && (!ids || ids.has(s.id)));
  const polys = paintOrder(faceSolids(solids)).map((o) => ({ o, q: o.faces[0].pts.map(scr) }));
  const xs = polys.flatMap((p) => p.q.map((v) => v.x)), ys = polys.flatMap((p) => p.q.map((v) => v.y));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let bad = 0;
  for (let i = 0; i < 120; i++) for (let j = 0; j < 120; j++) {
    const pt = { x: x0 + ((x1 - x0) * (i + 0.5)) / 120, y: y0 + ((y1 - y0) * (j + 0.5)) / 120 };
    let last: string | null = null, best: string | null = null, bd = -Infinity;
    for (const p of polys) {
      if (!inPoly(pt, p.q)) continue;
      last = p.o.id;
      const d = depth(p.o.faces[0] as Face, pt);
      if (d !== null && d > bd) { bd = d; best = p.o.id; }
    }
    if (last && last !== best) bad++;
  }
  return bad;
}
for (const q of ["picnic table", "pergola 10 by 12", "tipi", "sawhorse", "bunk bed 82 long 44 wide", "corner bookshelf 60 wide 84 tall"]) {
  test(`${q}: every step paints the nearest face on a dense grid`, () => {
    const p = generateFromPrompt(q), plan = buildPlan(p), L = partLetters(p, plan.cutList);
    const bad: string[] = [];
    plan.instructions.forEach((s, i) => {
      const t = stepTones(p, plan, i, L);
      if (!t.tones.size) return;
      const n = mismatches(new Set(t.tones.keys()), q);
      if (n) bad.push(`step ${i + 1} ${s.title}: ${n}`);
    });
    assert.deepEqual(bad, []);
  });
}

test("bench steps light their own members; Level lights what stands on the floor", () => {
  const perg = generateFromPrompt("pergola"), pp = buildPlan(perg), pl = partLetters(perg, pp.cutList);
  pp.instructions.forEach((s, i) => {
    if (!/^(Splice the long members|Glue up the thick parts)/.test(s.title)) return;
    const hot = [...stepTones(perg, pp, i, pl).tones.values()].filter((t) => t === "hot").length;
    assert.ok(hot > 0, `${s.title} highlights nothing`);
  });
  const bunk = generateFromPrompt("bunk bed"), bp = buildPlan(bunk), bl = partLetters(bunk, bp.cutList);
  const li = bp.instructions.findIndex((s) => /^Level it/.test(s.title));
  const tones = [...stepTones(bunk, bp, li, bl).tones.values()];
  const hot = tones.filter((t) => t === "hot").length;
  assert.ok(hot > 0 && hot < tones.length / 2, `bunk Level lights ${hot} of ${tones.length}`);
});

test("a 60in corner wall panel says it is two pieces joined", () => {
  const p = generateFromPrompt("corner bookshelf 60 wide 84 tall");
  assert.ok(p.notes.some((n) => /Wall panel A is 60" × 84", bigger than one 4×8 sheet/.test(n)));
});
