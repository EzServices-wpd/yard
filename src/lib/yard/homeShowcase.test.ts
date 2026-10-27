import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { showcaseFor } from "./homeShowcase.ts";

const home = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");

describe("home 'Made on Yard' cards are live Yard output", () => {
  it("uses no photo-style hero images and says the drawing is live output", () => {
    assert.doesNotMatch(home, /\/heroes\/[a-z]+\.(jpe?g|png|webp)/);
    assert.match(home, /Live Yard output, not a photo\./);
    assert.match(home, /showcaseFor\(piece\.prompt\)/);
  });
  it("keeps the headline and subline", () => {
    assert.match(home, /\["Think", "it", "up\."\], \["Yard", "works", "it", "out\."\]/);
    assert.match(home, /Plywood or popsicle sticks, PVC or cardboard\. One real model\. Every part, cut and step\./);
    assert.doesNotMatch(home, /One model\. Every cut, part and step\./, "the old subline is gone (PR 3)");
  });
  it("size copy is honest about doors standing proud", () => {
    assert.doesNotMatch(home, /you get a 31 1\/2 × 78 × 16 build/);
    // W × H × D (today) or W × D × H in (SWE 2's #68 format): same dimensions, the box matches what was typed, doors add 3/4.
    const size = String.raw`31 1\/2 [×x] (?:78 [×x] 16|16 [×x] 78 in)`;
    const m = home.match(new RegExp(String.raw`Type (${size}) and the box is (${size}); doors add 3\/4`));
    assert.ok(m, "size copy names the typed size, the same box size and the 3/4 door note");
    assert.equal(m![1], m![2]);
  });
  for (const prompt of [
    "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    "pocket vanity",
    "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
  ]) {
    it(`draws ${prompt} from the engine with real totals`, () => {
      const s = showcaseFor(prompt);
      assert.ok(s.pieces > 0, "cut pieces");
      assert.ok(s.buyUsd > 0, "buy total");
      assert.ok(s.svg.startsWith("<svg") && (s.svg.match(/<path/g) ?? []).length > 10, "drawing");
    });
  }
  it("linen card model stays 31 1/2 × 78 × 16", () => {
    const s = showcaseFor("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep");
    assert.deepEqual([s.overall.width, s.overall.height, s.overall.depth], [31.5, 78, 16]);
  });
});
