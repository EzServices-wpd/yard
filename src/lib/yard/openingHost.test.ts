/**
 * Opening clearance runs only for a build placed in a typed or recipe-declared host.
 * A freestanding object's own envelope is not an opening, whatever its noun.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const TIGHT = "Opening is tight — confirm the measure before you cut.";

function messages(prompt: string): string[] {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const text = [
    ...plan.feasibility.issues.map((i) => i.message),
    ...plan.instructions.map((s) => `${s.title} ${s.description}`),
    ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`),
    ...(project.notes ?? []),
  ];
  return text;
}

function warns(prompt: string): boolean {
  return messages(prompt).some((m) => m.includes(TIGHT));
}

test("freestanding builds carry no opening warning", () => {
  const freestanding = [
    // Carry crates from the nightly class, plus siblings a noun patch would miss.
    "pine 1x6 toolbox 18 long",
    "cedar 1x6 tote 18 long",
    "fishing caddy",
    "tool caddy",
    "garden tote",
    "tackle box",
    "trug",
    "beach caddy 16 long",
    "kid toolbox",
    // Other freestanding objects whose envelope is under the opening minima.
    "bench 30 wide 10 tall",
    "garden bench",
    "planter box 18 long 8 tall",
    "cedar planter box 24 long",
    "bookcase 10 wide",
    "bookcase 30 wide 48 tall 6 deep",
    "birdhouse",
    "sandbox",
    "phone stand",
    "drying rack 6 wide",
    // Wall-hung pieces whose builder copies the envelope onto an opening are still not hosts.
    "organize my tools",
    "shoe rack by the door",
    "something to hang my keys",
    "spice rack",
    "medicine cabinet",
    "floating shelf",
  ];
  const hit = freestanding.filter(warns);
  assert.deepEqual(hit, []);
});

test("a typed opening that is actually tight still warns, and a roomy one does not", () => {
  const tight = [
    "built-in bookcase 10 wide 30 tall 12 deep",
    "bookshelf fitted to a 10 x 40 x 12 opening",
    "bookcase between the walls 10 wide",
    "nook shelf 10 wide 24 tall 8 deep",
    // A closet, a gap, a pocket or a doorway is a host too, even when the fitted kind reads "room".
    "shelves for a closet 10 wide 30 tall 12 deep",
    "closet organizer for a 30 x 80 x 6 closet",
    "shelf for a pocket 9 wide 20 tall 6 deep",
    "shelf in a doorway 10 wide",
    "rolling pantry for the gap between the fridge and the wall 6 wide",
    "linen closet 10 wide 30 tall 6 deep",
  ];
  for (const q of tight) {
    const found = messages(q).filter((m) => m.includes("Opening is tight"));
    assert.deepEqual(found, [TIGHT], q);
  }
  for (const q of [
    "built-in bookcase 36 wide 84 tall 12 deep",
    "bookshelf fitted to a 36 x 80 x 12 opening",
    "recessed cabinet 8 deep",
    // A roomy typed width with an untyped depth: the 4 1/2" is the cabinet's own default, not the hole.
    "spice cabinet in a 30 inch recess",
    "medicine cabinet for a 30 inch niche",
    "coat rack in a 48 inch alcove",
    "linen closet 31.5 wide 78 tall 16 deep",
    "pocket vanity",
    "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    "3 foot Eiffel Tower from popsicle sticks",
    "cat tree",
    "step stool",
  ]) {
    assert.equal(warns(q), false, q);
  }
});
