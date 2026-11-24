// GET /api/feedback lists the notes POST stores. The critic secret gates it. A miss is an empty 404
// from request middleware (not the app shell, not 406), and no public page reads the list.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SECRET = `${"c".repeat(24)}Marker9f3a`;
const NOTE = "zzprivnote9f3a";
process.env.KV_REST_API_URL = "https://store.test";
process.env.KV_REST_API_TOKEN = "t".repeat(24);
process.env.CRITIC_REVIEW_SECRET = SECRET;

const kv = new Map<string, any>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (!String(url).startsWith("https://store.test/pipeline")) return realFetch(url, init);
  const cmds = JSON.parse(String(init?.body)) as any[][];
  return Response.json(cmds.map((c) => ({ result: exec(c) })));
}) as typeof fetch;
const exec = (c: any[]) => { const [op, k, ...a] = c;
  if (op === "INCRBY") { kv.set(k, (kv.get(k) ?? 0) + Number(a[0])); return kv.get(k); }
  if (op === "INCR") { kv.set(k, (kv.get(k) ?? 0) + 1); return kv.get(k); }
  if (op === "EXPIRE") return 1;
  if (op === "LPUSH") { const l = kv.get(k) ?? []; l.unshift(a[0]); kv.set(k, l); return l.length; }
  if (op === "LTRIM") { const l = kv.get(k) ?? []; const at = (i: number) => i < 0 ? l.length + i : i; kv.set(k, l.slice(Math.max(0, at(Number(a[0]))), Math.max(0, at(Number(a[1])) + 1))); return "OK"; }
  if (op === "LRANGE") { const l = kv.get(k) ?? []; const at = (i: number) => Math.max(0, i < 0 ? l.length + i : i); return l.slice(at(Number(a[0])), at(Number(a[1])) + 1); }
  if (op === "GET") return kv.get(k) ?? null;
  return null;
};
const logs: string[] = [];
for (const m of ["log", "info", "warn", "error", "debug"] as const) {
  const orig = console[m].bind(console);
  console[m] = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); orig(...args); };
}
const env = { CRITIC_REVIEW_SECRET: SECRET };
const bearer = { authorization: `Bearer ${SECRET}` };
const walk = (dir: string) => (fs.readdirSync(dir, { recursive: true }) as string[]).map((n) => `${dir}/${n}`).filter((p) => /\.tsx?$/.test(p));

async function miss(res: Response | null, label: string) {
  assert.ok(res, label);
  assert.equal(res!.status, 404, label);
  assert.equal(res!.headers.get("cache-control"), "no-store", label);
  assert.equal(res!.headers.get("content-type"), null, label);
  const body = await res!.text();
  assert.equal(body, "", label);
  assert.doesNotMatch(body, /[{[]|html|Marker9f3a|zzprivnote/i, label);
}

test("unauthenticated and wrong secret: empty 404; the right secret lists notes newest first; POST still writes", async () => {
  const { secretRoute } = await import("../src/lib/server/secretRoutes");
  const { feedbackReadHandler } = await import("../src/lib/server/feedbackReadHandler");
  const gate = (auth?: string, headers: Record<string, string> = {}) => secretRoute(new Request(`https://yard.test/api/feedback?secret=${SECRET}&access_token=${SECRET}`, { headers: { ...headers, ...(auth ? { authorization: auth } : {}) } }), "/api/feedback", env);
  for (const auth of [undefined, "", "Bearer ", "Bearer wrong", `Bearer ${SECRET.slice(0, -1)}`, `Bearer ${SECRET}x`, SECRET, `Basic ${SECRET}`, `bearer ${SECRET}`]) {
    await miss(await gate(auth, { accept: "application/json" }), `json ${auth ?? "none"}`);
    await miss(await gate(auth, { accept: "text/html" }), `html ${auth ?? "none"}`);
  }
  await miss(await secretRoute(new Request("https://yard.test/api/feedback", { method: "HEAD" }), "/api/feedback", env), "HEAD");
  await miss(await secretRoute(new Request("https://yard.test/api/feedback", { headers: bearer }), "/api/feedback", {}), "env unset");
  await miss(await secretRoute(new Request("https://yard.test/api/feedback", { headers: { authorization: "Bearer short" } }), "/api/feedback", { CRITIC_REVIEW_SECRET: "short" }), "short");
  assert.equal(await secretRoute(new Request("https://yard.test/api/feedback", { method: "POST", headers: bearer, body: "{}" }), "/api/feedback", env), null, "POST falls through");
  assert.equal(await secretRoute(new Request("https://yard.test/api/feedback", { method: "POST", body: "{}" }), "/api/feedback", env), null);

  const old = "2026-11-01T00:00:00.000Z", mid = "2026-11-20T00:00:00.000Z", neu = "2026-11-23T12:00:00.000Z";
  const row = (at: string, note: string) => JSON.stringify({ prompt: "bookcase", size: "30x12", partCount: 4, chips: ["other"], note, tip: "local", at });
  for (const rec of [row(old, "older note"), row(mid, NOTE), row(neu, "newest note")]) await fetch("https://store.test/pipeline", { method: "POST", body: JSON.stringify([["LPUSH", "feedback:list", rec]]) });
  const ok = (await gate(`Bearer ${SECRET}`, { accept: "application/json" }))!;
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.match(ok.headers.get("content-type") ?? "", /application\/json/);
  const listed = (await ok.json()) as { rows: { note: string; at: string }[] };
  assert.deepEqual(listed.rows.map((r) => r.note), ["newest note", NOTE, "older note"]);
  assert.doesNotMatch(JSON.stringify(listed), /Marker9f3a|cid/);
  const notes = async (url: string) => ((await (await feedbackReadHandler(new Request(url, { headers: bearer }), env))!.json()) as { rows: { note: string; at: string }[] }).rows;
  assert.deepEqual((await notes("https://yard.test/api/feedback?limit=1")).map((r) => r.note), ["newest note"]);
  assert.deepEqual((await notes(`https://yard.test/api/feedback?since=${mid}&limit=10`)).map((r) => r.at), [neu], "since is exclusive");
  assert.equal((await feedbackReadHandler(new Request("https://yard.test/api/feedback?since=yesterday", { headers: bearer }), env))!.status, 400);
  assert.equal((await feedbackReadHandler(new Request("https://yard.test/api/feedback?limit=0", { headers: bearer }), env))!.status, 400);

  const { Route } = (await import("../src/routes/api/feedback")) as { Route: { options: { server: { handlers: { GET: (c: { request: Request }) => Promise<Response>; POST: (c: { request: Request }) => Promise<Response> } } } } };
  await miss(await Route.options.server.handlers.GET({ request: new Request("https://yard.test/api/feedback", { headers: { accept: "application/json" } }) }), "route GET");
  const posted = await Route.options.server.handlers.POST({ request: new Request("https://yard.test/api/feedback", { method: "POST", body: JSON.stringify({ chips: ["other"], note: "shelf sits low" }) }) });
  assert.equal(posted.status, 204);
  assert.equal(posted.headers.get("cache-control"), "no-store");
  assert.equal((await notes("https://yard.test/api/feedback?limit=1"))[0].note, "shelf sits low");
  assert.equal((await Route.options.server.handlers.POST({ request: new Request("https://yard.test/api/feedback", { method: "POST", body: "{}" }) })).status, 400);
  assert.ok(!logs.some((l) => l.includes("Marker9f3a")), "the secret is never logged");
});

test("newest first follows at, not the order the notes were stored", async () => {
  const { feedbackReadHandler } = await import("../src/lib/server/feedbackReadHandler");
  const row = (at: string, note: string) => JSON.stringify({ prompt: "bookcase", size: "30x12", partCount: 4, chips: ["other"], note, tip: "local", at });
  // LPUSH leaves the last write at the front, so the store order is mid, early, late.
  for (const rec of [row("2026-12-01T00:00:00.000Z", "sort-late"), row("2026-01-01T00:00:00.000Z", "sort-early"), row("2026-06-01T00:00:00.000Z", "sort-mid")])
    await fetch("https://store.test/pipeline", { method: "POST", body: JSON.stringify([["LPUSH", "feedback:list", rec]]) });
  const res = (await feedbackReadHandler(new Request("https://yard.test/api/feedback?limit=50", { headers: bearer }), env))!;
  assert.equal(res.status, 200);
  const notes = ((await res.json()) as { rows: { note: string }[] }).rows.map((r) => r.note).filter((n) => n.startsWith("sort-"));
  assert.deepEqual(notes, ["sort-late", "sort-mid", "sort-early"]);
});

test("a well-formed impossible since is 400 after the secret check, and the same empty 404 without it", async () => {
  const { feedbackReadHandler } = await import("../src/lib/server/feedbackReadHandler");
  const bad = "2026-13-45T99:99:99Z";
  for (const auth of [undefined, "Bearer nope"]) {
    const open = (await feedbackReadHandler(new Request(`https://yard.test/api/feedback?since=${bad}`, { headers: auth ? { authorization: auth } : {} }), env))!;
    assert.equal(open.status, 404, auth ?? "none");
    assert.equal(open.headers.get("cache-control"), "no-store");
    assert.equal(open.headers.get("content-type"), null);
    assert.equal(await open.text(), "");
  }
  const res = (await feedbackReadHandler(new Request(`https://yard.test/api/feedback?since=${bad}`, { headers: bearer }), env))!;
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.text();
  assert.equal(body, JSON.stringify({ error: "since" }));
  assert.equal(body.includes("13") || body.includes("99"), false);
  assert.equal((await feedbackReadHandler(new Request("https://yard.test/api/feedback?since=2026-02-31T00:00:00.000Z", { headers: bearer }), env))!.status, 400);
  assert.equal((await feedbackReadHandler(new Request("https://yard.test/api/feedback?since=2026-11-01T00:00:00.000Z", { headers: bearer }), env))!.status, 200);
});

test("the list is not on any public page or public API", async () => {
  for (const p of [...walk("src/routes"), ...walk("src/components")]) {
    if (p === "src/routes/api/feedback.ts") continue;
    const text = fs.readFileSync(p, "utf8");
    assert.doesNotMatch(text, /listFeedback|feedbackReadHandler|feedback:list/, p);
    if (text.includes("/api/feedback")) { assert.match(text, /method:\s*"POST"/, p); assert.doesNotMatch(text, /method:\s*"GET"/, p); }
  }
  const route = fs.readFileSync("src/routes/api/feedback.ts", "utf8");
  assert.doesNotMatch(route.slice(route.indexOf("POST:")), /authorization|authorised|CRITIC_REVIEW/);
  const load = async (f: string) => ((await import(f)) as { Route: { options: { server: { handlers: { GET: (c: { request: Request }) => Promise<Response> } } } } }).Route;
  for (const f of ["../src/routes/api/ideas", "../src/routes/api/ideas-snapshot"]) {
    const body = await (await (await load(f)).options.server.handlers.GET({ request: new Request("https://yard.test/x") })).text();
    assert.equal(body.includes(NOTE), false, f);
  }
});

test("the read reuses the critic secret's constant-time check and does not take the secret from the query", () => {
  const src = fs.readFileSync("src/lib/server/secretRoutes.ts", "utf8") + fs.readFileSync("src/lib/server/feedbackReadHandler.ts", "utf8");
  assert.match(src, /timingSafeEqual\(got, want\) && valid/);
  assert.ok(src.indexOf("authorised(") < src.indexOf("entry.load()"));
  assert.match(src, /\/api\/feedback/);
  assert.match(src, /CRITIC_REVIEW_SECRET/);
  assert.doesNotMatch(fs.readFileSync("src/lib/server/feedbackReadHandler.ts", "utf8"), /console\./);
  assert.doesNotMatch(src, /searchParams\.get\(["'](?:secret|token|authorization|access_token)["']\)/);
  assert.doesNotMatch(src, /\b401\b|\b403\b/);
});
