import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

const deck = (q: string) => generateFromPrompt(q).panels.find((p) => p.name === "Deck")!;
const deckTop = (q: string) => { const d = deck(q); return d.position.y + d.size.height; };

describe("a stand's height comes from what it holds", () => {
  it("a tumbler sits on a riser a few inches tall", () => assert.ok(deckTop("yeti tumbler stand") <= 6));
  it("a cooler stand is 18 to 24 in", () => { const h = deckTop("igloo cooler stand"); assert.ok(h >= 18 && h <= 24, String(h)); });
  it("a propane tank sits in a low cradle", () => {
    const p = generateFromPrompt("20lb propane tank stand");
    assert.ok(deckTop("20lb propane tank stand") <= 6);
    assert.equal(p.panels.filter((x) => /^Cradle /.test(x.name)).length, 4);
  });
  it("a typed height wins without a unit", () => assert.equal(deckTop("cooler stand 30 tall"), 30));
});
