import assert from "node:assert/strict";
import { it } from "node:test";
import { boundPrompt } from "./promptLimits.ts";
import { generateFromPrompt } from "./promptMain.ts";

it("a huge size is clamped before geometry and builds fast, with a note", () => {
  const b = boundPrompt("bookshelf 9999 wide");
  assert.equal(b.prompt, "bookshelf 1200 wide");
  assert.match(b.note ?? "", /100 ft/);
  const t = Date.now();
  generateFromPrompt(b.prompt);
  assert.ok(Date.now() - t < 10_000);
  assert.equal(boundPrompt("deck 400 ft long").prompt, "deck 100 ft long");
  assert.equal(boundPrompt("linen closet 31.5 wide 78 tall 16 deep").note, undefined);
});

it("a 3,000-character prompt is cut to 1,500 before it builds, with a note", () => {
  const b = boundPrompt("a bookshelf ".repeat(270));
  assert.ok(b.prompt.length <= 1500 && /first 1500/.test(b.note ?? ""));
});
