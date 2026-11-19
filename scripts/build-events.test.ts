import { test } from "node:test";
import assert from "node:assert/strict";
import { BID, buildIdOf } from "../src/lib/feedback/buildId";
import { cleanEvent } from "../src/lib/feedback/events";
import { cleanFeedback } from "../src/lib/feedback/shop";
import { ShopStore, EV_DAY_CAP, EV_INSTANCE_PER_MIN } from "../src/lib/feedback/store.server";

function fakeRedis() {
  const kv = new Map<string, any>();
  const pipe = async (cmds: (string | number)[][]) => cmds.map((c) => { const [op, k, ...a] = c as any[];
    switch (op) {
      case "INCRBY": kv.set(k, (kv.get(k) ?? 0) + Number(a[0])); return kv.get(k);
      case "INCR": kv.set(k, (kv.get(k) ?? 0) + 1); return kv.get(k);
      case "EXPIRE": return 1;
      case "HINCRBY": { const h = kv.get(k) ?? {}; h[a[0]] = (h[a[0]] ?? 0) + Number(a[1]); kv.set(k, h); return h[a[0]]; }
      case "SET": { if (a.includes("NX") && kv.has(k)) return null; kv.set(k, a[0]); return "OK"; }
    } return null; });
  return { kv, pipe };
}
const build = { prompt: "bookcase 36 wide", kind: "closet", primaryMaterialId: "plywood-3-4-4x8", overall: { width: 36, height: 84, depth: 12 }, panels: [{ name: "Side" }, { name: "Side" }, { name: "Top" }] };

test("one build id per build: same build, same id; any change to the build, a new id; no person in it", () => {
  const a = buildIdOf(build);
  assert.match(a, BID);
  assert.equal(buildIdOf({ ...build }), a);
  assert.equal(buildIdOf({ ...build, prompt: "  Bookcase   36 WIDE " }), a, "the typed words are compared normalized");
  assert.notEqual(buildIdOf({ ...build, overall: { ...build.overall, width: 30 } }), a);
  assert.notEqual(buildIdOf({ ...build, primaryMaterialId: "lumber-1x12-8" }), a);
  assert.notEqual(buildIdOf({ ...build, panels: [...build.panels, { name: "Shelf" }] }), a);
});

test("events keep only a build id, the event and its detail; only a build event carries the build", () => {
  const bid = buildIdOf(build);
  assert.equal(cleanEvent({ ev: "buy", store: "homedepot" }, ""), null, "no build id, no event");
  assert.equal(cleanEvent({ bid: "x", ev: "buy" }, ""), null);
  assert.equal(cleanEvent({ bid, ev: "spy" }, ""), null);
  assert.equal(cleanEvent({ bid, ev: "thumb" }, ""), null, "a thumb says up or down");
  const buy = cleanEvent({ bid, ev: "buy", store: "lowes", ip: "1.2.3.4", ua: "x" }, "abcdef12")!;
  assert.deepEqual(Object.keys(buy).sort(), ["at", "bid", "detail", "ev"]);
  assert.equal(buy.detail, "lowes");
  assert.equal(cleanEvent({ bid, ev: "buy", store: "evil.example" }, "")!.detail, "other");
  assert.equal(cleanEvent({ bid, ev: "thumb", up: false }, "")!.detail, "down");
  const b = cleanEvent({ bid, ev: "build", prompt: "bookcase for jane@doe.com", size: "36x12x84", family: "closet", parts: 9, usd: 131.756 }, "abcdef1234")!;
  assert.equal(b.build!.prompt, null, "the build's words pass the query-log scrub");
  assert.deepEqual({ ...b.build, prompt: null }, { prompt: null, size: "36x12x84", family: "closet", parts: 9, usd: 131.76, tip: "abcdef1" });
});

test("events are counted per build and capped hard per day before any write", async () => {
  const f = fakeRedis();
  const s = new ShopStore(f.pipe);
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T10:00:00Z");
  assert.equal(await s.addEvent(cleanEvent({ bid, ev: "build", prompt: "bookcase", size: "36x12x84", family: "closet" }, "", at)!, at), "saved");
  assert.equal(await s.addEvent(cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!, at), "saved");
  assert.equal(await s.addEvent(cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!, at), "saved");
  assert.equal(f.kv.get("ev:2026-11-19")[`${bid}|buy|homedepot`], 2);
  assert.ok(String(f.kv.get(`bld:${bid}`)).includes('"family":"closet"'));
  f.kv.set("ev:n:2026-11-19", EV_DAY_CAP);
  const later = new Date("2026-11-19T11:00:00Z");
  assert.equal(await s.addEvent(cleanEvent({ bid, ev: "thumb", up: true }, "", later)!, later), "limited");
  assert.equal(f.kv.get("ev:2026-11-19")[`${bid}|thumb|up`], undefined, "over the cap nothing is written");
  const s2 = new ShopStore(f.pipe);
  const next = new Date("2026-11-20T10:00:00Z");
  for (let i = 0; i < EV_INSTANCE_PER_MIN; i++) await s2.addEvent(cleanEvent({ bid, ev: "export", kind: "pdf" }, "", next)!, next);
  assert.equal(await s2.addEvent(cleanEvent({ bid, ev: "export", kind: "pdf" }, "", next)!, next), "limited");
  assert.equal(await new ShopStore(null).addEvent(cleanEvent({ bid, ev: "export" }, "")!), "off");
});

test("feedback carries the build id when it has one, and nothing new when it does not", () => {
  const bid = buildIdOf(build);
  assert.equal(cleanFeedback({ chips: ["price"], bid }, "")!.bid, bid);
  assert.equal("bid" in cleanFeedback({ chips: ["price"], bid: "not-an-id" }, "")!, false);
});
