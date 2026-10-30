// The home strip ("People are making right now", Critic 2's #162 advisory): it renders at most 12 rows, so it asks
// /api/ideas?view=strip for just those rows instead of the whole feed (86 KB raw after #162's All ideas). Plain
// /api/ideas (and so the Ideas page's feed) is unchanged. Seam: the real route on a fake store holding the saved 10-25 snapshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";
import type { IdeasFeed } from "../src/lib/ideas/feed";
import LIVE from "./fixtures/ideas-snapshot-2026-10-25.json";

process.env.KV_REST_API_URL = "https://store.test";
process.env.KV_REST_API_TOKEN = "t".repeat(24);
type Pub = { at: string; live: boolean; rows: { buildType: string; recipe?: boolean; size: string; status: string; count: number; lastSeen: string }[]; popular: Pub["rows"]; recent: Pub["rows"] };
const PUB = LIVE as unknown as Pub;
const TYPED = "zq typed words nobody should see";
const rows = (rs: Pub["rows"]): SnapshotRow[] => rs.map((r, i) => ({ key: `p${i}`, prompt: `${TYPED} ${i}`, resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen }) as SnapshotRow);
const RAW: IdeasSnapshot = { ...PUB, at: new Date().toISOString(), rows: rows(PUB.rows), popular: rows(PUB.popular), recent: rows(PUB.recent) } as IdeasSnapshot;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (!String(url).startsWith("https://store.test/pipeline")) return realFetch(url, init);
  const cmds = JSON.parse(String(init?.body)) as (string | number)[][];
  return Response.json(cmds.map(([c, k]) => ({ result: c === "GET" && k === "ideas:snap" ? JSON.stringify(RAW) : c === "INCRBY" ? 1 : null })));
}) as typeof fetch;

const get = async (path: string) => {
  const { Route } = (await import("../src/routes/api/ideas")) as unknown as { Route: { options: { server: { handlers: { GET: (c: { request: Request }) => Promise<Response> } } } } };
  const res = await Route.options.server.handlers.GET({ request: new Request(`https://yard.test${path}`) });
  return { res, body: await res.text() };
};

test("?view=strip sends only the strip's rows: the same rows makingNow takes from the full feed, a small fraction of its bytes", async () => {
  const { makingNow, MAKING_NOW_MAX } = await import("../src/lib/ideas/liveFeed");
  const full = await get("/api/ideas");
  const strip = await get("/api/ideas?view=strip");
  const feed = JSON.parse(full.body) as IdeasFeed;
  assert.ok(feed.live && (feed.all?.length ?? 0) > 0, "the full feed is live and carries All ideas (the check is not vacuous)");
  const got = JSON.parse(strip.body) as { rows: unknown[] };
  assert.deepEqual(Object.keys(got), ["rows"], "no sections, no All ideas, no hero");
  assert.ok(got.rows.length > 0 && got.rows.length <= MAKING_NOW_MAX);
  assert.deepEqual(got.rows, makingNow(feed), "what the strip renders is unchanged");
  const gz = (s: string) => gzipSync(s).length;
  assert.ok(strip.body.length * 10 < full.body.length, `strip ${strip.body.length} B vs full ${full.body.length} B raw`);
  assert.ok(gz(strip.body) * 4 < gz(full.body), `strip ${gz(strip.body)} B vs full ${gz(full.body)} B gzipped`);
  assert.ok(strip.body.length < 4096, `strip ${strip.body.length} B raw, over 4 KB`);
  assert.doesNotMatch(strip.body + full.body, new RegExp(TYPED), "no typed prompt in either payload");
  assert.equal(strip.res.headers.get("cache-control"), full.res.headers.get("cache-control"), "cached the same way");
});

test("the strip fetches ?view=strip; any other query still gets the whole feed", async () => {
  assert.match(fs.readFileSync("src/components/ideas/MakingNow.tsx", "utf8"), /fetch\("\/api\/ideas\?view=strip"\)/);
  const full = (await get("/api/ideas")).body;
  for (const q of ["?view=all", "?limit=12", "?view=STRIP"]) assert.equal((await get(`/api/ideas${q}`)).body, full, q);
});
