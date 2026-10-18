// src/lib/ideas/testSession: ?test=1 sticks for the tab session; the run id is random per tab and lives in
// sessionStorage only (never localStorage, a cookie or anything that outlives the tab).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/** One browser tab: its own sessionStorage, plus spies on every longer-lived store. */
function tab(search: string) {
  const session = new Map<string, string>();
  const touched: string[] = [];
  const spyStore = (name: string) => new Proxy({}, { get: (_t, k) => { touched.push(`${name}.${String(k)}`); return () => null; } });
  const doc = {} as { cookie?: string };
  Object.defineProperty(doc, "cookie", { get: () => { touched.push("cookie:get"); return ""; }, set: () => { touched.push("cookie:set"); } });
  const win = {
    location: { search, href: `https://yard.wiki/${search}`, origin: "https://yard.wiki" },
    sessionStorage: { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => void session.set(k, v) },
    localStorage: spyStore("localStorage"),
    indexedDB: spyStore("indexedDB"),
    document: doc,
    fetch: async () => new Response(null, { status: 204 }),
  };
  return { win, session, touched, doc };
}

let n = 0;
/** A fresh copy of the module, as a new tab gets (no module state carried over). */
async function load(t: ReturnType<typeof tab>) {
  const g = globalThis as { window?: unknown; document?: unknown };
  g.window = t.win; g.document = t.doc;
  return (await import(`../src/lib/ideas/testSession.ts?tab=${++n}`)) as typeof import("../src/lib/ideas/testSession");
}
function done() { const g = globalThis as { window?: unknown; document?: unknown }; delete g.window; delete g.document; }

test("?test=1 sticks for the session: later pages in the tab without the flag are still a test run", async () => {
  const t = tab("?test=1");
  try {
    const ts = await load(t);
    ts.installTestHeader();
    for (const s of ["", "?q=bench", "?offline=0"]) { t.win.location.search = s; assert.equal(ts.sessionTest(), true, s || "(none)"); }
    assert.equal(t.session.get("yard:test"), "1");
    // A reload of the same tab (fresh module, same sessionStorage) still knows.
    const again = await load({ ...t, win: { ...t.win, location: { ...t.win.location, search: "" } } } as ReturnType<typeof tab>);
    assert.equal(again.sessionTest(), true, "survives a full load in the same tab");
    // A new tab without the flag is not a test run.
    const fresh = await load(tab("?q=bench"));
    fresh.installTestHeader();
    assert.equal(fresh.sessionTest(), false);
  } finally { done(); }
});

test("runId is random per tab, stable within a tab", async () => {
  try {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const t = tab("");
      const ts = await load(t);
      const id = ts.runId();
      assert.match(id, /^[a-f0-9]{16}$/);
      assert.equal(ts.runId(), id, "same id within the tab");
      assert.equal(t.session.get("yard:run"), id);
      ids.push(id);
    }
    assert.equal(new Set(ids).size, ids.length, "every tab gets its own id");
  } finally { done(); }
});

test("runId and the test flag never go beyond sessionStorage: no localStorage, IndexedDB or cookie", async () => {
  const t = tab("?test=1");
  try {
    const ts = await load(t);
    ts.installTestHeader();
    ts.sessionTest();
    ts.runId();
    await (t.win as { fetch: typeof fetch }).fetch("/api/ideas-snapshot");
    assert.deepEqual(t.touched, [], "nothing but sessionStorage was used");
    assert.deepEqual([...t.session.keys()].sort(), ["yard:run", "yard:test"]);
  } finally { done(); }
  const strip = (f: string) => fs.readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  for (const f of ["src/lib/ideas/testSession.ts", "src/lib/yard/ideaLogClient.ts"])
    assert.doesNotMatch(strip(f), /localStorage|indexedDB|cookie|caches\.|serviceWorker/i, f);
});
