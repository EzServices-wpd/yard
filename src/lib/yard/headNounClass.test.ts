import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";

const built = (prompt: string) => generateFromPrompt(prompt);

test("a modifier word never picks the class: the head noun does", () => {
  // The head noun names the object; the word before it only says where or what for.
  for (const [prompt, not] of [
    ["desk organizer", /^Desk\b(?! organizer)/],
    ["outdoor deck storage box", /^Deck\b/],
    ["kitchen table bench", /^Table\b/],
    ["bench cushion box", /^Bench\b/],
    ["desk lamp", /^Desk\b(?! lamp)/],
    ["table runner", /^Table\b(?! runner)/],
  ] as const) {
    const p = built(prompt);
    assert.doesNotMatch(p.name ?? "", not, prompt);
    assert.ok(p.overall.width < 60, `${prompt}: ${p.overall.width}" wide`);
  }
  // The title still says what was typed.
  assert.match(built("desk organizer").name ?? "", /^Desk organizer\b/);
});

test("a build that owns the head noun, or a storage carcase answering to a storage noun, is kept", () => {
  for (const [prompt, name] of [
    ["closet organizer", /^Closet\b/],
    ['wine rack cabinet', /^Wine rack\b/],
    ["over-toilet shelf", /^Over-toilet\b/],
    ["linen closet", /^Linen\b/],
    ["dog bed frame", /^Dog bed\b/],
    ['spice rack wall mounted', /^Spice rack\b/],
    ["toy box", /^Toy chest\b/],
    ["garden bench", /^Garden bench\b/],
    ["cardboard rocket ship", /^Rocket\b/],
    // A longer phrase trusts only a real class of its last word: a label, count or feature is never the object.
    ["desk tray organizer", /^Desk\b/],
    ["vanity table", /^Vanity\b/],
    ["garage wall cabinet no doors 48 wide 30 tall 12 deep", /cabinet/i],
  ] as const) assert.match(built(prompt).name ?? "", name, prompt);
});
