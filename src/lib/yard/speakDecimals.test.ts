import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { speakDecimals } from "./inchText";
import { generateFromPrompt } from "./promptMain";

describe("decimals in notes", () => {
  it("says a ratio in words", () => {
    assert.equal(speakDecimals("body 2.0:1 long"), "body 2 to 1 long");
    assert.equal(speakDecimals("0.42 of the height"), "about two-fifths of the height");
    const notes = generateFromPrompt("dachshund shelf").notes.join(" ");
    assert.match(notes, /3 to 1/);
    assert.doesNotMatch(notes, /\d+\.\d+:1/);
  });
});
