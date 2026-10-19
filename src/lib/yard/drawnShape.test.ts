/**
 * Drawings draw the part's own shape (class test, both renderers: pdfDraw solids, which the PDF and every plan SVG
 * use, and iso.ts rings). A part is never drawn outside its box, a rectangular part is never drawn round, and a
 * flat face outline is extruded along its own thin axis: "xz" up by height, "xy" back by depth, "zy" across x by
 * width. Before, a "zy" plate (the water wheel's sides) was drawn as a drum as deep as it is round.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { isRoundPlate, projectSolids } from "./pdfDraw.ts";
import { polygonRings } from "./iso.ts";
import { panelWorldCorners } from "./geometry.ts";
import { generateFromPrompt } from "./prompt.ts";
import { DREAMS } from "./promptDreams.ts";
import { PLANS } from "./plans.ts";
import type { Panel, YardProject } from "./types.ts";

type V = { x: number; y: number; z: number };
const box = (pts: V[]) => ({
  min: { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)), z: Math.min(...pts.map((p) => p.z)) },
  max: { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)), z: Math.max(...pts.map((p) => p.z)) },
});
const EPS = 1e-6;
function inside(drawn: ReturnType<typeof box>, part: Panel, what: string) {
  const b = box(panelWorldCorners(part));
  for (const k of ["x", "y", "z"] as const) {
    assert.ok(drawn.min[k] >= b.min[k] - EPS && drawn.max[k] <= b.max[k] + EPS, `${what}: drawn ${k} ${drawn.min[k].toFixed(2)}..${drawn.max[k].toFixed(2)} outside its box ${b.min[k].toFixed(2)}..${b.max[k].toFixed(2)}`);
  }
}
const isRound = (p: Panel) => !!p.form || !!p.strut;

/** Every check for one project, both renderers. */
function checkProject(project: YardProject, tag: string) {
  const solids = new Map(projectSolids(project).map((s) => [s.id, s]));
  for (const p of project.panels) {
    const what = `${tag} / ${p.name} (${p.polygon ? `polygon ${p.polygon.plane}` : p.outline ?? "box"}${p.yaw ? `, yaw ${p.yaw.toFixed(2)}` : ""})`;
    const s = solids.get(p.id)!;
    if (p.strut) continue; // a rod inside its box: drawn as the rod
    const pts = s.faces.flatMap((f) => f.pts);
    inside(box(pts), p, `pdfDraw ${what}`);
    if (p.polygon) {
      const rings = polygonRings(p);
      inside(box(rings.flat()), p, `iso ${what}`);
      // The extrusion runs along the plate's own thin axis (unturned parts): ring 0 → ring 1 moves only on it.
      if (!p.yaw) {
        const axis = p.polygon.plane === "xz" ? "y" : p.polygon.plane === "zy" ? "x" : "z";
        const len = p.polygon.plane === "xz" ? p.size.height : p.polygon.plane === "zy" ? p.size.width : p.size.depth;
        const d = { x: rings[1][0].x - rings[0][0].x, y: rings[1][0].y - rings[0][0].y, z: rings[1][0].z - rings[0][0].z };
        for (const k of ["x", "y", "z"] as const) assert.ok(Math.abs(d[k] - (k === axis ? len : 0)) < EPS, `${what}: extruded along ${k} by ${d[k]}`);
      }
    } else if (!p.outline && !isRound(p) && !isRoundPlate(project, p)) {
      // A rectangular part is a box: six four-corner faces, never a ring.
      assert.equal(s.faces.length, 6, `${what}: ${s.faces.length} faces`);
      assert.ok(s.faces.every((f) => f.pts.length === 4), `${what}: drawn round`);
    }
    if (isRoundPlate(project, p)) {
      // Only a flat, square plate can be drawn as a disc.
      assert.ok(Math.abs(p.size.width - p.size.depth) < 0.01 && p.size.height <= Math.min(p.size.width, p.size.depth) * 0.25, `${what}: round but not a square plate`);
    }
  }
}

const disc = (n: number, a: number, b: number): [number, number][] => Array.from({ length: n }, (_, i) => [a / 2 + (a / 2) * Math.cos((i / n) * 2 * Math.PI), b / 2 + (b / 2) * Math.sin((i / n) * 2 * Math.PI)]);
const rect = (a: number, b: number): [number, number][] => [[0, 0], [a, 0], [a, b], [0, b]];

describe("drawings draw each part's own shape", () => {
  it("every plane × turn × outline (synthetic): inside the box, extruded along the thin axis", () => {
    const panels: Panel[] = [];
    let i = 0;
    for (const plane of ["xz", "xy", "zy"] as const) {
      // Thin along the plane's normal: xz → height, xy → depth, zy → width.
      const size = plane === "xz" ? { width: 20, height: 0.75, depth: 12 } : plane === "xy" ? { width: 20, height: 12, depth: 0.75 } : { width: 0.75, height: 12, depth: 20 };
      const [a, b] = plane === "xz" ? [size.width, size.depth] : plane === "xy" ? [size.width, size.height] : [size.depth, size.height];
      for (const yaw of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 3])
        for (const pts of [rect(a, b), disc(32, a, b), [[0, 0], [a, 0], [0, b]] as [number, number][]])
          panels.push({ id: `p${i++}`, type: "side", name: `plate ${plane}`, position: { x: 3, y: 5, z: 7 }, size, materialId: "ply", ...(yaw ? { yaw } : {}), polygon: { plane, pts } } as Panel);
      // A plain rectangular part in the same orientation, turned or not.
      for (const yaw of [0, Math.PI / 2, Math.PI / 4])
        panels.push({ id: `p${i++}`, type: "side", name: `board ${plane}`, position: { x: 3, y: 5, z: 7 }, size, materialId: "ply", ...(yaw ? { yaw } : {}) } as Panel);
    }
    checkProject({ name: "synthetic", panels, instances: [] } as unknown as YardProject, "synthetic");
  });

  it("the water wheel's sides and hub are flat discs across x, not drums", () => {
    const p = generateFromPrompt("water wheel");
    checkProject(p, "water wheel");
    const wheel = p.panels.find((q) => q.polygon?.plane === "zy")!;
    const b = box(projectSolids(p).find((s) => s.id === wheel.id)!.faces.flatMap((f) => f.pts));
    assert.ok(b.max.x - b.min.x <= wheel.size.width + EPS, `wheel drawn ${(b.max.x - b.min.x).toFixed(2)} thick`);
  });

  const prompts = new Set<string>(["linen closet 31.5 wide 78 tall 16 deep", "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep"]);
  for (const d of DREAMS) prompts.add(d.prompt);
  for (const p of PLANS as { prompt?: string; name: string }[]) prompts.add(p.prompt ?? p.name);
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "prompt" && typeof x === "string") prompts.add(x); else walk(x); } };
  for (const f of ["../ideas/recipes.json", "../ideas/types.json"]) walk(JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8")));
  for (const r of JSON.parse(fs.readFileSync(new URL("./recipes.json", import.meta.url), "utf8")).recipes) prompts.add(String(r.title).toLowerCase());

  it(`every recipe, idea, example and free plan (${prompts.size} prompts), both renderers`, () => {
    for (const prompt of prompts) checkProject(generateFromPrompt(prompt), prompt);
  });
});
