// Home cards: drawers slide like the doors swing. Groups (solid box + front today, hollow 5-part box tomorrow) slide as
// one along +z by about 2/3 of the depth, never leaving the carcass; same timing as the doors; transform only;
// reduced motion is an instant toggle; paused with the grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { drawerKey, drawerSpecs, isRaised, lower, raise, type Drawer } from "../src/components/home/showcase-drawers";
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
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), /\b(left|top|width|height|x|y|d|points)\s*:\s*`|setAttribute\(|\.style\.(left|top|width|height|margin)/, "nothing but transform changes");
  assert.match(src, /const STACK_MS = 70;/);
  assert.match(home, /prefers-reduced-motion: reduce[\s\S]{0,900}setOpen\(drawers, true\)/);
  assert.match(home, /anims\.current\.push\(\.\.\.slide\(drawers, "once"/);
  assert.match(home, /anims\.current\.forEach\(\(a\) => a\.playState === "running" && a\.pause\(\)\)/, "drawer slides are in the grid's paused set");
});

// ---- paint order: an open drawer is painted last, and put back once shut ----
class N {
  parentNode: N | null = null;
  kids: N[] = [];
  constructor(readonly name: string) {}
  get isConnected() { let n: N | null = this; while (n.parentNode) n = n.parentNode; return n.name === "svg"; }
  insertBefore(n: N, ref: N) { n.remove(); n.parentNode = this; this.kids.splice(this.kids.indexOf(ref), 0, n); return n; }
  appendChild(n: N) { n.remove(); n.parentNode = this; this.kids.push(n); return n; }
  remove() { if (this.parentNode) this.parentNode.kids.splice(this.parentNode.kids.indexOf(this), 1); this.parentNode = null; }
  replaceWith(n: N) { const p = this.parentNode!; p.insertBefore(n, this); this.remove(); }
  compareDocumentPosition(o: N) { const p = this.parentNode!.kids; return p.indexOf(o) > p.indexOf(this) ? 4 : 2; }
}
function drawing(names: string[]) {
  (globalThis as { document?: unknown }).document = { createComment: (t: string) => new N("#" + t) };
  (globalThis as { Node?: unknown }).Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
  const svg = new N("svg");
  const parts = Object.fromEntries(names.map((n) => [n, svg.appendChild(new N(n))]));
  const order = () => svg.kids.filter((k) => !k.name.startsWith("#")).map((k) => k.name).join(" ");
  const dr = (...ids: string[]) => ({ els: ids.map((i) => parts[i]) as unknown as SVGGElement[], at: () => "", open: 1, stack: 0 }) as Drawer;
  return { svg, order, dr };
}

test("paint order: an open drawer paints over the fixed parts listed after it (pocket vanity's right knee divider), and goes back once shut", () => {
  const { order, dr } = drawing(["upright", "drawerR", "frontR", "divider", "counter"]);
  const shut = order();
  const right = dr("drawerR", "frontR");
  raise([right]);
  assert.equal(order(), "upright divider counter drawerR frontR", "the open drawer paints last");
  assert.ok(isRaised(right.els[0]));
  raise([right]);
  assert.equal(order(), "upright divider counter drawerR frontR", "raising twice changes nothing");
  lower([right]);
  assert.equal(order(), shut, "shut: the drawing's own order is back");
  assert.ok(!isRaised(right.els[0]));
});

test("paint order: drawers that open at different moments keep the drawing's order between them", () => {
  const { order, dr } = drawing(["lower", "lowerFront", "upper", "upperFront", "divider"]);
  const top = dr("upper", "upperFront"), bottom = dr("lower", "lowerFront");
  raise([top]); // the stagger runs top first
  raise([bottom]);
  assert.equal(order(), "divider lower lowerFront upper upperFront", "the upper drawer still paints over the lower one");
  lower([top]);
  lower([bottom]);
  assert.equal(order(), "lower lowerFront upper upperFront divider");
});

test("paint order is wired: raised from the moment a drawer moves (once, hover, reduced motion), put back when shut", () => {
  const src = fs.readFileSync("src/components/home/showcase-drawers.ts", "utf8");
  assert.match(src, /if \(kind !== "close"\) whenAt\(mine\[0\], start, \(\) => raise\(\[dr\]\)\);/);
  assert.match(src, /if \(kind !== "open"\) mine\[0\]\.finished\.then\(\(\) => lower\(\[dr\]\), \(\) => \{\}\);/);
  assert.match(src, /if \(open\) raise\(drawers\);\n  else lower\(drawers\);/);
});
