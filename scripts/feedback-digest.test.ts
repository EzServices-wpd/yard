import { test } from "node:test";
import assert from "node:assert/strict";
import { digestMarkdown, type DigestInput } from "../src/lib/feedback/digest";
import { ShopStore } from "../src/lib/feedback/store.server";

const A = "b0123456789abcde", B = "bfedcba987654321", C = "b00000000000000c";
const day = "2026-11-19";
const input: DigestInput = {
  day,
  feedback: [
    { prompt: "bookcase 36 wide", size: "36x12x84", partCount: 9, chips: ["price"], note: "boards cost more at my store", tip: "abcdef1", at: `${day}T15:00:00Z`, bid: A },
    { prompt: "bookcase 36 wide", size: "36x12x84", partCount: 9, chips: ["wrong-size"], note: null, tip: "abcdef1", at: `${day}T16:00:00Z`, bid: A },
    { prompt: "old page", size: "", partCount: 0, chips: ["other"], note: "no id", tip: "local", at: `${day}T17:00:00Z` },
    { prompt: "yesterday's note", size: "", partCount: 0, chips: ["steps"], note: null, tip: "abcdef1", at: "2026-11-18T10:00:00Z", bid: B },
  ],
  events: { [`${A}|build|`]: 3, [`${A}|thumb|down`]: 2, [`${A}|export|pdf`]: 1, [`${B}|build|`]: 1, [`${B}|buy|homedepot`]: 2, [`${B}|thumb|down`]: 1, [`${C}|export|pdf`]: 1, [`${C}|thumb|up`]: 4 },
  builds: { [A]: { prompt: "bookcase 36 wide", size: "36x12x84", family: "closet", parts: 9, usd: 131.76, tip: "abcdef1" }, [B]: { prompt: "pine bench", size: "48x16x18", family: "bench", parts: 7, usd: 70.25, tip: "abcdef1" }, [C]: { prompt: "toy box", size: "36x16x30", family: "closet", parts: 6, usd: 115.27, tip: "abcdef1" } },
};

test("the digest counts the day, ranks the worst builds and lists what is worth a look", () => {
  const page = digestMarkdown(input);
  assert.match(page, /^# Yard feedback digest · 2026-11-19/);
  assert.match(page, /Builds shown: \*\*4\*\* · exports: \*\*2\*\* · Buy clicks: \*\*2\*\* \(homedepot 2\)/);
  assert.match(page, /Thumbs: \*\*4\*\* up · \*\*3\*\* down/);
  assert.match(page, /Tell-the-shop notes: \*\*3\*\*/, "only the day's notes");
  assert.match(page, /1 note\(s\) came from an older page with no build id/);
  const worst = page.split("## Worst builds")[1].split("##")[0];
  assert.ok(worst.indexOf("bookcase 36 wide") < worst.indexOf("pine bench"), "2 down + 2 notes ranks above 1 down");
  assert.match(worst, /Price off: “boards cost more at my store”/);
  assert.doesNotMatch(worst, /toy box/, "a build with only thumbs-up is not a worst build");
  assert.match(page, /Printed or copied, never sent to a store: “bookcase 36 wide”; “toy box”/);
  assert.match(page, /Sent to a store, then thumbed down: “pine bench”/);
  assert.doesNotMatch(page, /yesterday's note/);
});

test("an empty day still renders, and markdown in a note cannot break the page", () => {
  const page = digestMarkdown({ day, feedback: [{ prompt: "x | y", size: "", partCount: 0, chips: [], note: "*bold* `code` <b>", tip: "local", at: `${day}T01:00:00Z` }], events: {}, builds: {} });
  assert.match(page, /No thumbs-down and no notes about a known build today/);
  assert.match(page, /\\\*bold\\\* \\`code\\` \\<b\\>/);
});

test("the store read fetches the list, the day's events and only the builds that matter", async () => {
  const calls: any[][] = [];
  const kv: Record<string, any> = {
    "feedback:list": input.feedback.map((f) => JSON.stringify(f)),
    [`ev:${day}`]: Object.entries(input.events).flat().map(String),
    [`bld:${A}`]: JSON.stringify(input.builds[A]), [`bld:${B}`]: JSON.stringify(input.builds[B]),
  };
  const pipe = async (cmds: (string | number)[][]) => cmds.map((c) => { calls.push(c); const [op, k, ...a] = c as any[];
    if (op === "INCRBY") return 1;
    if (op === "LRANGE") return kv[k] ?? [];
    if (op === "HGETALL") return kv[k] ?? [];
    if (op === "MGET") return [k, ...a].map((x: string) => kv[x] ?? null);
    return null; });
  const got = (await new ShopStore(pipe).digestInput(day, new Date(`${day}T23:00:00Z`)))!;
  assert.equal(got.events[`${A}|thumb|down`], 2);
  assert.deepEqual(Object.keys(got.builds).sort(), [A, B, C].sort(), "builds with a thumb, a note, an export or a Buy click; never a build-only one");
  assert.equal(got.builds[C], null, "a build whose record expired reads as null, not an error");
  assert.ok(calls.every(([op]) => ["INCRBY", "LRANGE", "HGETALL", "MGET"].includes(op as string)), "read-only, plus the budget counter");
  assert.equal(await new ShopStore(null).digestInput(day), null);
});
