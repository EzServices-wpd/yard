import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const where = (q: string) => buildPlan(generateFromPrompt(q)).instructions.map((s) => s.description).find((d) => /Hinge centers/.test(d)) ?? "";

// I15/F9: the floor list and the door list come from the same hinge centers at 1/16".
test("linen hinge heights at 1/16 from the floor, from the same numbers as the door", () => {
  const w = where("linen closet 31.5 wide 78 tall 16 deep");
  assert.match(w, /on the cabinet side that is 3 1\/16", 27", 51" and 74 15\/16" up from the floor/);
  assert.match(w, /at 26 15\/16" and 50 15\/16" up from the door's bottom edge/);
});

test("pantry five hinges: lists agree and join with commas", () => {
  const w = where("pantry 24 wide 84 tall 16 deep");
  assert.match(w, /at 22 1\/2", 41 15\/16" and 61 7\/16" up from the door's bottom edge/);
  assert.match(w, /3 1\/16", 22 9\/16", 42", 61 1\/2" and 80 15\/16" up from the floor/);
});
