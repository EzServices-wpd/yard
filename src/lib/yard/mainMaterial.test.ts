import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { mainMaterialId } from "./mainMaterial.ts";

it("the main material is what most parts are cut from", () => {
  const bunk = generateFromPrompt("twin bunk bed");
  assert.match(mainMaterialId(bunk), /^lumber-/, mainMaterialId(bunk));
  const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(mainMaterialId(linen), linen.primaryMaterialId);
});
it("the main material goes by wood volume, so the frame stock wins", () => {
  assert.equal(mainMaterialId(generateFromPrompt("twin bunk bed")), "lumber-2x4-8");
});
