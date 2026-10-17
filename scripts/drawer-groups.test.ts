// Operate on the bench: a drawer slides as one group. Three paths: a shared drawer id; a drawer front plus the parts
// under it; and, with no group, today's behaviour (a lone box pulls by its own depth, a lone front stays put).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { benchDrawerPull, drawerGroups, groupPull, legacyPull } from "../src/components/workspace/drawerGroups";
import { generateFromPrompt } from "../src/lib/yard/prompt";

type P = { id: string; type: string; name: string; position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number }; yaw?: number; drawerId?: string };
const part = (id: string, type: string, name: string, [x, y, z]: number[], [w, h, d]: number[], extra: Partial<P> = {}): P => ({ id, type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, ...extra });
const carcass = [part("side-l", "side", "Left side", [-12, 0, 0], [0.75, 30, 18]), part("bottom", "bottom", "Bottom", [-11, 0, 0], [22, 0.75, 18]), part("rail", "rail", "Drawer rail", [-11, 10, 17], [22, 1, 1]), part("runner", "rail", "Drawer runner left", [-11, 3, 0], [0.75, 0.75, 17])];

test("path 1: parts sharing a drawer id slide as one drawer (SWE's hollow 5-part box), whatever their names", () => {
  const box = [
    part("f", "rail", "Drawer front 1", [-11, 3, 17.25], [22, 6, 0.75], { drawerId: "d1" }),
    part("l", "side", "Drawer 1 left side", [-10.5, 3.5, 0.5], [0.5, 5, 16.75], { drawerId: "d1" }),
    part("r", "side", "Drawer 1 right side", [10, 3.5, 0.5], [0.5, 5, 16.75], { drawerId: "d1" }),
    part("b", "back", "Box back", [-10, 3.5, 0.5], [20, 5, 0.5], { drawerId: "d1" }), // no "drawer" in its name
    part("bt", "bottom", "Bottom panel", [-10, 3.5, 0.5], [20, 0.25, 16.75], { drawerId: "d1" }),
  ];
  const panels = [...carcass, ...box];
  const g = drawerGroups(panels);
  assert.equal(g.length, 1);
  assert.equal(g[0].by, "drawer-id");
  assert.deepEqual(g[0].ids.sort(), ["b", "bt", "f", "l", "r"]);
  assert.equal(g[0].depth, 17.5);
  assert.ok(Math.abs(g[0].pull - groupPull(17.5)) < 1e-3);
  assert.ok(g[0].pull <= g[0].depth - 1 && Math.abs(g[0].pull - (2 / 3) * 17.5) < 1e-3, "about 2/3 of the depth, an inch left in");
  for (const p of box) assert.equal(benchDrawerPull(panels, p), g[0].pull, `${p.name} moves with its drawer`);
  for (const p of carcass) assert.equal(benchDrawerPull(panels, p), null, `${p.name} never moves`);
  // Two drawers with their own ids stay apart, and a turned part never slides.
  const second = box.map((p) => ({ ...p, id: p.id + "2", drawerId: "d2", position: { ...p.position, y: p.position.y + 8 } }));
  const turned = part("t", "side", "Drawer 3 side", [0, 20, 0], [0.5, 5, 16], { drawerId: "d3", yaw: Math.PI / 2 });
  const g2 = drawerGroups([...panels, ...second, turned]);
  assert.deepEqual(g2.map((x) => x.ids.length), [5, 5]);
  assert.equal(benchDrawerPull([...panels, turned], turned), null);
});

test("path 2: no drawer id yet: a drawer front plus the parts under it (today's solid box) slide together", () => {
  const panels = [...carcass,
    part("box1", "drawer", "Left drawer 1", [-10.5, 3.5, 0.25], [10, 6, 16.75]),
    part("front1", "rail", "Left drawer front 1", [-11, 3.5, 17], [11, 6, 0.75]),
    part("pull1", "hardware", "Left drawer 1 pull", [-6, 6, 17.75], [4, 1, 1]), // the same drawer by name, in front of the face
    part("box2", "drawer", "Left drawer 2", [-10.5, 10.5, 0.25], [10, 6, 16.75]),
    part("front2", "rail", "Left drawer front 2", [-11, 10.5, 17], [11, 6, 0.75]),
  ];
  const g = drawerGroups(panels);
  assert.deepEqual(g.map((x) => x.by), ["front", "front"]);
  assert.deepEqual(g.map((x) => x.ids.sort()), [["box1", "front1", "pull1"], ["box2", "front2"]]);
  const pull = benchDrawerPull(panels, panels.find((p) => p.id === "front1")!);
  assert.equal(benchDrawerPull(panels, panels.find((p) => p.id === "box1")!), pull, "the box and its front move by the same amount");
  assert.equal(benchDrawerPull(panels, panels.find((p) => p.id === "pull1")!), pull);
  assert.notEqual(pull, null);
  assert.equal(benchDrawerPull(panels, panels.find((p) => p.id === "rail")!), null, "a drawer rail never moves");
  assert.equal(benchDrawerPull(panels, panels.find((p) => p.id === "runner")!), null, "nor a runner, though it sits under the front");
  assert.equal(benchDrawerPull(panels, panels.find((p) => p.id === "bottom")!), null, "nor the carcass bottom");
  // The real recipes: every desk, vanity and dresser drawer is its box + its front, and the front now moves with it.
  for (const q of ["desk with drawers", "bathroom vanity with drawers", "dresser 36 wide 3 drawers", "nightstand with a drawer"]) {
    const ps = generateFromPrompt(q).panels as P[];
    const gs = drawerGroups(ps);
    const fronts = ps.filter((p) => /drawer front/i.test(p.name));
    assert.equal(gs.length, fronts.length, q);
    for (const x of gs) {
      const members = ps.filter((p) => x.ids.includes(p.id));
      assert.equal(members.filter((p) => p.type === "drawer").length, 1, `${q}: one box per front`);
      assert.ok(x.pull > 0 && x.pull <= x.depth - 1, `${q}: ${x.pull} of ${x.depth}`);
    }
  }
});

test("path 3: no group found: today's behaviour (a lone box pulls by its own depth, a lone front stays put)", () => {
  const box = part("box", "drawer", "Drawer", [-10, 3, 0], [20, 6, 20]);
  const front = part("front", "rail", "Drawer front 2", [-11, 12, 17], [22, 6, 0.75]); // nothing under it
  const panels = [...carcass, box, front];
  assert.deepEqual(drawerGroups(panels), []);
  assert.equal(benchDrawerPull(panels, box), legacyPull(20));
  assert.equal(legacyPull(20), 15);
  assert.equal(legacyPull(4), 8);
  assert.equal(legacyPull(40), 16);
  assert.equal(benchDrawerPull(panels, front), null, "a front with nothing under it stays put");
  assert.equal(benchDrawerPull(panels, { ...box, yaw: 0.3 }), null, "a turned box never slides");
});

test("the bench reads the groups: one pull per part from benchDrawerPull, today's own-depth rule only as the fallback", () => {
  const src = fs.readFileSync("src/components/workspace/stick-cloud.tsx", "utf8");
  assert.match(src, /const drawerPull = useYard\(\(s\) => benchDrawerPull\(s\.project\.panels, panel\)\);/);
  assert.match(src, /\(isDoor \|\| !!hostDoor \|\| drawerPull != null \|\| isLid \|\| !!leaf\)/);
  assert.match(src, /groupPos = \[cx \* explode, cy, \(cz \+ drawerPull\) \* explode\];/);
  assert.doesNotMatch(src, /d \* 0\.75/, "the own-depth rule lives only in drawerGroups.legacyPull");
  assert.doesNotMatch(fs.readFileSync("src/components/workspace/drawerGroups.ts", "utf8"), /\.(position|size)\.\w+\s*=[^=]/, "read-only: no part geometry is written");
});
