/** Spec 007 C3 · typed noun as title (I24), and the longship is its own form. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { checkBuild } from "./invariants";
import { namedFormOf } from "./form";

test("C3/I24: the title keeps the typed head noun (whole class + C1 corpus)", () => {
  for (const q of new Set<string>([...SWEEPS.c3t.prompts, ...SWEEPS.c1.prompts, ...SWEEPS.l1.prompts])) {
    const p = generateFromPrompt(q);
    assert.deepEqual(checkBuild(p, q).filter((x) => x.id === "I24").map((x) => x.msg), [], q);
  }
});

test("C3: pirate ship is titled Pirate ship; viking ship / longship build the Longship, not the galleon", () => {
  assert.equal(generateFromPrompt("pirate ship").name, "Pirate ship");
  assert.equal(generateFromPrompt("galleon").name, "Galleon");
  for (const q of ["viking ship", "longship", "viking longship"]) assert.equal(namedFormOf(q), "Longship", q);
  assert.equal(namedFormOf("pirate ship"), "Sailing ship");
  const a = generateFromPrompt("longship"), b = generateFromPrompt("galleon");
  assert.ok(a.overall.width / a.overall.height > b.overall.width / b.overall.height, "longship is longer and lower than the galleon");
});
