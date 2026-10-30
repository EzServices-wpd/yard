// #206 follow-up (Critic 2): render the phone Measure sheet's card and dismiss hook for real (react-dom into a tiny
// DOM), so the gap store turning on at open and resetting at close, the 390 fit with the rendered card, Escape with
// focus return, and tap-vs-drag on the bench are all checked against what the components do, not their source text.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

test("bench presses: a tap on the canvas closes the sheet; a drag (orbit) and taps off the canvas do not", () => {
  const { useMeasureSheetDismiss, isSheetTap, SHEET_TAP_PX } = need();
  let h: ReturnType<typeof useMeasureSheetDismiss> | null = null, closes = 0;
  const Probe = ({ open }: { open: boolean }) => { h = useMeasureSheetDismiss(open, () => closes++); return null; };
  const m = mount(React.createElement(Probe, { open: true }));
  const canvas = { closest: (s: string) => (s === "canvas" ? {} : null) }, chip = { closest: () => null };
  let stopped = 0;
  const press = (target: object, dx: number) => {
    h!.onPointerDownCapture({ clientX: 100, clientY: 100 } as never);
    h!.onClickCapture({ target, clientX: 100 + dx, clientY: 100, stopPropagation: () => stopped++ } as never);
  };
  press(canvas, 40);
  assert.equal(closes, 0, "a drag on the model orbits; the sheet stays");
  assert.equal(stopped, 0, "and the click goes on to the canvas");
  press(chip, 0);
  assert.equal(closes, 0, "a tap on a bench button is that button's");
  press(canvas, 2);
  assert.equal(closes, 1, "a tap on the canvas closes, as the old backdrop did");
  assert.equal(stopped, 1, "and selects nothing");
  m.render(React.createElement(Probe, { open: false }));
  press(canvas, 0);
  assert.equal(closes, 1, "sheet closed: taps are the canvas's");
  m.unmount();
  assert.ok(isSheetTap({ x: 0, y: 0 }, { x: SHEET_TAP_PX, y: 0 }) && !isSheetTap({ x: 0, y: 0 }, { x: SHEET_TAP_PX + 1, y: 0 }) && !isSheetTap(null, { x: 0, y: 0 }));
});

test("shell: the measure backdrop no longer takes presses, and the bench host carries the dismiss handlers", () => {
  const shell = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../src/components/workspace/shell.tsx"), "utf8");
  assert.match(shell, /side === "measure" \? "pointer-events-none inset-x-0 top-0 h-\[50vh\] bg-transparent"/);
  assert.match(shell, /useMeasureSheetDismiss\(side === "measure", closeSide\)/);
  assert.match(shell, /data-bench-host \{\.\.\.sheetDismiss\}>/);
});
