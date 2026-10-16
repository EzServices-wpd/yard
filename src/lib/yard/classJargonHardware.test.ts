/** I11 jargon / template leftovers and I9 hardware-on-Buy, whole class over every sweep build (no xAI). */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild, JARGON } from "./invariants";
import { hardwareSaidNotBought, HARDWARE } from "./hardwareSaid";
import { takesGlides } from "./outdoor";

const corpus = [...new Set<string>(Object.values(SWEEPS).flatMap((s) => s.prompts))];
const userText = (q: string) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  return { p, plan, text: [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n") };
};

test("I11: no sweep build says engine jargon or another template's words (whole class)", () => {
  for (const q of corpus) {
    const { p, plan } = userText(q);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I11").map((x) => x.msg), [], q);
  }
});

test("I11: each jargon pattern catches the words Critic saw", () => {
  const seen = ["Walk around it on the bench (WASD + mouse look).", "Freestanding carcase — still square, still a cut list.", "214 joints · 307 members", "Face lace last — densified at the named stock.", "Guidance only — leash rail, not a Bridge / Tool / key portal steal.", "Not a closet. Not a dining table.", "Lace the Warren diagonals"];
  for (const t of seen) assert.ok(JARGON.some(([re]) => re.test(t)), t);
  assert.ok(!JARGON.some(([re]) => re.test("The apron is the rail under the front edge, not a cubby wall.")));
});

test("I11: Critic's six read plainly", () => {
  assert.doesNotMatch(userText("dog bed frame").text, /WASD/);
  assert.doesNotMatch(userText("model lighthouse").text, /\d+ joints ·|\d+ (?:short )?members/);
  assert.doesNotMatch(userText("garage storage shelves").text, /still square/);
  assert.doesNotMatch(userText("floating shelf 24 wide").text, /shelf into cleat/);
  assert.doesNotMatch(userText("rolling kitchen island").text, /closet/i);
  const seat = userText("window seat 60 wide");
  assert.doesNotMatch(seat.text, /shoe/i);
  assert.ok(seat.p.panels.some((x) => x.name === "Bottom shelf"));
  // A real entry bench keeps its shoe shelf.
  assert.ok(generateFromPrompt("mudroom bench 48 wide 18 high 16 deep").panels.some((x) => /Shoe shelf/.test(x.name)));
});

test("I9: no sweep build names hardware that Buy does not buy (whole class)", () => {
  for (const q of corpus) {
    const { p, plan } = userText(q);
    assert.deepEqual(hardwareSaidNotBought(p, plan), [], q);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I9").map((x) => x.msg), [], q);
  }
});

test("I9: one vocabulary; verbs and 'no X' are not hardware", () => {
  const plan = (said: string, bought = "") => ({ instructions: [{ step: 1, title: "x", description: said }], bom: bought ? [{ name: bought, quantity: 1, unit: "pack" }] : [] }) as never;
  const p = { notes: [] } as never;
  assert.deepEqual(hardwareSaidNotBought(p, plan("Pull any nails from reclaimed boards first.")), []);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Bend the arm and hinge it on the axle.")), []);
  assert.deepEqual(hardwareSaidNotBought(p, plan("No hinges: the lid lifts off.")), []);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Screw the two pulls to the drawer front.")), ["pull"]);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Hang it into studs or wall anchors.")), ["wall anchor"]);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Hang it into studs or wall anchors.", "#8 self-drilling wall anchors with screws, 20 pack")), []);
  assert.ok(HARDWARE.includes("wall anchor"));
});

test("I9: outdoor glides are said only when Buy has them (hung birdhouse, window box)", () => {
  for (const q of ["barn birdhouse", "window box", "birdhouse shaped like church", "adirondack chair", "picnic table"]) {
    const { p, plan, text } = userText(q);
    const buys = plan.bom.some((b) => /glides/i.test(b.name));
    assert.equal(/\bglides\b/i.test((p.notes ?? []).join(" ")), buys, q);
    assert.equal(takesGlides(p), buys, q);
    void text;
  }
});

test("linen stays exact", () => {
  const plan = buildPlan(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"));
  assert.equal(plan.totals.estCostUsd.toFixed(2), "183.70");
});
