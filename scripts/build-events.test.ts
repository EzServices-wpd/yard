import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BID, buildIdOf } from "../src/lib/feedback/buildId";
import { cleanEvent } from "../src/lib/feedback/events";
import { cleanFeedback } from "../src/lib/feedback/shop";
import { ShopStore, EV_DAY_CAP, EV_INSTANCE_PER_MIN, EV_MONTH_BUDGET, K, EVENT_GATE_LUA, eventKeyScope } from "../src/lib/feedback/store.server";
import { eventPageQuiet, eventPostDecision } from "../src/lib/feedback/eventGate";

const luaQuote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

/** Run one Redis EVAL with the real Lua 5.4 interpreter. The script string is the one the server sends. */
function runRedisLua(script: string, keys: string[], args: string[], kv: Map<string, any>): { result: number[]; ops: string[] } {
  const seed = [...kv.entries()].filter(([, v]) => typeof v === "number").map(([k, v]) => `[${luaQuote(String(k))}]=${v}`).join(",");
  const program = `
local kv = { ${seed} }
local ops = {}
KEYS = { ${keys.map(luaQuote).join(",")} }
ARGV = { ${args.map(luaQuote).join(",")} }
redis = {}
function redis.call(op, key, a)
  ops[#ops+1] = op .. " " .. tostring(key)
  if op == "GET" then
    local v = kv[key]
    if v == nil then return nil end
    return tostring(v)
  elseif op == "INCR" then
    local n = (tonumber(kv[key]) or 0) + 1
    kv[key] = n
    return n
  elseif op == "INCRBY" then
    local n = (tonumber(kv[key]) or 0) + tonumber(a)
    kv[key] = n
    return n
  elseif op == "DECR" then
    local n = (tonumber(kv[key]) or 0) - 1
    kv[key] = n
    return n
  elseif op == "EXPIRE" then
    return 1
  end
  return nil
end
local fn, err = load([=[${script}]=], "eval")
if not fn then error(err) end
local result = fn()
local out = {}
for i = 1, #result do out[#out+1] = tostring(result[i]) end
local rows = {}
for k, v in pairs(kv) do rows[#rows+1] = k .. "\\t" .. tostring(v) end
io.write(table.concat(out, ",") .. "\\n" .. table.concat(ops, "\\n") .. "\\n--kv--\\n" .. table.concat(rows, "\\n"))
`;
  const bin = ["lua5.4", "lua"].find((name) => spawnSync(name, ["-v"], { encoding: "utf8" }).status === 0);
  if (!bin) throw new Error("lua5.4 (or lua) is not installed; the event-cap tests run EVENT_GATE_LUA");
  const ran = spawnSync(bin, ["-e", program], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(ran.stderr || `${bin} failed`);
  const [head, rest] = ran.stdout.split("\n--kv--\n");
  const [resultLine, ...opLines] = head.split("\n");
  const ops = opLines.filter(Boolean);
  for (const [k, v] of [...kv.entries()]) if (typeof v === "number") kv.delete(k);
  for (const line of (rest ?? "").split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    kv.set(line.slice(0, tab), Number(line.slice(tab + 1)));
  }
  return { result: resultLine.split(",").map(Number), ops };
}

function fakeRedis() {
  const kv = new Map<string, any>();
  const calls: (string | number)[][] = [];
  const evalOps: string[] = [];
  // One round trip at a time, so concurrent EVALs of the real script cannot pass the cap.
  let chain = Promise.resolve();
  const pipe = (cmds: (string | number)[][]) => {
    const job = chain.then(() => cmds.map((c) => { calls.push(c); const [op, k, ...a] = c as any[];
      switch (op) {
        case "EVAL": {
          const numkeys = Number(a[0]);
          const keys = a.slice(1, 1 + numkeys).map(String);
          const args = a.slice(1 + numkeys).map(String);
          const ran = runRedisLua(String(k), keys, args, kv);
          evalOps.splice(0, evalOps.length, ...ran.ops);
          return ran.result;
        }
        case "GET": return kv.has(k) ? kv.get(k) : null;
        case "INCRBY": kv.set(k, (kv.get(k) ?? 0) + Number(a[0])); return kv.get(k);
        case "INCR": kv.set(k, (kv.get(k) ?? 0) + 1); return kv.get(k);
        case "EXPIRE": return 1;
        case "HINCRBY": { const h = kv.get(k) ?? {}; h[a[0]] = (h[a[0]] ?? 0) + Number(a[1]); kv.set(k, h); return h[a[0]]; }
        case "SET": { if (a.includes("NX") && kv.has(k)) return null; kv.set(k, a[0]); return "OK"; }
      } return null; }));
    chain = job.then(() => undefined, () => undefined);
    return job;
  };
  return { kv, calls, pipe, evalOps };
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
  const b = cleanEvent({ bid, ev: "build", prompt: "bookcase for jane@doe.com", size: "36x12x84", family: "linen", parts: 11, usd: 999999 }, "abcdef1234")!;
  assert.equal(b.build!.prompt, null, "the build's words pass the query-log scrub");
  assert.equal(b.build!.unverified, true);
  assert.equal(b.build!.tip, "abcdef1");
  assert.deepEqual(Object.keys(b.build!).sort(), ["prompt", "tip", "unverified"], "client price, parts, size and family are not kept");
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
  assert.ok(String(f.kv.get(`bld:${bid}`)).includes('"unverified":true'));
  assert.ok(!String(f.kv.get(`bld:${bid}`)).includes("999"), "a planted price is not stored");
  assert.equal(f.kv.has("ideas:cmds:2026-11"), false, "events do not spend the shared Ideas budget");
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

test("a burst of 2,000 events stores nothing past the daily cap, and no personal detail", async () => {
  const f = fakeRedis();
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  let saved = 0, limited = 0;
  // Each call is its own instance (its own minute window) on one shared store, the way a burst hits many servers.
  for (let i = 0; i < 2000; i++) {
    const s = new ShopStore(f.pipe);
    const raw = { bid, ev: "buy", store: "homedepot", ip: "203.0.113.4", ua: "Mozilla/5.0", cookie: "sid=secret", email: "jane@doe.com" };
    const out = await s.addEvent(cleanEvent(raw, "", at)!, at);
    if (out === "saved") saved++;
    else if (out === "limited") limited++;
    else assert.fail(out);
  }
  assert.equal(saved, EV_DAY_CAP);
  assert.equal(limited, 2000 - EV_DAY_CAP);
  const hash = f.kv.get("ev:2026-11-19") as Record<string, number>;
  assert.equal(Object.values(hash).reduce((a, b) => a + b, 0), EV_DAY_CAP, "the event hash stops at the cap");
  const blob = JSON.stringify([...f.kv.entries()]);
  assert.doesNotMatch(blob, /jane@doe\.com|203\.0\.113\.4|Mozilla|sid=secret/);
  const poisoned = cleanEvent({ bid, ev: "build", prompt: "bookcase for jane@doe.com call 555-123-4567", size: "36x12x84", family: "closet", ip: "203.0.113.4" }, "abcdef12", at)!;
  assert.equal(poisoned.build!.prompt, null);
  assert.deepEqual(Object.keys(poisoned).sort(), ["at", "bid", "build", "detail", "ev"]);
});

test("the thumbs control is on and shows the decided wording", () => {
  const src = readFileSync(new URL("../src/components/workspace/shop-feedback.tsx", import.meta.url), "utf8");
  assert.match(src, /export const THUMBS_ENABLED: boolean = true/);
  assert.match(src, /\{THUMBS_ENABLED \? \(/);
  assert.doesNotMatch(src, /THUMBS_DRAFT/);
  for (const s of ["Would you build this?", "Yes", "Not like this", "I would build this", "I would not build this as shown", "Thanks. That tells the shop this one works."]) {
    assert.ok(src.includes(s), s);
  }
  const privacy = readFileSync(new URL("../src/routes/privacy.tsx", import.meta.url), "utf8");
  assert.match(privacy, /Yard also counts which builds are opened, exported, sent to a store or rated, by a code\s+made from the build itself\. The words you typed for that build are stored with that code\s+for 85 days\. The counts of those events are kept for 3 days\. None of this is tied to you,\s+your device or your IP address\./);
  assert.match(privacy, /The\s+one place we use your IP address is the daily limit on AI lookups/);
});

test("over the day cap a fresh instance spends one command and does not write the event", async () => {
  const f = fakeRedis();
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  f.kv.set(K.evCount("2026-11-19"), EV_DAY_CAP);
  const s = new ShopStore(f.pipe);
  assert.equal(await s.addEvent(cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!, at), "limited");
  assert.equal(f.calls.filter((c) => c[0] === "EVAL").length, 1);
  assert.equal(f.calls.some((c) => c[0] === "HINCRBY"), false);
  assert.equal(f.kv.get(K.evCount("2026-11-19")), EV_DAY_CAP);
  assert.equal(f.evalOps.some((op) => op.startsWith("INCR ")), false, "the Lua day check returns before INCR");
  assert.equal(f.kv.get(K.evCmds("2026-11")) ?? 0, 0, "a day-cap refusal does not spend the month budget");
  const s2 = new ShopStore(f.pipe);
  assert.equal(await s2.addEvent(cleanEvent({ bid, ev: "export", kind: "pdf" }, "", at)!, at), "limited");
  assert.equal(f.kv.get(K.evCount("2026-11-19")), EV_DAY_CAP);
  assert.equal([...f.kv.keys()].some((k) => String(k).startsWith("ideas:cmds")), false);
});

test("a warm instance that has seen the month spent refuses the rest with at most one store command", async () => {
  const f = fakeRedis();
  f.kv.set(K.evCmds("2026-11"), EV_MONTH_BUDGET);
  const s = new ShopStore(f.pipe);
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  const ev = cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!;
  for (let i = 0; i < 100; i++) assert.equal(await s.addEvent(ev, at), "limited");
  assert.ok(f.calls.length <= 1, `one warm instance sent ${f.calls.length} store commands`);
  assert.equal(f.calls[0]?.[0], "EVAL");
  assert.equal(f.calls[0]?.[1], EVENT_GATE_LUA);
  assert.equal(f.kv.get(K.evCmds("2026-11")), EV_MONTH_BUDGET, "the Lua month check does not move the counter");
  assert.equal(f.evalOps.some((op) => op.startsWith("INCR")), false);
});

test("a warm instance that has seen the day cap sends at most one command until the next UTC day", async () => {
  const f = fakeRedis();
  f.kv.set(K.evCount("2026-11-19"), EV_DAY_CAP);
  const s = new ShopStore(f.pipe);
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T23:00:00Z");
  const ev = cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!;
  for (let i = 0; i < 60; i++) assert.equal(await s.addEvent(ev, at), "limited");
  assert.ok(f.calls.length <= 1, `one warm instance sent ${f.calls.length} store commands`);
  assert.equal(f.evalOps.some((op) => op.startsWith("INCR ")), false, "the Lua day check returns before INCR");
  assert.equal(f.kv.get(K.evCmds("2026-11")) ?? 0, 0);
  const next = new Date("2026-11-20T00:00:00Z");
  const before = f.calls.length;
  const again = await s.addEvent(cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", next)!, next);
  assert.equal(again, "saved");
  assert.ok(f.calls.length > before, "a new UTC day asks the store again");
});

test("a store error sets no day or month memo", async () => {
  let n = 0;
  const pipe = async () => { n++; throw new Error("store down"); };
  const s = new ShopStore(pipe);
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  const ev = cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!;
  assert.equal(await s.addEvent(ev, at), "dropped");
  assert.equal(await s.addEvent(ev, at), "dropped");
  assert.equal(n, 2, "the next call still reaches the store");
});

test("with the month budget already spent, 100 fresh instances save nothing and leave ev:cmds unchanged", async () => {
  const f = fakeRedis();
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  f.kv.set(K.evCmds("2026-11"), EV_MONTH_BUDGET);
  let saved = 0;
  for (let i = 0; i < 100; i++) {
    const s = new ShopStore(f.pipe);
    const out = await s.addEvent(cleanEvent({ bid, ev: "buy", store: "amazon" }, "", at)!, at);
    if (out === "saved") saved++;
    else assert.equal(out, "limited");
  }
  assert.equal(saved, 0);
  assert.equal(f.kv.get(K.evCmds("2026-11")), EV_MONTH_BUDGET);
  assert.equal(f.kv.has("ev:2026-11-19"), false);
  assert.equal(f.kv.has("ideas:cmds:2026-11"), false);
});

test("50 parallel calls at 1,199 do not pass 1,200", async () => {
  const f = fakeRedis();
  const bid = buildIdOf(build);
  const at = new Date("2026-11-19T12:00:00Z");
  f.kv.set(K.evCount("2026-11-19"), EV_DAY_CAP - 1);
  const results = await Promise.all(Array.from({ length: 50 }, () => new ShopStore(f.pipe).addEvent(cleanEvent({ bid, ev: "buy", store: "homedepot" }, "", at)!, at)));
  assert.equal(results.filter((r) => r === "saved").length, 1);
  assert.equal(Number(f.kv.get(K.evCount("2026-11-19"))), EV_DAY_CAP);
  const hash = (f.kv.get("ev:2026-11-19") ?? {}) as Record<string, number>;
  assert.equal(Object.values(hash).reduce((a, b) => a + b, 0), 1);
});

test("cross-origin and text/plain are not events; a test page sends nothing", () => {
  const preview = { VERCEL_ENV: "preview", VERCEL_URL: "yard-git-cursor-build-id-events-build-hq.vercel.app" };
  const ok = { contentType: "application/json", origin: "https://yard.wiki", referer: null, url: "https://yard.wiki/api/ev", testHeader: null };
  assert.equal(eventPostDecision(ok), "ok");
  assert.equal(eventPostDecision({ ...ok, origin: "https://yard-git-cursor-build-id-events-build-hq.vercel.app" }, preview), "ok");
  assert.equal(eventPostDecision({ ...ok, origin: "https://yard-git-some-other-preview.vercel.app" }, { VERCEL_ENV: "production", VERCEL_URL: "yard.wiki" }), "cross", "a preview origin does not count on production");
  assert.equal(eventPostDecision({ ...ok, origin: "http://127.0.0.1:8080" }), "ok");
  assert.equal(eventPostDecision({ ...ok, origin: "http://127.0.0.1:8080" }, { VERCEL_ENV: "production" }), "cross");
  assert.equal(eventPostDecision({ ...ok, origin: "https://evil.example", contentType: "text/plain" }), "type");
  assert.equal(eventPostDecision({ ...ok, contentType: "text/plain" }), "type");
  assert.equal(eventPostDecision({ ...ok, origin: "https://evil.example" }), "cross");
  assert.equal(eventPostDecision({ ...ok, origin: null, referer: null }), "cross");
  assert.equal(eventPostDecision({ ...ok, url: "https://yard.wiki/api/ev?offline=1" }), "test");
  assert.equal(eventPostDecision({ ...ok, referer: "https://yard.wiki/workspace?test=1" }), "test");
  assert.equal(eventPostDecision({ ...ok, testHeader: "1" }), "test");
  assert.equal(eventPageQuiet("?offline=1"), true);
  assert.equal(eventPageQuiet("?q=bench&test=1"), true);
  assert.equal(eventPageQuiet("?q=bench"), false);
  const sender = readFileSync(new URL("../src/lib/feedback/sendEvent.ts", import.meta.url), "utf8");
  assert.ok(sender.indexOf("eventPageQuiet") < sender.indexOf("fetch("), "a test page returns before the request");
  const route = readFileSync(new URL("../src/routes/api/ev.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("eventPostDecision") < route.indexOf("shopStore"), "origin and test traffic are decided before the store");
  assert.doesNotMatch(route, /x-forwarded-for|x-real-ip|clientHash|remoteAddress/);
  assert.equal(eventKeyScope({}), "");
  assert.equal(eventKeyScope({ VERCEL_ENV: "production" }), "");
  assert.equal(eventKeyScope({ VERCEL_ENV: "preview" }), "preview:", "preview events do not spend the production counters");
  assert.equal(K.build("b0123456789abcde"), "bld:b0123456789abcde");
  assert.equal(K.build("b0123456789abcde", "preview:"), "bld:preview:b0123456789abcde");
});

test("feedback carries the build id when it has one, and nothing new when it does not", () => {
  const bid = buildIdOf(build);
  assert.equal(cleanFeedback({ chips: ["price"], bid }, "")!.bid, bid);
  assert.equal("bid" in cleanFeedback({ chips: ["price"], bid: "not-an-id" }, "")!, false);
});
