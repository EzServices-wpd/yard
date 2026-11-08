// PR A: a stock or thickness switch keeps open doors / drawers / lids open (seamless switching), and never turns
// Operate on for a build with none. Renders the real Measure panel and presses its Stock buttons.
import { test } from "node:test";
import assert from "node:assert/strict";

class N {
  childNodes: N[] = []; parentNode: N | null = null; attrs = new Map<string, string>(); style: Record<string, unknown> = { setProperty() {} };
  namespaceURI = "http://www.w3.org/1999/xhtml";
  constructor(public nodeType: number, public nodeName: string, public ownerDocument: unknown) {}
  addEventListener() {} removeEventListener() {}
  get tagName() { return this.nodeName; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get options() { return this.childNodes; }
  appendChild(c: N) { c.parentNode?.removeChild(c); this.childNodes.push(c); c.parentNode = this; return c; }
  insertBefore(c: N, r: N | null) { if (!r) return this.appendChild(c); c.parentNode?.removeChild(c); this.childNodes.splice(this.childNodes.indexOf(r), 0, c); c.parentNode = this; return c; }
  removeChild(c: N) { this.childNodes.splice(this.childNodes.indexOf(c), 1); c.parentNode = null; return c; }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  set textContent(_: string) { this.childNodes = []; }
  all(k: string): N[] { return this.childNodes.flatMap((c) => [...(c.attrs.has(k) ? [c] : []), ...c.all(k)]); }
}
const doc = Object.assign(new N(9, "#document", null), { createElement: (t: string) => new N(1, t.toUpperCase(), doc), createElementNS: (_: string, t: string) => new N(1, t.toUpperCase(), doc), createTextNode: () => new N(3, "#text", doc) });
doc.ownerDocument = doc;
Object.assign(globalThis, { document: doc, window: Object.assign(globalThis, { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }), HTMLElement: N, HTMLIFrameElement: class {}, IS_REACT_ACT_ENVIRONMENT: true, location: new URL("http://localhost/workspace") });

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { useYard } = await import("../src/lib/yard/store");
const { MeasurePanel } = await import("../src/components/workspace/measure-panel");
const { hasOperableFaces, operateFaceKinds } = await import("../src/lib/yard/operateFaces");
const press = (n: N | undefined) => { assert.ok(n, "button rendered"); const k = Object.keys(n).find((x) => x.startsWith("__reactProps"))!; React.act(() => (n as unknown as Record<string, { onClick: () => void }>)[k].onClick()); };

function switchAll(prompt: string, open: boolean) {
  useYard.getState().generate(prompt);
  useYard.getState().setFacesOpen(open);
  const host = doc.appendChild(doc.createElement("div"));
  const root = createRoot(host as unknown as HTMLElement);
  React.act(() => root.render(React.createElement(MeasurePanel, { onBuilt() {} })));
  press(host.all("data-yard-measure-tab").find((b) => b.getAttribute("data-yard-measure-tab") === "stock"));
  const out: { id: string; open: boolean; faces: boolean }[] = [];
  for (const attr of ["data-yard-thickness", "data-yard-stock"]) for (const b of host.all(attr)) {
    if (b.getAttribute(attr) === useYard.getState().project.primaryMaterialId) continue;
    press(b);
    out.push({ id: `${attr}=${b.getAttribute(attr)}`, open: useYard.getState().facesOpen, faces: hasOperableFaces(operateFaceKinds(useYard.getState().project.panels)) });
    useYard.getState().setFacesOpen(open);
  }
  React.act(() => root.unmount());
  return out;
}

test("closet with its doors open: every stock and thickness switch keeps them open", () => {
  const runs = switchAll("linen closet 31.5 wide 78 tall 16 deep", true);
  assert.ok(runs.length >= 2, `switched at least twice (${runs.length})`);
  for (const r of runs) assert.equal(r.open, r.faces, `${r.id}: open exactly when the new build still has faces`);
  assert.ok(runs.some((r) => r.open), "at least one switch kept the doors open");
});

test("doors shut, or a build with none: a switch leaves Operate off", () => {
  for (const r of switchAll("linen closet 31.5 wide 78 tall 16 deep", false)) assert.equal(r.open, false, `${r.id}: shut stays shut`);
  const bare = switchAll("bookcase 36 wide 72 tall 12 deep", true);
  assert.ok(bare.length >= 1);
  for (const r of bare) { assert.equal(r.faces, false, `${r.id}: the bookcase has no doors`); assert.equal(r.open, false, `${r.id}: never open with no faces`); }
});
