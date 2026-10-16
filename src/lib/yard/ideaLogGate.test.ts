import assert from "node:assert/strict";
import test from "node:test";
import { isTestPage, testTrafficReason } from "./ideaLogGate.ts";
import { handleIdeasLog } from "./ideaLogHandler.ts";
import type { LogRecord } from "./ideaLog.ts";

function harness(env: Record<string, string | undefined> = { VERCEL_ENV: "production" }) {
  const writes: LogRecord[] = [];
  const deps = {
    env,
    recordFromPrompt: async (p: string, failed: boolean) => ({ prompt: p, failed } as unknown as LogRecord),
    store: () => ({ record: async (r: LogRecord) => { writes.push(r); } }),
  };
  return { writes, post: (url: string, headers: Record<string, string> = {}) =>
    handleIdeasLog(new Request(url, { method: "POST", body: JSON.stringify({ prompt: "linen closet" }), headers }), deps) };
}
const URL0 = "https://yard.wiki/api/ideas-log";

test("real production request still logs exactly once", async () => {
  const h = harness();
  const r = await h.post(URL0, { referer: "https://yard.wiki/" });
  assert.equal(r.status, 204);
  assert.equal(h.writes.length, 1);
});

test("test markers drop the write but still answer 204", async () => {
  const cases: [string, Record<string, string>, Record<string, string | undefined>?][] = [
    [URL0, { "x-yard-test": "1" }],
    [URL0, { "x-yard-test": "critic" }],
    [`${URL0}?test=1`, {}],
    [`${URL0}?offline=1`, {}],
    [URL0, { referer: "https://yard.wiki/?offline=1&p=linen" }],
    [URL0, { referer: "https://yard.wiki/?p=x&local=1" }],
    [URL0, {}, { VERCEL_ENV: "preview" }],
    [URL0, {}, { VERCEL_ENV: "development" }],
  ];
  for (const [url, headers, env] of cases) {
    const h = harness(env ?? { VERCEL_ENV: "production" });
    const r = await h.post(url, headers);
    assert.equal(r.status, 204, url);
    assert.equal(h.writes.length, 0, `${url} ${JSON.stringify(headers)} ${JSON.stringify(env)}`);
  }
});

test("lookalike params are not markers", () => {
  const req = (url: string, ref = "") => ({ url, headers: { get: (n: string) => (n === "referer" ? ref || null : null) } });
  assert.equal(testTrafficReason(req(`${URL0}?offline=10`), {}), null);
  assert.equal(testTrafficReason(req(URL0, "https://yard.wiki/?p=test=1"), {}), null);
  assert.equal(testTrafficReason(req(URL0), {}), null);
});

test("client: offline=1 / local=1 pages never send", async () => {
  assert.ok(isTestPage("?offline=1"));
  assert.ok(isTestPage("?p=linen&local=1"));
  assert.ok(!isTestPage("?p=linen"));
  const sent: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const nav = { sendBeacon: (u: string) => { sent.push(u); return true; } };
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
  g.fetch = async (u: string) => { sent.push(u); return new Response(null); };
  const { logIdea } = await import("./ideaLogClient.ts");
  for (const [search, n] of [["?offline=1", 0], ["?local=1", 0], ["?p=linen", 1]] as const) {
    sent.length = 0;
    g.window = { location: { search }, setTimeout: undefined };
    logIdea("linen closet");
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal(sent.length, n, search);
  }
  delete g.window;
});
