import test from "node:test";
import assert from "node:assert/strict";
import { panelSupports } from "./supportGraph";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { unresolvedFaults } from "./supportOrder";
import type { Panel } from "./types";

function part(name: string, type: Panel["type"], x: number, y: number, z: number, w: number, h: number, d: number): Panel {
  return { id: name, name, type, materialId: "lumber-1x4-8", position: { x, y, z }, size: { width: w, height: h, depth: d } };
}

/** Two end walls, a flat span between them at 3.5", and one extra part under the span. */
function frame(extra: Panel): Panel[] {
  return [
    part("Left wall", "side", 0, 0, 0, 0.75, 12, 18),
    part("Right wall", "side", 47.25, 0, 0, 0.75, 12, 18),
    part("Floor", "shelf", 0.75, 3.5, 1, 46.5, 0.75, 16),
    extra,
  ];
}

test("a ledger under a span's end, running along the wall, carries the span", () => {
  const on = panelSupports(frame(part("Left cleat", "rail", 0.75, 2, 1, 1.5, 1.5, 16))).get("Floor")?.on ?? [];
  assert.ok(on.includes("Left cleat"), JSON.stringify(on));
});

test("the first slot of a narrow rack is a bay divider, not a ledger", () => {
  // Magazine rack: the top is 16 1/2" and slot 1's centre is under 4" from the end. It does not reach the end.
  const top = part("Top", "top", 0, 23.25, 0.75, 16.5, 0.75, 11.25);
  const left = part("Left upright", "upright", -0.75, 0, 0, 0.75, 24, 12);
  const right = part("Right upright", "upright", 16.5, 0, 0, 0.75, 24, 12);
  const slot = part("Slot 1", "divider", 3.56, 0.75, 0.75, 0.75, 22.5, 11.25);
  const on = panelSupports([left, right, top, slot]).get("Top")?.on ?? [];
  assert.ok(!on.includes("Slot 1"), JSON.stringify(on));
});

test("a strip across the span (kick strip) and a part under its middle (divider) do not", () => {
  const kick = panelSupports(frame(part("Kick strip", "rail", 0.75, 0, 1, 46.5, 3.5, 0.75))).get("Floor")?.on ?? [];
  assert.ok(!kick.includes("Kick strip"), JSON.stringify(kick));
  const mid = panelSupports(frame(part("Divider", "upright", 23.6, 0, 1, 0.75, 3.5, 16))).get("Floor")?.on ?? [];
  assert.ok(!mid.includes("Divider"), JSON.stringify(mid));
});

test("storage benches lay the floor after the cleats it rests on", () => {
  for (const p of ["outdoor storage bench", "outdoor storage bench 60 wide", "patio storage bench"]) {
    const project = generateFromPrompt(p);
    const left = unresolvedFaults(project, buildPlan(project).instructions).filter((f) => /cleat/i.test(f.on));
    assert.deepEqual(left, [], p);
  }
});

test("a slat standing under the span's end, or a base running on past it, is not a ledger", () => {
  // Radiator cover: grille slat 1 stands under the top shelf's left end. It meets the shelf; it does not carry it.
  const slat = panelSupports(frame(part("Grille slat 1", "rail", 0.95, -21.5, 6, 1.5, 25, 1.5))).get("Floor")?.on ?? [];
  assert.ok(!slat.includes("Grille slat 1"), JSON.stringify(slat));
  // Water wheel: the cross rail's end grazes a 2 1/4" base that runs on past it, between the posts.
  const base = panelSupports(frame(part("Left base", "rail", -1.05, 1.7, 1, 2.16, 1.8, 16))).get("Floor")?.on ?? [];
  assert.ok(!base.includes("Left base"), JSON.stringify(base));
});
