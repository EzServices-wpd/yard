/**
 * The typed head noun (and its purpose words) pick the closest form the engine already has.
 * A related family does not win, and the title does not swap in that family's name.
 * Siblings of the reported nouns are here on purpose: a patch that only rewrites "fort" or "toolbox" fails them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { checkBuild } from "./invariants";
import { isCarryTote } from "./realObjects";
import { titleKeepsHead } from "./headNoun";

const HAND = /hand hold/i;
const handHold = (q: string) => generateFromPrompt(q).panels.some((p) => HAND.test(p.cutNote ?? ""));
const roofOrDoor = (q: string) => generateFromPrompt(q).panels.some((p) => /^(?:roof|front wall|door)$/i.test(p.name));

test("a form label that lacks the typed head keeps the matched words, and a label that already says the head stays", () => {
  assert.equal(titleKeepsHead("fort", "Castle", "fort"), "Fort");
  assert.equal(titleKeepsHead("fire engine", "Truck", "fire engine"), "Fire engine");
  assert.equal(titleKeepsHead("castle", "Castle", "castle"), "Castle");
  assert.equal(titleKeepsHead("steam train", "Train engine", "train"), "Train engine");
  // The label already says the head ("ship"). The sailing-ship title path keeps the fuller typed phrase on its own.
  assert.equal(titleKeepsHead("pirate ship", "Sailing ship", "pirate ship"), "Sailing ship");
  assert.equal(generateFromPrompt("pirate ship").name, "Pirate ship");
});

test("fort and the same alias class are titled with the typed noun, on the castle form, and I24 is quiet", () => {
  for (const q of ["fort", "PVC pipe fort for kids", "fire engine", "paper fort"]) {
    const p = generateFromPrompt(q);
    const head = q.includes("fire") ? "engine" : "fort";
    assert.match(p.name, new RegExp(head, "i"), q);
    assert.equal(p.name, p.name.replace(/^Castle\b/, "nope"), `${q} titled a Castle`);
    if (head === "fort" && q !== "paper fort") assert.match((p.notes ?? []).join(" "), new RegExp(`^${p.name.split(" ")[0]} · towers block`));
    assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I24").map((v) => v.msg), [], q);
  }
  const castle = generateFromPrompt("castle");
  assert.match(castle.name, /^Castle\b/);
  assert.match((castle.notes ?? []).join(" "), /^Castle · towers block/);
});

test("a carry head is the open tote with a hand hold, not the house carcase", () => {
  for (const q of ["toolbox", "toolbox tote", "tool box", "tackle box", "sewing tote", "garden tote"]) {
    assert.equal(isCarryTote(q), true, q);
    const p = generateFromPrompt(q);
    assert.match(p.name, new RegExp(q.split(" ").pop()!.replace(/s$/, ""), "i"), p.name);
    assert.ok(handHold(q), `${q} has no hand hold`);
    assert.equal(roofOrDoor(q), false, `${q} built a house`);
    assert.ok(!p.standIn, q);
    assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I24").map((v) => v.msg), [], q);
  }
});

test("a box that is not a carry tote keeps its own form", () => {
  for (const q of ["bread box", "planter box", "toy box", "sandbox", "castle"]) assert.equal(isCarryTote(q), false, q);
  assert.equal(handHold("bread box"), false);
  assert.equal(handHold("planter box"), false);
  assert.match(generateFromPrompt("planter box").name, /Planter box/);
});

test("a placeholder head plus a racked object builds that rack, not the object itself", () => {
  const q = "something to store my bikes";
  const p = generateFromPrompt(q);
  assert.match(p.name, /rack/i, p.name);
  assert.doesNotMatch(p.name, /^Bicycle\b/);
  assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I24").map((v) => v.msg), [], q);
  assert.match(generateFromPrompt("something to hang my keys").name, /peg|key/i);
  assert.match(generateFromPrompt("somewhere to store my shoes").name, /shoe/i);
});
