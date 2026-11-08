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
  it("an ungraded built-in shape is Unverified (toy airplane)", () => assert.equal(buildInfo(generateFromPrompt("toy airplane")).trust, "Unverified"));
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

it("a Critic-flagged built-in (picnic table) is Unverified until regraded", () => {
  const i = buildInfo({ prompt: "picnic table", notes: [] } as never);
  assert.equal(i.source, "Built-in shape");
  assert.equal(i.trust, "Unverified");
  assert.ok(i.failed.some((f) => /regrade/.test(f)));
});

describe("span warning and trust", () => {
  it("never shows Trusted while a span warning is up", async () => {
    const { stampSpanOffer } = await import("./spanCheck.ts");
    const p = stampSpanOffer(generateFromPrompt("corner bookshelf 60 wide 84 tall"));
    if (p.supportOffer?.needed && !p.supportOffer.included) assert.equal(buildInfo(p).trust, "Unverified");
    const fake = { prompt: "bookshelf", notes: [], supportOffer: { needed: true, included: false, kind: "span", reason: "x" } } as never;
    assert.equal(buildInfo(fake).trust, "Unverified");
  });
});
