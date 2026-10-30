// #206 follow-up (Critic 2): render the phone Measure sheet's card and dismiss hook for real (react-dom into a tiny
// DOM), so the gap store turning on at open and resetting at close, the 390 fit with the rendered card, Escape with
// focus return, and tap-vs-drag on the bench are all checked against what the components do, not their source text.
import { test } from "node:test";
import assert from "node:assert/strict";

// ---- a tiny DOM: just what react-dom's client renderer and these components touch ----
type L = (e: { type: string; key?: string; defaultPrevented?: boolean; preventDefault?: () => void }) => void;
class Ev {
  ls = new Map<string, Set<L>>();
  addEventListener(t: string, f: L) { (this.ls.get(t) ?? this.ls.set(t, new Set()).get(t)!).add(f); }
  removeEventListener(t: string, f: L) { this.ls.get(t)?.delete(f); }
  dispatch(e: Parameters<L>[0]) { this.ls.get(e.type)?.forEach((f) => f(e)); }
}
class N extends Ev {
  childNodes: N[] = []; parentNode: N | null = null; attrs = new Map<string, string>(); style: Record<string, unknown> = { setProperty() {} };
  namespaceURI = "http://www.w3.org/1999/xhtml";
  constructor(public nodeType: number, public nodeName: string, public ownerDocument: Doc | null) { super(); }
  get tagName() { return this.nodeName; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get isConnected(): boolean { return this.nodeType === 9 || (this.parentNode?.isConnected ?? false); }
  appendChild(c: N) { c.parentNode?.removeChild(c); this.childNodes.push(c); c.parentNode = this; return c; }
  insertBefore(c: N, r: N | null) { if (!r) return this.appendChild(c); c.parentNode?.removeChild(c); this.childNodes.splice(this.childNodes.indexOf(r), 0, c); c.parentNode = this; return c; }
  removeChild(c: N) { this.childNodes.splice(this.childNodes.indexOf(c), 1); c.parentNode = null; return c; }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  hasAttribute(k: string) { return this.attrs.has(k); }
  set textContent(v: string) { this.childNodes = []; if (v) this.appendChild(new N(3, "#text", this.ownerDocument)); }
  set className(v: string) { this.attrs.set("class", v); }
  get className() { return this.attrs.get("class") ?? ""; }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  all(sel: string): N[] { const k = sel.slice(1, -1); return this.childNodes.flatMap((c) => [...(c.attrs.has(k) ? [c] : []), ...c.all(sel)]); }
}
class Doc extends N {
  documentElement: N; body: N; activeElement: N;
  defaultView = globalThis;
  constructor() { super(9, "#document", null); this.documentElement = this.appendChild(new N(1, "HTML", this)); this.body = this.documentElement.appendChild(new N(1, "BODY", this)); this.activeElement = this.body; }
  createElement(t: string) { return new N(1, t.toUpperCase(), this); }
  createElementNS(_: string, t: string) { return this.createElement(t); }
  createTextNode(t: string) { const n = new N(3, "#text", this); (n as unknown as { nodeValue: string }).nodeValue = t; return n; }
}
const doc = new Doc();
let phoneWidth = true;
const win = new Ev();
Object.assign(globalThis, {
  document: doc, window: Object.assign(globalThis, { addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win), matchMedia: (q: string) => ({ media: q, matches: phoneWidth, addEventListener() {}, removeEventListener() {} }) }),
  HTMLElement: N, HTMLIFrameElement: class {}, IS_REACT_ACT_ENVIRONMENT: true,
});

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { benchModelBox, benchView, fitBench, projectCorners } = await import("../src/lib/yard/benchFrame");
const { generateFromPrompt } = await import("../src/lib/yard/promptMain");
const gapPath = "../src/components/workspace/measure-sheet-gap";
const cardPath = "../src/components/workspace/measure-sheet-card";
const loaded = await Promise.all([import(gapPath), import(cardPath)]).catch(() => null);
const need = () => { assert.ok(loaded, "the #206 sheet card and gap store exist"); return { ...loaded[0], ...loaded[1] }; };

function mount(el: React.ReactElement) {
  const host = doc.body.appendChild(doc.createElement("div"));
  const root = createRoot(host as unknown as HTMLElement);
  act(() => root.render(el));
  return { host, render: (e: React.ReactElement) => act(() => root.render(e)), unmount: () => { act(() => root.unmount()); doc.body.removeChild(host); } };
}

test("rendered card: the gap store turns on when the phone sheet opens and resets when it closes", () => {
  const { MeasureSheetGap, sheetGapOpen } = need();
  phoneWidth = true;
  const m = mount(React.createElement(MeasureSheetGap, { show: false }));
  assert.equal(sheetGapOpen(), false, "closed: off");
  assert.equal(m.host.all("[data-bench-overlay]").length, 0, "closed: no card");
  m.render(React.createElement(MeasureSheetGap, { show: true }));
  assert.equal(sheetGapOpen(), true, "open on a phone: on");
  assert.equal(m.host.all("[data-bench-overlay]")[0]?.getAttribute("data-bench-overlay"), "measure-sheet");
  m.render(React.createElement(MeasureSheetGap, { show: false }));
  assert.equal(sheetGapOpen(), false, "closed again: reset");
  m.render(React.createElement(MeasureSheetGap, { show: true }));
  m.unmount();
  assert.equal(sheetGapOpen(), false, "unmounted while open (a route change): reset");
  phoneWidth = false;
  const d = mount(React.createElement(MeasureSheetGap, { show: true }));
  assert.equal(sheetGapOpen(), false, "desktop: the panel is beside the bench, no gap");
  d.unmount();
  phoneWidth = true;
});

// 390 x 844 phone on the release build: bench canvas 683 tall (top 161), dock card 12..378 x 478.5..671 in canvas px.
const vp = { w: 390, h: 683 }, vh = 844;
const dock = { left: 12, top: 478.5, right: 378, bottom: 671 };
// The rendered card's box from its classes (bottom-0, inset-x-0, h-[Nvh]); md:hidden is shown at 390.
const rectOf = (n: { className: string }) => {
  const h = Number(/h-\[(\d+)vh\]/.exec(n.className)?.[1] ?? 0) / 100 * vh;
  assert.match(n.className, /inset-x-0 bottom-0/);
  return { left: 0, top: vp.h - h, right: vp.w, bottom: vp.h };
};
for (const prompt of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity 48 wide"]) {
  test(`fit at 390 with the rendered sheet card: the whole model clears the open sheet (${prompt})`, () => {
    const { MeasureSheetGap } = need();
    const m = mount(React.createElement(MeasureSheetGap, { show: true }));
    const cards = m.host.all("[data-bench-overlay]").map(rectOf);
    m.unmount();
    const project = generateFromPrompt(prompt);
    const box = benchModelBox(project), view = benchView(project, box);
    const ys = projectCorners(fitBench({ box, view, viewport: vp, overlays: [dock, ...cards] }), vp, box).map((c) => c.y);
    const sheetTop = vp.h - vh / 2;
    assert.ok(Math.max(...ys) <= sheetTop, `lowest corner ${Math.max(...ys).toFixed(1)} is above the sheet top ${sheetTop}`);
    assert.ok(Math.min(...ys) >= 0, "top stays on the canvas");
  });
}

test("Escape closes the phone sheet and puts focus back on the control that opened it", () => {
  const { useMeasureSheetDismiss } = need();
  phoneWidth = true;
  let open = false, closes = 0;
  const opener = doc.body.appendChild(doc.createElement("button"));
  const Probe = () => { useMeasureSheetDismiss(open, () => { closes++; open = false; }); return null; };
  const m = mount(React.createElement(Probe));
  opener.focus();
  open = true; m.render(React.createElement(Probe));
  const field = doc.body.appendChild(doc.createElement("input"));
  field.focus(); // focus moved into the sheet
  let prevented = false;
  win.dispatch({ type: "keydown", key: "Enter", preventDefault() {} });
  assert.equal(closes, 0, "other keys do nothing");
  win.dispatch({ type: "keydown", key: "Escape", defaultPrevented: true });
  assert.equal(closes, 0, "an Escape a menu already handled is left alone");
  win.dispatch({ type: "keydown", key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(closes, 1, "Escape closes");
  assert.ok(prevented);
  assert.equal(doc.activeElement, opener, "focus returns to the opener");
  m.render(React.createElement(Probe));
  win.dispatch({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(closes, 1, "closed: Escape is not ours");
  m.unmount();
});

test("desktop: Escape is not the sheet's (the Measure side panel stays open)", () => {
  const { useMeasureSheetDismiss } = need();
  phoneWidth = false;
  let closes = 0;
  const Probe = () => { useMeasureSheetDismiss(true, () => closes++); return null; };
  const m = mount(React.createElement(Probe));
  win.dispatch({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(closes, 0);
  m.unmount();
  phoneWidth = true;
});

// The rendered element's React props (react-dom keeps them on the node), so a test can press what the user presses.
const propsOf = (n: N) => (n as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(n).find((k) => k.startsWith("__reactProps$"))!];

// The bench as react-three-fiber runs it: one event store per canvas, and canvas.tsx's handlers fire on pointer-down
// (Free mode: the floor places a piece; every mode: a part selects) only while that store's events are on.
const { _roots } = await import("@react-three/fiber");
const { useYard } = await import("../src/lib/yard/store");
function benchRig() {
  let on = true;
  const canvas = doc.createElement("canvas") as N & { closest: (s: string) => unknown };
  canvas.closest = (sel: string) => (sel === "canvas" ? canvas : null);
  _roots.set(canvas as never, { store: { getState: () => ({ setEvents: (e: { enabled: boolean }) => { on = e.enabled; } }) } } as never);
  const down = (mode: "free" | "look") => {
    if (!on) return;
    const s = useYard.getState();
    if (mode === "free") s.placePiece(s.project.primaryMaterialId, { x: 0, y: 0, z: 0 });
    else s.select(s.project.panels[0].id);
  };
  return { canvas, down, on: () => on, dispose: () => _roots.delete(canvas as never) };
}

for (const mode of ["free", "look"] as const) {
  test(`${mode} mode, sheet open on a phone: a tap closes it and leaves the parts and the selection alone; a drag only orbits`, () => {
    const { BenchHost } = need();
    phoneWidth = true;
    useYard.getState().setProject(generateFromPrompt("cat tree"));
    useYard.getState().select(null);
    const snap = () => { const s = useYard.getState(); return JSON.stringify([s.project.panels.length, s.project.instances.length, s.selectedId]); };
    const before = snap();
    const rig = benchRig();
    let closes = 0;
    const close = () => closes++;
    const m = mount(React.createElement(BenchHost, { sheetOpen: true, onClose: close }, null));
    const host = m.host.all("[data-bench-host]")[0];
    assert.ok(host, "the bench host renders");
    let stopped = 0;
    const press = (dx: number) => {
      const h = propsOf(host);
      // Capture on the host runs first, then the canvas's own pointer-down; the click comes after pointer-up.
      h.onPointerDownCapture({ target: rig.canvas, clientX: 100, clientY: 100 });
      rig.down(mode);
      h.onClickCapture({ target: rig.canvas, clientX: 100 + dx, clientY: 100, stopPropagation: () => { stopped++; } });
    };
    press(40);
    assert.equal(closes, 0, "a drag keeps the sheet open");
    assert.equal(snap(), before, "a drag adds no part and selects nothing");
    press(3);
    assert.equal(closes, 1, "a tap closes the sheet");
    assert.equal(snap(), before, "and adds no part and selects nothing (release: the backdrop took it)");
    assert.equal(stopped, 2, "the bench never gets the click while the sheet is open (a drag's click would read as a miss)");
    m.render(React.createElement(BenchHost, { sheetOpen: false, onClose: close }, null));
    assert.ok(rig.on(), "closed: the bench's own events are back");
    press(3);
    assert.equal(closes, 1, "closed: a tap is the bench's");
    assert.notEqual(snap(), before, `closed: the same tap ${mode === "free" ? "places a piece" : "selects a part"} again`);
    m.unmount();
    rig.dispose();
  });
}

test("rendered backdrop and bench host: the Measure backdrop takes no presses, other panels' backdrop still closes", () => {
  const { PanelBackdrop, BenchHost } = need();
  let closes = 0;
  const m = mount(React.createElement(PanelBackdrop, { sheet: true, onClose: () => closes++ }));
  const b = m.host.childNodes[0];
  assert.equal(b.getAttribute("aria-label"), "Close panel");
  assert.match(b.className, /pointer-events-none inset-x-0 top-0 h-\[50vh\]/, "Measure: clear and press-through, top half only");
  m.render(React.createElement(PanelBackdrop, { sheet: false, onClose: () => closes++ }));
  assert.doesNotMatch(b.className, /pointer-events-none/, "Stock panel: the dimmed backdrop takes taps");
  propsOf(m.host.childNodes[0]).onClick({});
  assert.equal(closes, 1, "and a tap on it closes");
  m.unmount();
  const h = mount(React.createElement(BenchHost, { sheetOpen: true, onClose: () => {} }, React.createElement("canvas")));
  const host = h.host.all("[data-bench-host]")[0];
  assert.equal(host.className, "relative min-w-0 flex-1", "same box as release's bench host");
  assert.equal(host.childNodes[0].nodeName, "CANVAS", "children render inside");
  assert.equal(typeof propsOf(host).onPointerDownCapture, "function");
  assert.equal(typeof propsOf(host).onClickCapture, "function");
  h.unmount();
  const isTap = need().isSheetTap, px = need().SHEET_TAP_PX;
  assert.ok(isTap({ x: 0, y: 0 }, { x: px, y: 0 }) && !isTap({ x: 0, y: 0 }, { x: px + 1, y: 0 }) && !isTap(null, { x: 0, y: 0 }));
});

// Critic 2 #208 advisory (D4): the hold is phone-only. On desktop the Measure panel sits beside the bench, so a
// press on the canvas must keep the bench's own events on (select, place, drag) and never close or swallow anything.
test("desktop, Measure panel open: a press on the canvas leaves the bench's events on and is the bench's", () => {
  const { BenchHost } = need();
  phoneWidth = false;
  const rig = benchRig();
  let closes = 0, stopped = 0;
  const m = mount(React.createElement(BenchHost, { sheetOpen: true, onClose: () => closes++ }, null));
  const h = propsOf(m.host.all("[data-bench-host]")[0]);
  for (const dx of [0, 3, 40]) {
    h.onPointerDownCapture({ target: rig.canvas, clientX: 100, clientY: 100 });
    assert.ok(rig.on(), `desktop: the bench's events stay on (press moved ${dx} px)`);
    h.onClickCapture({ target: rig.canvas, clientX: 100 + dx, clientY: 100, stopPropagation: () => { stopped++; } });
  }
  assert.equal(closes, 0, "desktop: a tap on the bench never closes the side panel");
  assert.equal(stopped, 0, "desktop: the bench gets its own click");
  m.unmount();
  rig.dispose();
  phoneWidth = true;
});

// Pin (Critic 2 #208 advisory): measure-sheet-gap.ts reaches the bench's event store through react-three-fiber's
// `_roots`, an underscore export that is not public API. This uses r3f's own createRoot (no renderer: configure is
// never called), so if an upgrade renames `_roots`, changes its key or drops `setEvents`, this goes red, instead of
// closing taps quietly placing and selecting parts on the bench again.
test("pin: r3f's _roots still maps a canvas to its store, and the open phone sheet switches that store's events off", async () => {
  const fiber = await import("@react-three/fiber");
  assert.ok(fiber._roots instanceof Map, "@react-three/fiber still exports _roots as a Map");
  const { BenchHost } = need();
  phoneWidth = true;
  const canvas = Object.assign(doc.createElement("canvas"), { closest: (s: string) => (s === "canvas" ? canvas : null) });
  fiber.createRoot(canvas as never);
  const store = fiber._roots.get(canvas as never)?.store;
  assert.ok(store, "createRoot registers the canvas in _roots");
  store.setState({ gl: {} as never }); // no WebGL here: r3f's invalidate reads gl.xr on every store change
  const enabled = () => store.getState().events.enabled;
  assert.equal(enabled(), true, "r3f starts with events on");
  const m = mount(React.createElement(BenchHost, { sheetOpen: true, onClose: () => {} }, null));
  propsOf(m.host.all("[data-bench-host]")[0]).onPointerDownCapture({ target: canvas, clientX: 0, clientY: 0 });
  assert.equal(enabled(), false, "a press with the sheet open turns the real store's events off");
  m.render(React.createElement(BenchHost, { sheetOpen: false, onClose: () => {} }, null));
  assert.equal(enabled(), true, "closing the sheet turns them back on");
  m.unmount();
  fiber._roots.delete(canvas as never);
});
