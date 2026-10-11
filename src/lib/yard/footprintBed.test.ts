import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

it("a 4x8 raised bed is 48 by 96 in feet, open to the soil below", () => {
  const p = generateFromPrompt("cedar raised garden bed 4x8");
  assert.deepEqual([p.overall.width, p.overall.depth], [48, 96]);
  assert.ok(!p.panels.some((x) => x.name === "Bottom"));
  assert.ok(generateFromPrompt("planter box").panels.some((x) => x.name === "Bottom"));
});
