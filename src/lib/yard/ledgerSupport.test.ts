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
