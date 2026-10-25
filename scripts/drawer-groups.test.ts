// Operate on the bench: a drawer slides as one group. Three paths: a shared drawer id; a drawer front plus the parts
// under it; and, with no group, today's behaviour (a lone box pulls by its own depth, a lone front stays put).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { benchDrawerPull, benchPullDepth, drawerGroups, groupPull, legacyPull, maxOpenPull, staggerPull } from "../src/components/workspace/drawerGroups";
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
  // The box's pull is drawn on its front's outer face (z 17.75), not buried inside the front.
  const box1 = panels.find((p) => p.id === "box1")!;
  assert.equal(box1.position.z + box1.size.depth / 2 + benchPullDepth(panels, box1) / 2, 17.75);
  // The real recipes: every desk, vanity and dresser drawer is its box + its front, and the front now moves with it.
  for (const q of ["desk with drawers", "bathroom vanity with drawers", "dresser 36 wide 3 drawers", "nightstand with a drawer"]) {
    const ps = generateFromPrompt(q).panels as P[];
    const gs = drawerGroups(ps);
    const fronts = ps.filter((p) => /drawer front/i.test(p.name));
    assert.equal(gs.length, fronts.length, q);
    for (const x of gs) {
      const members = ps.filter((p) => x.ids.includes(p.id));
      // Since #94 every drawer is a hollow 5-part box sharing one drawer id; count fronts, not box parts.
      assert.equal(members.filter((p) => /drawer front/i.test(p.name)).length, 1, `${q}: one front per drawer`);
      assert.ok(members.some((p) => p.type === "drawer"), `${q}: the front moves with its box`);
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
  assert.equal(benchPullDepth(panels, box), 20, "a lone box keeps its pull on its own face");
  assert.equal(benchDrawerPull(panels, { ...box, yaw: 0.3 }), null, "a turned box never slides");
});

test("the bench reads the groups: one pull per part from benchDrawerPull, today's own-depth rule only as the fallback", () => {
  const src = fs.readFileSync("src/components/workspace/stick-cloud.tsx", "utf8");
  assert.match(src, /const drawerPull = useYard\(\(s\) => benchDrawerPull\(s\.project\.panels, panel, s\.facesOpen \? s\.selectedId : null\)\);/);
  assert.match(src, /\(isDoor \|\| !!hostDoor \|\| drawerPull != null \|\| isLid \|\| !!leaf\)/);
  assert.match(src, /groupPos = \[cx \* explode, cy, \(cz \+ drawerPull\) \* explode\];/);
  assert.match(src, /<CupPull w=\{w\} h=\{h\} d=\{pullDepth\} \/>/);
  assert.doesNotMatch(src, /d \* 0\.75/, "the own-depth rule lives only in drawerGroups.legacyPull");
  assert.doesNotMatch(fs.readFileSync("src/components/workspace/drawerGroups.ts", "utf8"), /\.(position|size)\.\w+\s*=[^=]/, "read-only: no part geometry is written");
});

test("Operate sees inside (Critic #84): stacked drawers stagger so each cavity shows; a tapped drawer opens alone to ~2/3", () => {
  for (const q of ["3 drawer dresser", "walnut dresser 6 drawers", "nightstand with 2 drawers", "filing cabinet 2 drawers"]) {
    const ps = generateFromPrompt(q).panels as P[];
    const gs = drawerGroups(ps);
    assert.ok(gs.length >= 2, q);
    const cols = new Map<string, typeof gs>();
    for (const g of gs) {
      // Bottom drawer opens the full ~2/3; each one above one even step less, so every box shows past the one above.
      assert.equal(g.open, staggerPull(g.pull, g.k, g.n), q);
      assert.ok(g.pull >= (2 / 3) * g.depth - 1e-3 || g.pull === g.depth - 1, `${q}: full pull ~2/3`);
      const key = `${g.n}:${Math.round(g.x0)}`;
      cols.set(key, [...(cols.get(key) ?? []), g]);
    }
    for (const col of cols.values()) {
      col.sort((a, b) => a.k - b.k);
      assert.equal(col[0].open, col[0].pull, `${q}: bottom drawer opens fully`);
      for (let i = 1; i < col.length; i++) {
        assert.ok(col[i].y0 > col[i - 1].y0, `${q}: k counts up the column`);
        // What shows of an open drawer's box past the drawer above it: never less than 2 1/2" (4+ stacks alternate).
        if (col[i - 1].open > 0) assert.ok(col[i - 1].open - col[i].open >= 2.5, `${q}: ${col[i - 1].open} vs ${col[i].open}`);
      }
      if (col.length > 3) assert.ok(col.every((g) => g.open === (g.k % 2 ? 0 : g.pull)), `${q}: 4+ stack alternates`);
    }
    // Tap one drawer (any of its parts): it alone opens fully; every other drawer part stays shut (0).
    const pick = gs[gs.length - 1];
    for (const p of ps) {
      const v = benchDrawerPull(ps, p, pick.ids[0]);
      if (pick.ids.includes(p.id)) assert.equal(v, pick.pull, q);
      else if (gs.some((g) => g.ids.includes(p.id))) assert.equal(v, 0, `${q}: ${p.name} stays shut`);
    }
    assert.equal(maxOpenPull(ps, pick.ids[0]), pick.pull);
    // Tapping a non-drawer part keeps the stagger.
    const shelf = ps.find((p) => !gs.some((g) => g.ids.includes(p.id)))!;
    assert.equal(benchDrawerPull(ps, ps.find((p) => p.id === pick.ids[0])!, shelf.id), pick.open);
  }
});

test("Operate cavity camera: the bench frames the open drawers and looks down into them from >= 40 degrees", () => {
  const src = fs.readFileSync("src/components/workspace/canvas.tsx", "utf8");
  assert.match(src, /maxOpenPull\(projectRef\.current\.panels, soloDrawer\)/);
  assert.match(src, /cavity \? \{ \.\.\.base, elevationDeg: Math\.max\(base\.elevationDeg, 40\) \}/);
});

test("one pull per drawer, on its front (Critic #94: filing fronts had none; hollow boxes never wear four)", async () => {
  const { benchWearsPull } = await import("../src/components/workspace/drawerGroups");
  for (const q of ["filing cabinet 2 drawers", "3 drawer dresser", "nightstand with 2 drawers", "desk with drawers"]) {
    const ps = generateFromPrompt(q).panels as P[];
    for (const g of drawerGroups(ps)) {
      const wearing = ps.filter((p) => g.ids.includes(p.id) && benchWearsPull(ps, p));
      assert.equal(wearing.length, 1, `${q}: one pull per drawer`);
      assert.match(wearing[0].name, /front/i, `${q}: the pull is on the front`);
    }
  }
});
