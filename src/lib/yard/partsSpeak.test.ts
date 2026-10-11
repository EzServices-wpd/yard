import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

it("a back refits between the sides when a stock switch thickens them", () => {
  const p = generateFromPrompt("bookshelf 36 wide 72 tall from 2x4");
  const back = p.panels.find((x) => x.name === "Back")!;
  const shelf = p.panels.find((x) => /^Shelf/.test(x.name))!;
  assert.equal(back.size.width, shelf.size.width);
});
it("the crate notes describe the door the model draws", () => {
  const p = generateFromPrompt("dog crate 36 long");
  assert.ok(!/see through/.test(p.notes.join(" ")));
});
