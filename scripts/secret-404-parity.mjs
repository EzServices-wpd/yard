// After `vite build`: drives the built Vercel function (.vercel/output/functions/__server.func) and checks that a bad
// or missing secret on /api/cron/retention and /api/critic-review returns exactly what an unknown /api/<path> returns:
// same status, same headers (all of them), same body bytes. The not-found page carries a render timestamp
// (`u:<ms>`), so the clock is frozen while each pair is rendered. Then times both (median of N).
// Usage: node scripts/secret-404-parity.mjs   (exit 1 on any difference)
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const fn = path.resolve(".vercel/output/functions/__server.func/index.mjs");
process.env.DATABASE_URL ??= "postgres://parity:parity@127.0.0.1:9/none"; // never connected: no page here touches the DB
process.env.CRON_SECRET = "k".repeat(64);
process.env.CRITIC_REVIEW_SECRET = "r".repeat(32);
const { default: server } = await import(pathToFileURL(fn).href);
const realNow = Date.now;
const FROZEN = 1_792_300_000_000;

async function hit(pathname, { method = "GET", headers = {}, body } = {}) {
  Date.now = () => FROZEN;
  try {
    const res = await server.fetch(new Request(`https://yard.test${pathname}`, { method, headers, body }), { waitUntil() {} });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: [...res.headers.entries()].sort(), bytes };
  } finally { Date.now = realNow; }
}
const same = (a, b, label) => {
  assert.equal(a.status, b.status, `${label}: status`);
  assert.deepEqual(a.headers, b.headers, `${label}: headers`);
  assert.ok(a.bytes.equals(b.bytes), `${label}: body bytes (${a.bytes.length} vs ${b.bytes.length})`);
};

const browser = { accept: "text/html,application/xhtml+xml,*/*;q=0.8", "user-agent": "Mozilla/5.0" };
const variants = [
  ["GET, browser", { headers: browser }],
  ["GET, no headers", {}],
  ["GET, Accept: application/json", { headers: { accept: "application/json" } }],
  ["HEAD", { method: "HEAD", headers: browser }],
  ["POST", { method: "POST", headers: { ...browser, "content-type": "application/json" }, body: '{"key":"aaaaaaaa","grade":"A"}' }],
];
const auths = [["no auth", undefined], ["wrong Bearer", "Bearer " + "x".repeat(64)], ["near-miss Bearer", "Bearer " + "k".repeat(63) + "x"], ["raw secret", "k".repeat(64)], ["Basic", "Basic " + "k".repeat(64)]];
let checked = 0;
const sample = {};
for (const [vlabel, v] of variants) {
  const unknown = await hit(`/api/zq${Math.random().toString(36).slice(2, 10)}`, v);
  sample[vlabel] = { status: unknown.status, bytes: unknown.bytes.length, headers: Object.fromEntries(unknown.headers) };
  for (const p of ["/api/cron/retention", "/api/critic-review", "/api/critic-review?op=unreviewed"]) {
    for (const [alabel, a] of auths) {
      const got = await hit(p, { ...v, headers: { ...(v.headers ?? {}), ...(a ? { authorization: a } : {}) } });
      same(got, unknown, `${p} ${vlabel} ${alabel}`);
      checked++;
    }
  }
}
// The secret paths do answer with the right secret (so the check above isn't vacuous) — cron left out: it would sweep.
const ok = await hit("/api/critic-review?op=sample", { headers: { authorization: "Bearer " + "r".repeat(32) } });
assert.equal(ok.status, 200);

// Timing: median wall time of 300 renders each, interleaved.
const N = 300, tu = [], tb = [];
for (let i = 0; i < N; i++) {
  for (const [arr, p, h] of [[tu, "/api/zq7x3k9m", {}], [tb, "/api/cron/retention", { authorization: "Bearer " + "x".repeat(64) }]]) {
    const t = process.hrtime.bigint();
    const r = await server.fetch(new Request(`https://yard.test${p}`, { headers: { ...browser, ...h } }), { waitUntil() {} });
    await r.arrayBuffer();
    arr.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
}
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log(JSON.stringify({ checked, unknownApi404: sample, medianMs: { unknown: +med(tu).toFixed(3), badSecret: +med(tb).toFixed(3) } }, null, 1));
assert.ok(Math.abs(med(tu) - med(tb)) < Math.max(0.5, 0.1 * med(tu)), "timing medians within noise");
console.log("SECRET 404 PARITY OK");
process.exit(0);
