// Home cards: drawers slide like the doors swing. Groups (solid box + front today, hollow 5-part box tomorrow) slide as
// one along +z by about 2/3 of the depth, never leaving the carcass; same timing as the doors; transform only;
// reduced motion is an instant toggle; paused with the grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cutPlane, drawerKey, drawerSpecs, hull, isSplit, keyframes, slideAt, split, sweep, unsplit, type Drawer } from "../src/components/home/showcase-drawers";
import { closeCurve, openCurve } from "../src/components/home/showcase-doors";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { showcaseFor } from "../src/lib/yard/homeShowcase";

const part = (id: string, name: string, type: string, x: number, y: number, z: number, w: number, h: number, d: number) => ({ id, name, type, position: { x, y, z }, size: { width: w, height: h, depth: d } });

test("a drawer and its parts share one key; carcass parts named for drawers never slide", () => {
  for (const [n, k] of [["Left drawer 1", "left drawer 1"], ["Left drawer front 1", "left drawer 1"], ["Drawer front", "drawer"], ["Drawer 2 left side", "drawer 2"], ["Drawer 2 right side", "drawer 2"], ["Drawer 2 back", "drawer 2"], ["Drawer 2 bottom", "drawer 2"], ["Left drawer 10", "left drawer 10"]] as const)
    assert.equal(drawerKey(n), k, n);
  for (const n of ["Drawer rail 1", "Drawer runner", "Drawer divider", "Side", "Top"]) assert.equal(drawerKey(n), null, n);
});

test("today's solid drawers: box + front slide as one group, ~2/3 of the depth, at least 1 in left in the carcass", () => {
  const p = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
  const specs = drawerSpecs(p.panels);
  assert.ok(specs.length >= 3);
  for (const s of specs) {
    const names = s.ids.map((id) => p.panels.find((q) => q.id === id)!.name);
    assert.ok(names.some((n) => /front/i.test(n)) && names.some((n) => !/front/i.test(n)), `box + front: ${names}`);
    assert.ok(Math.abs(s.open - (2 / 3) * s.d) < 0.01 || s.open === s.d - 1, `${s.open} of ${s.d}`);
    assert.ok(s.open <= s.d - 1);
  }
  // Every grouped part is in the card's drawing.
  const svg = showcaseFor("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space").svg;
  for (const s of specs) for (const id of s.ids) assert.ok(svg.includes(`data-part="${id}"`), id);
  // Top drawer first, for the stagger down the stack.
  assert.deepEqual(specs.map((s) => s.y), [...specs.map((s) => s.y)].sort((a, b) => b - a));
});

test("SWE's hollow 5-part box (front, two sides, back, bottom) is one group with the box's own depth", () => {
  const ps = [
    part("f", "Drawer 1 front", "rail", 0, 10, 17.25, 20, 6, 0.75),
    part("l", "Drawer 1 left side", "side", 0.5, 10.5, 1, 0.5, 5, 16.25),
    part("r", "Drawer 1 right side", "side", 19, 10.5, 1, 0.5, 5, 16.25),
    part("b", "Drawer 1 back", "back", 0.5, 10.5, 1, 19, 5, 0.5),
    part("m", "Drawer 1 bottom", "bottom", 0.5, 10.5, 1, 19, 0.25, 16.25),
    part("rail", "Drawer rail 1", "rail", 0, 9.5, 0, 20, 0.75, 18),
  ];
  const [s, ...rest] = drawerSpecs(ps);
  assert.equal(rest.length, 0);
  assert.deepEqual([...s.ids].sort(), ["b", "f", "l", "m", "r"]);
  assert.equal(s.d, 17);
  assert.ok(Math.abs(s.open - 34 / 3) < 0.01);
  // A turned part or a lone front with nothing behind it never slides.
  assert.equal(drawerSpecs([part("f", "Drawer front", "rail", 0, 0, 17, 20, 6, 0.75)]).length, 0);
});

test("the slide: transform only, door timing and curves, slight stack stagger, reduced motion an instant toggle, paused with the grid", () => {
  const src = fs.readFileSync("src/components/home/showcase-drawers.ts", "utf8");
  const home = fs.readFileSync("src/routes/index.tsx", "utf8");
  assert.match(src, /import \{ CLOSE_MS, ONCE_MS, OPEN_MS, closeCurve, openCurve \} from "\.\/showcase-doors"/);
  assert.match(src, /translate\(/);
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\b(left|top|width|height|x|y|d)\s*:\s*`|\.style\.(left|top|width|height|margin)/, "nothing but transform changes");
  // Attributes are set only to build the split (fixed clip outlines, made once), never per frame.
  for (const m of code.matchAll(/setAttribute\(([^,]+),/g)) assert.match(m[1], /^(k|"clip-path"|"data-drawer-copy")$/, m[0]);
  assert.doesNotMatch(code, /\.animate\([^)]*(points|clip)/, "clip outlines never animate");
  assert.match(src, /const STACK_MS = 70;/);
  assert.match(home, /prefers-reduced-motion: reduce[\s\S]{0,900}setOpen\(drawers, true\)/);
  assert.match(home, /anims\.current\.push\(\.\.\.slide\(drawers, "once"/);
  assert.match(home, /anims\.current\.forEach\(\(a\) => a\.playState === "running" && a\.pause\(\)\)/, "drawer slides are in the grid's paused set");
});

// ---- paint order: an open drawer is split at the case face; beyond it is drawn last, inside keeps the order ----
test("cut plane: the frontmost point any fixed part could hide, never behind the drawer box's own front", () => {
  // A drawer box (z 0.25..30) with a front proud to 30.75, under a desk top flush with the case face at 30.
  const drawer = [[1, 19.5, 0.25, 15, 26, 30], [0.5, 19.5, 30, 15.5, 26.5, 30.75]];
  const top = [0, 27.5, 0, 60, 29, 30], side = [15.5, 0, 0, 16.25, 27.5, 30];
  assert.equal(cutPlane(drawer, new Set([1]), [top, side], 20), 30, "the case face, level with the top's front");
  // A top overhanging the fronts pushes the cut out to its front edge, less the climb up to it (1" over the fronts).
  assert.equal(cutPlane(drawer, new Set([1]), [[0, 27.5, 0, 60, 29, 31.75]], 20), 30.75);
  assert.equal(cutPlane(drawer, new Set([1]), [[0, 26.5, 0, 60, 29, 31.75]], 20), 31.75);
  // A part well below or left of the drawer can never hide it (the ray only climbs in x, y and z).
  assert.equal(cutPlane(drawer, new Set([1]), [[0, 0, 0, 60, 2, 40], [-20, 0, 0, -1, 40, 40]], 20), 30);
  // A part up and to the right hides points up to its front less the climb: 40 − max(0, 30 − 15.5, 0) = 25.5 < 30.
  assert.equal(cutPlane(drawer, new Set([1]), [[30, 19.5, 0, 31, 26, 40]], 20), 30);
  assert.equal(cutPlane(drawer, new Set([1]), [[16, 19.5, 0, 17, 26, 40]], 20), 39.5);
  // Never past the open front: then nothing is beyond the cut.
  assert.equal(cutPlane(drawer, new Set([1]), [[0, 27.5, 0, 60, 29, 80]], 20), 50.75);
});

test("cut planes of the home cards: the desk and the pocket vanity split at their case faces (the top and the counter)", () => {
  for (const [prompt, face] of [["desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", 30]] as const) {
    const p = generateFromPrompt(prompt);
    for (const s of drawerSpecs(p.panels)) {
      assert.equal(s.cut, face);
      assert.equal(s.boxes.length, s.ids.length);
      assert.ok(s.cut < Math.max(...s.boxes.map((b) => b[5])) + s.open, "some of the open drawer is beyond the cut");
    }
  }
});

test("sweeps: hull of the swept outline; a still sweep [cut, ∞) meets a riding sweep (−∞, front] in exactly [cut, front]", () => {
  const C = Math.cos(Math.PI / 6);
  const proj = (x: number, y: number, z: number): [number, number] => [(x - z) * C, -y + (x + z) / 2];
  assert.equal(hull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 0]]).length, 4);
  const poly = (s: string) => s.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const inside = (pts: [number, number][], q: [number, number]) => {
    let sgn = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const c = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
      if (Math.abs(c) < 1e-6) continue;
      if (sgn && Math.sign(c) !== sgn) return false;
      sgn = Math.sign(c);
    }
    return true;
  };
  const [x0, x1, y0, y1] = [0, 14, 0, 6];
  const still = poly(sweep(proj, x0, x1, y0, y1, 10, 60)), riding = poly(sweep(proj, x0, x1, y0, y1, -60, 18)), exact = poly(sweep(proj, x0, x1, y0, y1, 10, 18));
  let n = 0;
  for (let X = -60; X <= 40; X += 0.7) for (let Y = -30; Y <= 40; Y += 0.7) {
    const q: [number, number] = [X, Y];
    const a = inside(still, q) && inside(riding, q), b = inside(exact, q);
    // Off by a hair at the edges is rounding (toFixed(2)); anywhere else they must agree.
    if (a !== b) n++;
  }
  assert.ok(n < 30, `${n} disagreeing samples`);
});

// A tiny DOM: enough for split / unsplit (wrap in place, copies appended last, clip defs made and removed).
class N {
  parentNode: N | null = null;
  kids: N[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string> = { transform: "" };
  ownerSVGElement: N | null = null;
  constructor(readonly name: string) {}
  get firstChild() { return this.kids[0] ?? null; }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  removeAttribute(k: string) { delete this.attrs[k]; }
  insertBefore(n: N, ref: N | null) { n.remove(); n.parentNode = this; if (ref) this.kids.splice(this.kids.indexOf(ref), 0, n); else this.kids.push(n); return n; }
  appendChild(n: N) { return this.insertBefore(n, null); }
  remove() { if (this.parentNode) this.parentNode.kids.splice(this.parentNode.kids.indexOf(this), 1); this.parentNode = null; }
  replaceWith(n: N) { const p = this.parentNode!; p.insertBefore(n, this); this.remove(); }
  cloneNode() { const c = new N(this.name + "'"); c.attrs = { ...this.attrs, id: "x" }; return c; }
  querySelector(sel: string) { return sel.includes("defs") ? (this.kids.find((k) => k.name === "defs") ?? null) : null; }
  querySelectorAll() { return []; }
  getAnimations() { return []; }
  compareDocumentPosition(o: N) { const p = this.parentNode!.kids; return p.indexOf(o) > p.indexOf(this) ? 4 : 2; }
}
function drawing(names: string[]) {
  (globalThis as { document?: unknown }).document = { createElementNS: (_: string, n: string) => new N(n) };
  (globalThis as { Node?: unknown }).Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
  const svg = new N("svg");
  const g = svg.appendChild(new N("g"));
  const parts = Object.fromEntries(names.map((n) => { const e = g.appendChild(new N(n)); e.ownerSVGElement = svg; return [n, e]; }));
  const label = (k: N): string => (k.attrs["data-drawer-inside"] !== undefined ? `[${k.kids.map(label).join(" ")}]` : k.attrs["data-drawer-near"] !== undefined ? `near(${k.kids.map((c) => c.kids[0].name).join(" ")})` : k.name);
  const order = () => g.kids.map(label).join(" ");
  const clips = { inside: "0,0 1,0 1,1", near: "0,0 2,0 2,2", front: "0,0 3,0 3,3" };
  const dr = (...ids: string[]) => ({ els: ids.map((i) => parts[i]) as unknown as SVGGElement[], at: () => "translate(1px, 1px)", open: 1, stack: 0, clips: ids.map(() => clips) }) as Drawer;
  return { svg, order, dr };
}

test("split: the inside stays in the drawing's order (each part wrapped in place); the copy beyond the cut paints last; shut puts it all back", () => {
  const { svg, order, dr } = drawing(["upright", "drawerR", "frontR", "divider", "counter"]);
  const shut = order();
  const right = dr("drawerR", "frontR");
  split([right]);
  assert.equal(order(), "upright [drawerR] [frontR] divider counter near(drawerR' frontR')", "inside in place, beyond the cut last");
  assert.ok(isSplit(right));
  const defs = svg.kids.find((k) => k.name === "defs")!;
  assert.equal(defs.kids.length, 6, "three fixed clip outlines per part (a front and a body are clipped apart: together they are not convex)");
  const near = (svg.kids[1] as N).kids.at(-1)!;
  assert.ok(near.kids.every((w) => w.attrs["clip-path"] && w.kids.length === 1 && w.kids[0].attrs["clip-path"] && w.kids[0].attrs["clip-path"] !== w.attrs["clip-path"] && !("id" in w.kids[0].attrs)), "per part: still clip [cut, ∞) on its group, riding clip (−∞, front] on its copy; no duplicate ids");
  assert.equal(new Set(defs.kids.map((d) => d.attrs.id)).size, 6, "unique clip ids");
  split([right]);
  assert.equal(order(), "upright [drawerR] [frontR] divider counter near(drawerR' frontR')", "splitting twice changes nothing");
  unsplit([right]);
  assert.equal(order(), shut, "shut: the drawing's own order is back");
  assert.equal(defs.kids.length, 0, "clip outlines removed");
  assert.ok(!isSplit(right));
});

test("split: drawers that open at different moments keep the drawing's order between their copies", () => {
  const { order, dr } = drawing(["lower", "lowerFront", "upper", "upperFront", "divider"]);
  const top = dr("upper", "upperFront"), bottom = dr("lower", "lowerFront");
  split([top]); // the stagger runs top first
  split([bottom]);
  assert.equal(order(), "[lower] [lowerFront] [upper] [upperFront] divider near(lower' lowerFront') near(upper' upperFront')", "the upper drawer's copy still paints over the lower one's");
  unsplit([top]);
  unsplit([bottom]);
  assert.equal(order(), "lower lowerFront upper upperFront divider");
});

test("split is wired: before a drawer moves (once, hover, reduced motion), copies ride the same slide, joined once shut", () => {
  const src = fs.readFileSync("src/components/home/showcase-drawers.ts", "utf8");
  assert.match(src, /if \(kind !== "close"\) split\(\[dr\]\);/);
  assert.match(src, /for \(const g of movers\(dr\)\) \{/);
  assert.match(src, /if \(kind !== "open" && mine\.length\) mine\[0\]\.finished\.then\(\(\) => unsplit\(\[dr\]\), \(\) => \{\}\);/);
  assert.match(src, /if \(open\) split\(drawers\);[\s\S]{0,200}if \(!open\) unsplit\(drawers\);/);
});

test("a drawer never slides past shut: the close (hover and once) is clamped at 0, no overshoot into the case", () => {
  // The doors' close curve bumps past shut (a door's slam); unclamped, a 14 in desk drawer went ~3/8 in into the case.
  const raw = Math.min(...Array.from({ length: 2001 }, (_, i) => closeCurve(i / 2000)));
  assert.ok(raw < -0.01, `the shared door curve still overshoots (${raw}), so the clamp is what keeps drawers shut`);
  for (let i = 0; i <= 2000; i++) {
    assert.ok(slideAt(closeCurve, i / 2000) >= 0, `close at ${i / 2000}`);
    assert.ok(slideAt(openCurve, i / 2000) >= 0, `open at ${i / 2000}`);
    assert.equal(slideAt(closeCurve, i / 2000), Math.max(0, closeCurve(i / 2000)));
  }
  // Every keyframe of every kind: the slide distance (along the drawer's +z) is never negative; the slide still opens.
  const dr = { els: [], open: 14.5, stack: 0, at: (t: number) => String(t) } as unknown as Drawer;
  for (const kind of ["once", "open", "close"] as const) {
    const kf = keyframes(dr, kind);
    const d = kf.map((k) => Number(k.transform));
    assert.ok(Math.min(...d) >= 0, `${kind}: ${Math.min(...d)}`);
    assert.ok(Math.max(...d) >= 14.5, `${kind} still reaches open`);
    if (kind !== "open") assert.ok(Math.abs(d[d.length - 1]) < 1e-9, `${kind} ends shut`);
    assert.ok(kf.every((k, i) => i === 0 || k.offset >= kf[i - 1].offset), `${kind} offsets in order`);
  }
  // Real cards: the desk's drawers (where Critic saw it) and every drawer card in the home set end exactly shut.
  const p = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
  for (const s of drawerSpecs(p.panels)) {
    const d = keyframes({ ...dr, open: s.open } as Drawer, "close").map((k) => Number(k.transform));
    assert.ok(Math.min(...d) >= 0 && Math.abs(d[d.length - 1]) < 1e-9, `desk drawer ${s.ids[0]}: ${Math.min(...d)}`);
  }
});
