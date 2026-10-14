import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildInfo } from "./buildInfo.ts";
import { RECIPES } from "./recipes.ts";

describe("How this was built", () => {
  it("a built-in shape is the engine, trusted", () => {
    const i = buildInfo(generateFromPrompt("bookshelf 30 wide, 60 tall"));
    assert.equal(i.source, "Built-in shape");
    assert.equal(i.trust, "Trusted");
  });
  it("a saved recipe names its trust and the gate checks", () => {
    const r = RECIPES.recipes.find((x) => x.trust === "trusted" && !x.held)!;
    const i = buildInfo(generateFromPrompt(r.key.replace(/-/g, " ")));
    assert.equal(i.source, "Saved recipe");
    assert.ok(i.passed.length > 0 || i.failed.length > 0);
    if (i.failed.length) assert.equal(i.trust, "Unverified");
  });
  it("a held or candidate recipe is Unverified", () => {
    const r = RECIPES.recipes.find((x) => x.trust !== "trusted" || x.held)!;
    assert.equal(buildInfo(generateFromPrompt(r.key.replace(/-/g, " "))).trust, "Unverified");
  });
  it("a placeholder says so", () => assert.equal(buildInfo({ prompt: "flurbleglarp", notes: [], displayOnly: true }).source, "Placeholder"));
  it("makes no network call", () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = ((u: unknown) => { urls.push(String(u)); throw new Error("no network"); }) as typeof fetch;
    try { for (const q of ["bookshelf", "water wheel", "cribbage board", "linen closet 31.5 wide 78 tall 16 deep"]) buildInfo(generateFromPrompt(q)); } finally { globalThis.fetch = real; }
    assert.deepEqual(urls.filter((u) => /x\.ai|xai|lookup|_serverFn/i.test(u)), []);
    assert.equal(urls.length, 0);
  });
});
