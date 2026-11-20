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
    // A verb ends the noun phrase: the rack holds the bottles, it is not a "holds".
    ['wine rack holds 12 bottles', /^Wine rack\b/],
    ["dining table seats 6", /table/i],
  ] as const) assert.match(built(prompt).name ?? "", name, prompt);
});

test("the head noun picks the class on prompts the rule was not written against", () => {
  // None of these are the patch's examples. A class word before the head, or a purpose clause or a verb after it, is not the object.
  for (const [prompt, not, maxW] of [
    ["box for my plant stand", /^Plant stand\b/, 60],
    ["stand for a bread box", /^Bread\b/, 60],
    ["shelf to hold a lamp", /^Lamp\b/, 60],
    ["vanity stool", /^Vanity\b(?! stool)/, 60],
    ["bathroom vanity stool", /^Vanity\b(?! stool)/, 60],
    ["desk shelf", /^Desk\b(?! shelf)/, 60],
    ["wall desk shelf", /^(?:Floating desk|Desk)\b/, 60],
    ["table lamp", /^Table\b(?! lamp)/, 60],
    ["nightstand lamp", /^Nightstand\b(?! lamp)/, 60],
    ["outdoor bench box", /^Bench\b/, 60],
    ["bench box", /^Bench\b(?! box)/, 60],
    ["vanity organizer", /^Vanity\b(?! organizer)/, 60],
    ["bookcase holds 40 books", /^(?:Holds|Books)\b/, 60],
    ["cabinet that holds towels", /^Holds\b/, 60],
    ["bed sleeps 2", /^Sleeps\b/, 120],
  ] as const) {
    const p = built(prompt);
    assert.doesNotMatch(p.name ?? "", not, `${prompt} → ${p.name}`);
    assert.ok(p.overall.width < maxW, `${prompt}: ${p.name} is ${p.overall.width}" wide`);
  }
  // The title still names the typed object.
  assert.match(built("box for my plant stand").name ?? "", /^Box\b/);
  assert.match(built("stand for a bread box").name ?? "", /^Stand\b/);
  assert.match(built("shelf to hold a lamp").name ?? "", /\bshelf\b/i);
  assert.match(built("desk shelf").name ?? "", /^Desk shelf\b/);
  assert.match(built("table lamp").name ?? "", /^Table lamp\b/);
  assert.match(built("vanity organizer").name ?? "", /^Vanity organizer\b/);
  assert.match(built("bookcase holds 40 books").name ?? "", /^Bookcase\b/);
  assert.match(built("cabinet that holds towels").name ?? "", /^Cabinet\b/);
  assert.match(built("bed sleeps 2").name ?? "", /^Bed\b/);
  // A carcase that already owns the head, or a shelf/crate named for what it holds, stays that build.
  for (const [prompt, name] of [
    ["closet shelf organizer", /^Closet\b/],
    ["shelf for shoes", /\bshelf\b/i],
    ["crate for my records", /\bcrate\b/i],
  ] as const) assert.match(built(prompt).name ?? "", name, prompt);
});
