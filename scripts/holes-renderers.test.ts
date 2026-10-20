/**
 * Holes are drawn in every renderer (holes-size PR): a part with polygon holes (a wheel's open centre, a hub's axle
 * bore, a birdhouse door, an abacus bead) shows each hole in the iso plate, the 3D drawing (overview, steps, PDF),
 * the parts plate and the /ideas hero model. Before, every renderer drew the outer edge only, so the water wheel
 * was a solid 22" disc over its hub and spokes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { isoFaces, isoSvgString, polygonHoleRings } from "../src/lib/yard/iso";
import { drawShape, partLetters, partShape, projectSolids, renderProject } from "../src/lib/yard/pdfDraw";
import { planOverviewSvg } from "../src/lib/yard/planStepPicture";
import { buildPlanPdf } from "../src/lib/yard/pdf";
import { SvgDoc } from "../src/lib/yard/svgDoc";
import { IDEAS } from "../src/lib/yard/ideas";
import { recipeIdeas } from "../src/lib/yard/recipeIdeas";
import { DREAMS } from "../src/lib/yard/promptDreams";
import type { jsPDF } from "jspdf";
import type { YardProject } from "../src/lib/yard/types";

const prompts = [...new Set(["water wheel", "abacus", "ferris wheel", "cribbage board", "church birdhouse", "12 inch wall clock frame", ...IDEAS.map((d) => d.prompt), ...recipeIdeas().map((r) => r.prompt), ...DREAMS.map((d) => d.prompt)])];
const holed: { prompt: string; project: YardProject }[] = [];
for (const prompt of prompts) {
  try {
    const project = generateFromPrompt(prompt);
    if (project.panels.some((p) => p.polygon?.holes?.some((h) => h.r > 0))) holed.push({ prompt, project });
  } catch { /* a build that throws is another test's business */ }
}
const holes = (p: YardProject["panels"][number]) => (p.polygon?.holes ?? []).filter((h) => h.r > 0).length;
/** <path fill-rule="evenodd"> elements and their subpath counts. */
const evenOdd = (svg: string) => [...svg.matchAll(/<path d="([^"]*)" fill-rule="evenodd"/g)].map((m) => (m[1].match(/M /g) ?? []).length);

test("the corpus has builds with holes (water wheel, abacus, birdhouse door, clock)", () => {
  assert.ok(holed.length >= 5, `only ${holed.length} holed builds: ${holed.map((h) => h.prompt).join(", ")}`);
  assert.ok(holed.some((h) => h.prompt === "water wheel"));
});

test("3D solids: a holed plate's caps carry every hole as an exact circle (rim) on both faces, one wall per hole", () => {
  // Critic #93 row 110: a 1 1/2" birdhouse door was a 16-gon of stroked wall facets at 400 dpi. Each cap now carries
  // the hole's true circle (centre, two radius vectors, the far face's centre) and paints the wall from the two rims,
  // so no per-side wall facet joins the depth sort and the PDF draws Bézier arcs at any print size.
  for (const { prompt, project } of holed) {
    const solids = projectSolids(project);
    project.panels.forEach((p, i) => {
      const n = holes(p);
      if (!n) return;
      const s = solids[i];
      const caps = s.faces.filter((f) => f.holes?.length);
      assert.equal(caps.length, 2, `${prompt}: ${p.name} has ${caps.length} holed caps`);
      for (const c of caps) assert.equal(c.holes!.length, n, `${prompt}: ${p.name} cap holes`);
      const rings = polygonHoleRings(p);
      const want = (p.polygon!.holes ?? []).filter((h) => h.r > 0);
      for (const c of caps) {
        assert.equal(c.rims?.length, n, `${prompt}: ${p.name} cap has ${c.rims?.length ?? 0} exact rims, want ${n}`);
        c.rims!.forEach((r, k) => {
          const len = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
          assert.ok(Math.abs(len(r.u) - want[k].r) < 1e-9 && Math.abs(len(r.v) - want[k].r) < 1e-9, `${prompt}: ${p.name} rim radius`);
          assert.ok(Math.abs(r.u.x * r.v.x + r.u.y * r.v.y + r.u.z * r.v.z) < 1e-9, `${prompt}: ${p.name} rim is not a circle`);
          // Every ring corner lies on the rim's circle, on this cap or the far one (the rim is the polygon's own circle).
          const [r0, r1] = rings[k];
          const onRim = (q: { x: number; y: number; z: number }, ctr: { x: number; y: number; z: number }) => Math.abs(len({ x: q.x - ctr.x, y: q.y - ctr.y, z: q.z - ctr.z }) - want[k].r) < 1e-9;
          assert.ok((r0.every((q) => onRim(q, r.c)) && r1.every((q) => onRim(q, r.back))) || (r1.every((q) => onRim(q, r.c)) && r0.every((q) => onRim(q, r.back))), `${prompt}: ${p.name} rim off its ring`);
        });
      }
      // No faceted hole wall is left (the caps paint it).
      const facets = s.faces.filter((f) => !f.holes && rings.some(([r0]) => f.pts.some((q) => r0.some((h) => Math.hypot(h.x - q.x, h.y - q.y, h.z - q.z) < 1e-9))));
      assert.equal(facets.length, 0, `${prompt}: ${p.name} still has ${facets.length} faceted hole walls`);
    });
  }
});

test("PDF holes and round walls are true curves: rims are Bézier arcs, a hub's wall draws only its silhouette", () => {
  const ww = holed.find((h) => h.prompt === "water wheel")!.project;
  const doc = new SvgDoc(800, 800);
  renderProject(doc as unknown as jsPDF, ww, { x: 0, y: 0, w: 800, h: 800 }, { tones: new Map(ww.panels.map((p) => [p.id, "built" as const])) });
  const svg = doc.toSvg();
  const arcs = (svg.match(/ C /g) ?? []).length;
  // Each visible rim is four cubic quarters; every holed part shows at least one cap.
  assert.ok(arcs >= 4 * ww.panels.filter(holes).length, `water wheel: only ${arcs} Bézier segments`);
  // The hub and collar walls (round outlines) are soft facets: two silhouette edges per wall, no seam per side.
  for (const name of ["hub 1", "Collar 1"]) {
    const i = ww.panels.findIndex((p) => p.name === name);
    const walls = projectSolids(ww)[i].faces.filter((f) => !f.holes && f.pts.length === 4 && f.soft);
    assert.ok(walls.length >= 12, `${name}: ${walls.length} soft wall facets`);
    const sil = walls.filter((f) => f.n.x + f.n.y + f.n.z > 0).reduce((a, f) => a + (f.sil?.length ?? 0), 0);
    assert.equal(sil, 2, `${name}: ${sil} silhouette edges (want the two tangents)`);
  }
});

test("iso plate: each holed part's face is an even-odd path with one ring per hole", () => {
  for (const { prompt, project } of holed) {
    const faces = isoFaces(project, []);
    const want = project.panels.map(holes);
    project.panels.forEach((p, i) => {
      if (!want[i]) return;
      assert.equal(faces[i].holes?.length, want[i], `${prompt}: ${p.name} iso face holes`);
    });
    const svg = isoSvgString(project);
    assert.ok(evenOdd(svg).filter((k) => k >= 2).length >= want.filter(Boolean).length, `${prompt}: iso svg even-odd faces`);
  }
});

test("3D drawing (overview SVG, same path as steps and PDF): each holed part paints an even-odd face with its holes", () => {
  for (const { prompt, project } of holed) {
    const subs = evenOdd(planOverviewSvg(project, 480, 360).svg);
    for (const p of project.panels.filter(holes)) {
      assert.ok(subs.includes(1 + holes(p)), `${prompt}: no even-odd face with ${1 + holes(p)} rings for ${p.name} (got ${subs.join(",")})`);
    }
  }
});

test("PDF: a holed build fills even-odd (B*); the linen canary has no holes and none", () => {
  const ww = holed.find((h) => h.prompt === "water wheel")!.project;
  const pdf = Buffer.from(buildPlanPdf(ww, buildPlan(ww)).output("arraybuffer") as ArrayBuffer).toString("latin1");
  assert.ok((pdf.match(/\nB\*\n/g) ?? []).length > 0, "water wheel PDF has no even-odd fills");
  const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const lp = Buffer.from(buildPlanPdf(linen, buildPlan(linen)).output("arraybuffer") as ArrayBuffer).toString("latin1");
  assert.equal((lp.match(/\nB\*\n/g) ?? []).length, 0);
});

test("parts plate: a holed part's flat shape keeps its holes inside the outline and draws them cut out", () => {
  let checked = 0;
  const wheelPlates: string[] = [];
  for (const { prompt, project } of holed) {
    const plan = buildPlan(project);
    const letters = partLetters(project, plan.cutList);
    for (const line of plan.cutList) {
      const panel = project.panels.find((p) => letters.get(p.id) === line.label);
      if (!panel || !holes(panel)) continue;
      const sh = partShape(project, line, letters);
      // Drawn as its blank from the side (a bead's 1" length, the outline is its end): the bore is not in view.
      if (sh.pts.length !== panel.polygon!.pts.length) continue;
      assert.equal(sh.holes?.length, holes(panel), `${prompt}: ${line.label} plate holes`);
      for (const h of sh.holes!) assert.ok(h.x - h.r >= -1e-6 && h.x + h.r <= sh.w + 1e-6 && h.y - h.r >= -1e-6 && h.y + h.r <= sh.h + 1e-6, `${prompt}: ${line.label} hole leaves the outline`);
      const doc = new SvgDoc(400, 400);
      drawShape(doc as unknown as jsPDF, sh, 10, 10, 10, [200, 180, 140], [90, 70, 40]);
      assert.deepEqual(evenOdd(doc.toSvg()), [1 + holes(panel)], `${prompt}: ${line.label} plate is not cut out`);
      checked++;
      if (prompt === "water wheel") wheelPlates.push(panel.name);
    }
  }
  assert.ok(checked >= 3, `only ${checked} holed plate shapes checked`);
  // #85's rotors wheel: the rim's open centre, the hub's and collar's axle bores and the spokes' bores are all on the plate.
  assert.deepEqual(wheelPlates.sort(), ["Collar 1", "Rim 1", "Spoke 1", "hub 1"], "water wheel: the rim's open centre and the hub, collar and spoke bores are all on the plate");
});

test("/ideas hero model: every holed plate carries its holes (the 3D hero cuts them)", () => {
  const manifest = JSON.parse(fs.readFileSync("src/lib/ideas/drawings.json", "utf8")) as Record<string, { model?: string }>;
  let checked = 0;
  for (const r of recipeIdeas()) {
    const m = manifest[r.id]?.model;
    const want = r.panels.filter(holes).length;
    if (!m || !want) continue;
    const model = JSON.parse(fs.readFileSync(`public${m}`, "utf8")) as { panels: { poly?: { holes?: unknown[] } }[] };
    assert.equal(model.panels.filter((p) => p.poly?.holes?.length).length, want, `${r.id} hero model drops holes`);
    checked++;
  }
  assert.ok(checked >= 1);
});

test("round-hole segments class: every drawn hole bows in <= 1/64\" and never fewer than 12 sides (birdhouse entrance reads round)", async () => {
  const { holeSegments, HOLE_SAG, HOLE_MIN_SIDES, HOLE_MAX_SIDES } = await import("../src/lib/yard/iso.ts");
  for (const r of [0.125, 0.25, 0.5, 0.5625, 0.75, 1, 2, 4, 8.07125, 12, 40]) {
    const n = holeSegments(r);
    assert.ok(n >= HOLE_MIN_SIDES && n <= HOLE_MAX_SIDES, `r ${r}: ${n}`);
    const sag = r * (1 - Math.cos(Math.PI / n));
    if (n < HOLE_MAX_SIDES) assert.ok(sag <= HOLE_SAG + 1e-9, `r ${r}: ${n} sides bow ${sag}`);
  }
  assert.ok(holeSegments(0.75) >= 16, "1 1/2 in birdhouse entrance: was 8 sides");
  assert.ok(holeSegments(8.07125) > holeSegments(0.75), "a big open centre gets more sides");
});
