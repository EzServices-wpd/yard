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

describe("the header says back typed counts and features the model builds", () => {
  const cases: [string, RegExp][] = [
    ["12 bottle wine rack", / · 12 bottles$/],
    ["key holder with 4 hooks", / · 4 hooks$/],
    ["shoe rack with cubbies", / · \d+ cubbies$/],
    ["spice cabinet with 3 shelves", / · 3 shelves$/],
    ["utility cabinet with shelves", / · \d+ shelves$/],
    ["window seat with cubbies", / · \d+ cubbies$/],
    ["mudroom bench with cubbies", / · \d+ cubbies$/],
    ["wardrobe with a rod", / · with rod$/],
    ["window seat with 3 cubbies", / · 3 cubbies$/],
    ["mudroom bench with 4 cubbies", / · 4 cubbies$/],
    ["utility cabinet with 3 shelves", /^Utility cabinet · .* · 3 shelves$/],
  ];
  for (const [q, re] of cases) it(q, () => assert.match(headerTitle(generateFromPrompt(q)), re));
});
