import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./prompt.ts";

describe("measured pocket occupancy", () => {
  it("keeps the hole, the share the unit takes, and uneven shelves", () => {
    const project = generateFromPrompt(
      "closet into a pocket 41 wide, 19 deep, 90 tall, back wall and both side walls, ceiling is 96, unit takes only 28 of the width, 12 of the depth, and 64 of the height, left shelves 9 wide, right shelves 13 wide",
    );
    const notes = project.notes.join("\n");
    assert.match(notes, /Back 41/);
    assert.match(notes, /both walls 19/);
    assert.match(notes, /ceiling 96/);
    assert.match(notes, /Unit 28/);
    assert.match(notes, /12" out/);
    assert.match(notes, /64" tall/);
    assert.match(notes, /Left shelves 9/);
    assert.match(notes, /Right shelves 13/);
    assert.doesNotMatch(notes, /102"/);
  });

  it("still freezes the original pocket vanity survey", () => {
    const project = generateFromPrompt("pocket vanity");
    const notes = project.notes.join("\n");
    assert.match(notes, /38 1\/2|38\.5/);
    assert.match(notes, /102/);
    assert.match(notes, /26/);
  });
});
