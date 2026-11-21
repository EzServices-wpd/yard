// Vercel Analytics must not count a test walk. The injection uses eventPageQuiet, the same rule as /api/ev:
// offline=1, local=1 and test=1 skip; a normal yard.wiki page still injects the script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class N {
  childNodes: N[] = [];
  parentNode: N | null = null;
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, unknown> = { setProperty() {} };
  defer = false;
  src = "";
  namespaceURI = "http://www.w3.org/1999/xhtml";
  constructor(
    public nodeType: number,
    public nodeName: string,
    public ownerDocument: Doc | null,
  ) {}
  get tagName() {
    return this.nodeName;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get isConnected() {
    return this.nodeType === 9 || (this.parentNode?.isConnected ?? false);
  }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c: N) {
    c.parentNode?.removeChild(c);
    this.childNodes.push(c);
    c.parentNode = this;
    return c;
  }
  insertBefore(c: N, r: N | null) {
    if (!r) return this.appendChild(c);
    c.parentNode?.removeChild(c);
    this.childNodes.splice(this.childNodes.indexOf(r), 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c: N) {
    this.childNodes.splice(this.childNodes.indexOf(c), 1);
    c.parentNode = null;
    return c;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, String(v));
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  set textContent(_: string) {
    this.childNodes = [];
  }
  set className(v: string) {
    this.attrs.set("class", v);
  }
  get className() {
    return this.attrs.get("class") ?? "";
  }
  focus() {}
}
class Doc extends N {
  documentElement: N;
  head: N;
  body: N;
  constructor() {
    super(9, "#document", null);
    this.documentElement = this.appendChild(new N(1, "HTML", this));
    this.head = this.documentElement.appendChild(new N(1, "HEAD", this));
    this.body = this.documentElement.appendChild(new N(1, "BODY", this));
  }
  createElement(t: string) {
    return new N(1, t.toUpperCase(), this);
  }
  createElementNS(_: string, t: string) {
    return this.createElement(t);
  }
  createTextNode(t: string) {
    const n = new N(3, "#text", this);
    (n as unknown as { nodeValue: string }).nodeValue = t;
    return n;
  }
  querySelector(sel: string): N | null {
    if (sel !== "script[data-yard-va]") return null;
    const all: N[] = [];
    const walk = (n: N) => {
      all.push(n);
      n.childNodes.forEach(walk);
    };
    walk(this);
    return all.find((n) => n.nodeName === "SCRIPT" && n.dataset.yardVa) ?? null;
  }
}
const doc = new Doc();
const loc = { hostname: "yard.wiki", search: "" };
Object.assign(globalThis, {
  document: doc,
  location: loc,
  window: globalThis,
  HTMLElement: N,
  HTMLIFrameElement: class {},
  IS_REACT_ACT_ENVIRONMENT: true,
});

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { VercelAnalytics } = await import("../src/components/site/vercel-analytics");

function scripts() {
  return doc.head.childNodes.filter((n) => n.nodeName === "SCRIPT");
}
function load(search: string, hostname = "yard.wiki") {
  doc.head.childNodes.slice().forEach((n) => doc.head.removeChild(n));
  loc.search = search;
  loc.hostname = hostname;
  const host = doc.body.appendChild(doc.createElement("div"));
  const root = createRoot(host as unknown as HTMLElement);
  act(() => root.render(React.createElement(VercelAnalytics)));
  const got = scripts().map((s) => ({ src: s.src, yardVa: s.dataset.yardVa, defer: s.defer }));
  act(() => root.unmount());
  doc.body.removeChild(host);
  return got;
}

test("the root route is what injects Vercel Analytics", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /<VercelAnalytics \/>/);
});

test("offline=1, local=1 and test=1 skip Vercel Analytics; a normal page injects it", () => {
  for (const search of [
    "?offline=1",
    "?local=1",
    "?test=1",
    "?q=linen&offline=1",
    "?q=linen&local=1",
    "?q=linen&test=1",
  ]) {
    assert.deepEqual(load(search), [], search);
  }
  // =1 only, and only as its own parameter: the same boundaries as eventPageQuiet.
  for (const search of ["?q=linen", "?offline=10", "?offline=1extra", "?q=test=1", ""]) {
    assert.deepEqual(
      load(search),
      [{ src: "/_vercel/insights/script.js", yardVa: "1", defer: true }],
      search,
    );
  }
  assert.deepEqual(
    load("?q=linen", "localhost"),
    [],
    "a non-production host still does not inject",
  );
  const once = load("?q=linen");
  loc.search = "?q=linen";
  const host = doc.body.appendChild(doc.createElement("div"));
  const root = createRoot(host as unknown as HTMLElement);
  act(() => root.render(React.createElement(VercelAnalytics)));
  assert.equal(scripts().length, once.length, "a second mount does not add a second script");
  act(() => root.unmount());
  doc.body.removeChild(host);
});
