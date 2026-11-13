/**
 * The typed head noun (and its purpose words) pick the closest form the engine already has.
 * A related family does not win, and the title does not swap in that family's name.
 * Siblings of the reported nouns are here on purpose: a patch that only rewrites "fort" or "toolbox" fails them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { isCarryTote, carryBoard, carryStockBlocks } from "./realObjects";
import { resolvePurpose } from "./purposeForms";
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

test("B1: a typed 1x board sets the walls, a typed height is kept, and other stock falls back", () => {
  const six = generateFromPrompt("1x6 toolbox");
  assert.equal(six.primaryMaterialId, "lumber-1x6-8");
  assert.equal(six.overall.height, 5.5);
  assert.ok(six.panels.filter((p) => /end|side/i.test(p.name)).every((p) => p.materialId === "lumber-1x6-8"));
  const four = generateFromPrompt("1x4 garden tote");
  assert.equal(four.primaryMaterialId, "lumber-1x4-8");
  assert.equal(four.overall.height, 3.5);
  const tall = generateFromPrompt("toolbox 5 tall");
  assert.equal(tall.overall.height, 5);
  assert.equal(tall.primaryMaterialId, "lumber-1x8-8");
  const plyT = 0.5;
  const bottom = generateFromPrompt("toolbox").panels.find((p) => p.name === "Bottom")!;
  assert.equal(bottom.materialId, "plywood-1-2-4x8");
  assert.equal(bottom.size.height, plyT);
  for (const q of ["toolbox from plywood", "pvc toolbox", "oak toolbox", "toolbox from 2x4", "1x6x8 toolbox", "toolbox 18x16x18", "toolbox 18 by 10 by 8", "caddy 12x8x6"]) {
    assert.equal(isCarryTote(q), false, q);
    assert.equal(carryStockBlocks(q), true, q);
  }
  const again = generateFromPrompt("toolbox", "lumber-1x8-8");
  assert.equal(again.primaryMaterialId, "lumber-1x8-8");
  assert.equal(generateFromPrompt("1x4 toolbox", "lumber-1x8-8").primaryMaterialId, "lumber-1x4-8");
  assert.ok(again.panels.some((p) => /hand hold/i.test(p.cutNote ?? "")));
  assert.equal(carryBoard("toolbox", "lumber-1x6-8").id, "lumber-1x6-8");
  assert.notEqual(generateFromPrompt("toolbox", "plywood-3-4-4x8").primaryMaterialId, "lumber-1x8-8");
});

test("B2: bike, kayak, towel and spool stand-ins keep the release build; a real rack still resolves", () => {
  for (const q of ["something to store my bikes", "something to store my kayak", "something to store my towels", "something to store my spools"]) {
    assert.equal(resolvePurpose(q), null, q);
  }
  assert.equal(resolvePurpose("something to store my magazines")?.form, "magazine rack");
  assert.equal(resolvePurpose("something to store my shoe"), null);
  assert.match(generateFromPrompt("something to store my bikes").name, /^Bicycle\b/);
  assert.match(generateFromPrompt("something to store my shoe").name, /Shoe rack 36/);
  assert.match(generateFromPrompt("something to hang my keys").name, /peg|key/i);
});

test("B3: a hod or a shower or bath caddy is not a carry box", () => {
  for (const q of ["hod", "coal hod", "shower caddy", "bath caddy"]) assert.equal(isCarryTote(q), false, q);
  assert.equal(isCarryTote("tool caddy"), true);
  assert.equal(isCarryTote("trug"), true);
});

test("B1: a wardrobe or armoire tote is the carry box, not an empty refusal, and toolbox box is that box", () => {
  for (const q of ["wardrobe tote", "armoire tote", "wardrobe caddy", "toolbox box", "sawbuck tote"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.refused, undefined, q);
    assert.ok(p.panels.length >= 5, q);
    assert.ok(p.panels.some((panel) => /hand hold/i.test(panel.cutNote ?? "")), q);
  }
  const saw = generateFromPrompt("sawbuck");
  assert.equal(saw.panels.some((panel) => /hand hold/i.test(panel.cutNote ?? "")), false);
});

test("B4: a hand-hold carry box gets no glides and no glide sentence", () => {
  for (const q of ["garden tote", "trug", "toolbox"]) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const text = [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => b.name)].join("\n");
    assert.equal(plan.bom.some((b) => /glide/i.test(b.name)), false, q);
    assert.doesNotMatch(text, /glides under the feet/i, q);
    assert.ok(p.panels.some((panel) => /hand hold/i.test(panel.cutNote ?? "")), q);
  }
});
