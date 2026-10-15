import { test } from "node:test";
import assert from "node:assert/strict";
import { alsoAtLinks, ALSO_AT_REL, type AlsoAtStore } from "../src/components/workspace/also-at";
import type { BomLine } from "../src/lib/yard/types";

const none: Record<AlsoAtStore, string> = { homedepot: "", lowes: "", rockler: "", woodcraft: "", walmart: "" };
const hinge = { name: "Concealed hinge", quantity: 4, unit: "ea", searchQuery: "35mm concealed hinge" } as BomLine;
const ply = { name: "3/4\" Plywood 4×8", quantity: 2, unit: "sheets", catalogId: "plywood-3-4" } as BomLine;

test("also at: nothing renders with no templates set", () => {
  assert.deepEqual(alsoAtLinks(hinge, none), []);
  assert.deepEqual(alsoAtLinks(ply, none), []);
});

test("also at: Rockler link wraps its own search URL; lumber rows get no specialty store", () => {
  const t = { ...none, rockler: "https://track.example/c?u={url}" };
  const [l] = alsoAtLinks(hinge, t);
  assert.equal(l.store, "rockler");
  assert.ok(l.href.startsWith("https://track.example/c?u="));
  assert.ok(l.href.includes(encodeURIComponent("https://www.rockler.com/search?q=")));
  assert.deepEqual(alsoAtLinks(ply, t), []);
});

test("also at: each store appears only with its own template", () => {
  const t = { ...none, walmart: "https://w.example/?u={url}" };
  assert.deepEqual(alsoAtLinks(hinge, t).map((l) => l.store), ["walmart"]);
  assert.deepEqual(alsoAtLinks(ply, t).map((l) => l.store), ["walmart"]);
});

test("also at: owned rows and stores already in the row are skipped", () => {
  const t = { ...none, homedepot: "https://hd.example/?u={url}", walmart: "https://w.example/?u={url}" };
  const owned = { ...hinge, offers: [{ quote: "owned" }] } as unknown as BomLine;
  assert.deepEqual(alsoAtLinks(owned, t), []);
  const hasHd = { ...hinge, offers: [{ href: "https://www.homedepot.com/p/1" }] } as unknown as BomLine;
  assert.deepEqual(alsoAtLinks(hasHd, t).map((l) => l.store), ["walmart"]);
});

test("also at: rel is sponsored + nofollow", () => {
  assert.match(ALSO_AT_REL, /sponsored/);
  assert.match(ALSO_AT_REL, /nofollow/);
});
