import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { decodeShare, permalink, replayShare } from "./shareBuild.ts";
import { refineProject } from "./refine.ts";

const token = (url: string) => decodeShare(new URL(url).searchParams.get("y")!)!;

describe("permanent share link rebuilds the same model, stock and size", () => {
  const builds = [
    generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"),
    generateFromPrompt("bookshelf 30 wide, 60 tall, five shelves"),
    generateFromPrompt("nightstand"),
    generateFromPrompt("workbench", "plywood-3-4-4x8"),
    refineProject(generateFromPrompt("bookshelf 30 wide, 60 tall"), "6 inches taller").project!,
    generateFromPrompt("water wheel"),
  ];
  for (const p of builds) {
    it(p.name, () => {
      const url = permalink(p);
      assert.ok(url, "link offered");
      const back = replayShare(token(url));
      assert.equal(back.primaryMaterialId, p.primaryMaterialId);
      assert.deepEqual(back.overall, p.overall);
      assert.equal(back.panels.length, p.panels.length);
    });
  }
  it("makes no network call", () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls++; throw new Error("no network"); }) as typeof fetch;
    try { for (const p of builds) permalink(p); } finally { globalThis.fetch = real; }
    assert.equal(calls, 0);
  });
});
