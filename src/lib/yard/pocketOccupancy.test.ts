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


  it("reads singular shelf and left wall depths", () => {
    const project = generateFromPrompt(
      "closet in a pocket: back wall 41.5 inches, left wall 15.25, right wall 18.75, ceiling 83. Opening the unit takes is 33 wide, 14 deep, 76 tall. Left shelf 12.5 wide, right shelf 17.25 wide.",
    );
    const notes = project.notes.join("\n");
    assert.match(notes, /Back 41/);
    assert.match(notes, /left depth 15/);
    assert.match(notes, /right depth 18/);
    assert.match(notes, /Left shelves 12/);
    assert.match(notes, /Right shelves 17/);
    assert.doesNotMatch(notes, /both walls 14/);
  });

  it("still freezes the original pocket vanity survey", () => {
    const project = generateFromPrompt("pocket vanity");
    const notes = project.notes.join("\n");
    assert.match(notes, /38 1\/2|38\.5/);
    assert.match(notes, /102/);
    assert.match(notes, /26/);
  });
});
