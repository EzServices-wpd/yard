import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";

describe("the header labels every axis W × D × H and marks the untyped ones assumed", () => {
  it("folding table 48 by 24 36 inches high", () => {
    assert.equal(headerTitle(generateFromPrompt("folding table 48 by 24 36 inches high")), 'Folding table · 48" W × 24" D × 36" H');
  });
  it("nothing typed is marked assumed", () => {
    assert.match(headerTitle(generateFromPrompt("wine rack")), /W × .* D × .* H \(size assumed\)$/);
  });
  it("linen closet keeps its typed size", () => {
    assert.match(headerTitle(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep")), /^Linen · 31 1\/2" W × .+ D × 78" H$/);
  });
});
