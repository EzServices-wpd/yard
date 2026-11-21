// The thumbs control posts the build's own id. Up is {bid, ev:"thumb", up:true}; down is up:false.
// Clicking the rendered buttons and reading the POST is the seam: a click that sends nothing, or a
// down click that sends up:true, fails this test.
import { test } from "node:test";
import assert from "node:assert/strict";

class N {
  childNodes: N[] = [];
  parentNode: N | null = null;
  attrs = new Map<string, string>();
  style: Record<string, unknown> = { setProperty() {} };
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
  hasAttribute(k: string) {
    return this.attrs.has(k);
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
  showModal() {}
  close() {}
  all(k: string): N[] {
    return this.childNodes.flatMap((c) => [...(c.attrs.has(k) ? [c] : []), ...c.all(k)]);
  }
}
class Doc extends N {
  documentElement: N;
  body: N;
  activeElement: N;
  defaultView = globalThis;
  constructor() {
    super(9, "#document", null);
    this.documentElement = this.appendChild(new N(1, "HTML", this));
    this.body = this.documentElement.appendChild(new N(1, "BODY", this));
    this.activeElement = this.body;
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
}
const doc = new Doc();
function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}
const session = memStore();
const local = memStore();
type Posted = { url: string; method: string; body: { bid?: string; ev?: string; up?: boolean } };
const posted: Posted[] = [];
const loc = {
  hostname: "yard.wiki",
  search: "?q=pine+bench",
  href: "https://yard.wiki/workspace?q=pine+bench",
};
Object.assign(globalThis, {
  document: doc,
  location: loc,
  window: globalThis,
  sessionStorage: session,
  localStorage: local,
  HTMLElement: N,
  HTMLIFrameElement: class {},
  IS_REACT_ACT_ENVIRONMENT: true,
  fetch: (url: string, init?: { method?: string; body?: string }) => {
    posted.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: JSON.parse(init?.body ?? "null"),
    });
    return Promise.resolve(new Response(null, { status: 204 }));
  },
});

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { useYard } = await import("../src/lib/yard/store");
const { emptyProject } = await import("../src/lib/yard/prompt");
const { buildIdOf } = await import("../src/lib/feedback/buildId");
const { ShopFeedback, THUMBS } = await import("../src/components/workspace/shop-feedback");

const project = {
  ...emptyProject(),
  prompt: "pine bench 48 wide",
  primaryMaterialId: "pine-1x4",
  overall: { width: 48, height: 18, depth: 12 },
};
// The control renders only when a plan exists. The thumb body does not include the plan.
useYard.setState({ project, plan: { totals: { pieces: 0, estCostUsd: 0 } } as never });
const bid = buildIdOf(useYard.getState().project);

function clickThumb(label: string) {
  session.clear();
  posted.length = 0;
  const host = doc.body.appendChild(doc.createElement("div"));
  const root = createRoot(host as unknown as HTMLElement);
  act(() => root.render(React.createElement(ShopFeedback)));
  assert.ok(
    posted.some((p) => p.body?.ev === "build"),
    "the page is not test traffic; the build event posts",
  );
  const btn = host.all("aria-label").find((b) => b.getAttribute("aria-label") === label);
  assert.ok(btn, `${label} is on the page`);
  const key = Object.keys(btn).find((k) => k.startsWith("__reactProps"));
  assert.ok(key, "the button's click handler is on the node");
  const onClick = (btn as unknown as Record<string, { onClick?: () => void }>)[key].onClick;
  assert.equal(typeof onClick, "function");
  act(() => onClick!());
  const thumbs = posted.filter((p) => p.url === "/api/ev" && p.body?.ev === "thumb");
  act(() => root.unmount());
  doc.body.removeChild(host);
  assert.equal(
    thumbs.length,
    1,
    `${label} posts one thumb, got ${JSON.stringify(thumbs.map((p) => p.body))}`,
  );
  assert.equal(thumbs[0].method, "POST");
  return thumbs[0].body;
}

test("thumbs up posts {bid, ev:thumb, up:true} and thumbs down posts up:false", () => {
  assert.match(bid, /^b[0-9a-f]{15}$/);
  assert.equal(bid, buildIdOf(project));
  assert.deepEqual(clickThumb(THUMBS.upLabel), { bid, ev: "thumb", up: true });
  assert.deepEqual(clickThumb(THUMBS.downLabel), { bid, ev: "thumb", up: false });
});
