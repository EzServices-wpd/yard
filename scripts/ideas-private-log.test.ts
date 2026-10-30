// The nightly rank-errors run's private read of the Ideas query log (Chief 10-25, after #150): typed prompts reach only
// a caller with Bearer CRITIC_REVIEW_SECRET at /api/critic-review?op=snapshot (no-store); a missing or wrong secret
// is the app's not-found, and /api/ideas, /api/ideas-snapshot still carry no typed prompt from the same store.
// rank-errors reads the private source only with the secret and off GitHub Actions; otherwise the public snapshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

// A configured store (fake Upstash REST) holding a built snapshot with typed prompts. Set before any store module loads.
process.env.KV_REST_API_URL = "https://store.test";
process.env.KV_REST_API_TOKEN = "t".repeat(24);
const TYPED = ["3/4 pvc soccer goal 48 wide", "my nan's pine bird feeder 9 tall", "critic probe: bookcase 30 wide"];
const row = (prompt: string, resultKey: string, i: number): SnapshotRow => ({ key: `0000000${i}`, prompt, size: "48×24×36", resultKey, status: "Trusted", count: 3, lastSeen: new Date().toISOString(), at: new Date().toISOString(), source: "live" });
const rows = [row(TYPED[0], "builtin:soccer-goal", 1), row(TYPED[1], "builtin:bird-feeder", 2), row(TYPED[2], "builtin:bookcase", 3)];
const RAW: IdeasSnapshot = { at: new Date().toISOString(), live: true, rows, popular: rows, recent: rows };
let storeReads = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (!String(url).startsWith("https://store.test/pipeline")) return realFetch(url, init);
  const cmds = JSON.parse(String(init?.body)) as (string | number)[][];
  return Response.json(cmds.map(([c, k]) => ({ result: c === "GET" && k === "ideas:snap" ? (storeReads++, JSON.stringify(RAW)) : c === "INCRBY" ? 1 : null })));
}) as typeof fetch;

const SECRET = "s".repeat(32);
const hit = async (auth?: string, env: Record<string, string | undefined> = { CRITIC_REVIEW_SECRET: SECRET }) => {
  const { secretRoute } = await import("../src/lib/server/secretRoutes");
  const req = new Request("https://yard.test/api/critic-review?op=snapshot", { headers: auth === undefined ? {} : { authorization: auth } });
  return secretRoute(req, "/api/critic-review", env);
};
const hasTyped = (body: string) => TYPED.filter((t) => body.toLowerCase().includes(t));

test("private read: only Bearer CRITIC_REVIEW_SECRET gets the typed prompts, no-store; anything else is the app's not-found with no data", async () => {
  for (const env of [undefined, "short", SECRET])
    for (const auth of [undefined, "", "Bearer ", "Bearer wrong", `Bearer ${SECRET.slice(1)}`, `Bearer ${SECRET}x`, SECRET, `Basic ${SECRET}`, `bearer ${SECRET}`])
      assert.equal(await hit(auth, { CRITIC_REVIEW_SECRET: env }), null, `env=${env} auth=${auth}: goes to the app (404), nothing answered here`);
  const ok = (await hit(`Bearer ${SECRET}`))!;
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal(ok.headers.get("access-control-allow-origin"), null, "no CORS");
  const got = (await ok.json()) as IdeasSnapshot;
  assert.deepEqual(got.rows.map((r) => r.prompt), TYPED, "the store's rows, typed prompts included");
  assert.ok(storeReads > 0, "read through the real store path");
});

test("public routes on the same store: /api/ideas and /api/ideas-snapshot carry no typed prompt (the page's loader builds the same liveFeed)", async () => {
  // The store these routes read (the shared instance) does hold the typed prompts: the check below is not vacuous.
  const { ideaStore } = await import("../src/lib/yard/ideaLog.server");
  assert.deepEqual((await ideaStore().served()).rows.map((r) => r.prompt), TYPED);
  const bodies: string[] = [];
  for (const f of ["../src/routes/api/ideas-snapshot.ts", "../src/routes/api/ideas.ts"]) {
    const { Route } = (await import(f)) as { Route: { options: { server: { handlers: { GET: (c: { request: Request }) => Promise<Response> } } } } };
    const res = await Route.options.server.handlers.GET({ request: new Request("https://yard.test/x") });
    const body = await res.text();
    bodies.push(body);
    assert.deepEqual(hasTyped(body), [], `${f} serves a typed prompt`);
    assert.doesNotMatch(res.headers.get("cache-control") ?? "", /no-store/, `${f} is the public, cached route`);
  }
  assert.match(bodies[0], /"buildType":"soccer-goal"/, "the public snapshot served the same rows, by build type");
});

test("rank-errors: private typed prompts with the secret (probes dropped); public card builds without it, on Actions, or on a bad answer", async () => {
  const { liveIdeas } = await import("./rank-errors");
  const pub = { live: true, rows: [{ buildType: "soccer-goal", size: "48×24×36" }, { buildType: "bookcase", size: "30×12×72", source: "critic probe" }] };
  const calls: { url: string; auth: string | null }[] = [];
  const site = (priv: () => Response) => (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, auth: new Headers(init?.headers).get("authorization") });
    return u.includes("/api/critic-review") ? priv() : Response.json(pub);
  }) as typeof fetch;
  const good = () => Response.json(RAW);
  const p = await liveIdeas({ CRITIC_REVIEW_SECRET: SECRET }, site(good), "https://yard.test");
  assert.equal(p.source, "private");
  assert.deepEqual(p.prompts, TYPED.slice(0, 2), "typed wording kept, the critic probe dropped");
  assert.equal(calls[0].auth, `Bearer ${SECRET}`);
  assert.doesNotMatch(p.note, new RegExp(SECRET), "the secret is never in the note");
  for (const [env, priv, why] of [
    [{}, good, /no CRITIC_REVIEW_SECRET/],
    [{ CRITIC_REVIEW_SECRET: SECRET, GITHUB_ACTIONS: "true" }, good, /not on GitHub Actions/],
    [{ CRITIC_REVIEW_SECRET: "wrong" }, () => new Response("<!DOCTYPE html>not found", { status: 404 }), /private read got 404/],
    [{ CRITIC_REVIEW_SECRET: SECRET }, () => { throw new TypeError("offline"); }, /private read failed/],
  ] as const) {
    calls.length = 0;
    const f = await liveIdeas(env, site(priv), "https://yard.test");
    assert.equal(f.source, "public", JSON.stringify(env));
    assert.match(f.note, why);
    assert.deepEqual(hasTyped(f.prompts.join("\n")), [], "no typed prompt in the fallback");
    assert.equal(f.prompts.length, 1, "one card build (the probe row dropped)");
    if ("GITHUB_ACTIONS" in env || !("CRITIC_REVIEW_SECRET" in env)) assert.ok(calls.every((c) => !c.url.includes("critic-review") && c.auth === null), "the private route is never called");
  }
});

test("rank-errors: dated reports past the store's RETAIN_DAYS are deleted (a private run's Examples hold typed words); latest and newer ones stay", async () => {
  const { staleReports } = await import("./rank-errors");
  const { RETAIN_DAYS } = await import("../src/lib/yard/ideaLog.server");
  assert.equal(RETAIN_DAYS, 85);
  const now = new Date("2027-01-20T08:17:00Z"); // 03:17 in New York, Jan 20; 85 days earlier is Oct 27
  const names = ["yard-errors-ranked-2026-10-16.md", "yard-errors-ranked-2026-10-26.md", "yard-errors-ranked-2026-10-27.md", "yard-errors-ranked-2027-01-19.md", "yard-errors-ranked-latest.md", "notes.md"];
  assert.deepEqual(staleReports(names, now), ["yard-errors-ranked-2026-10-16.md", "yard-errors-ranked-2026-10-26.md"]);
});
