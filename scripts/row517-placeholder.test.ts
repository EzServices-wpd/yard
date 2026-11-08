/**
 * Row 517 (sweep 10-26): a prompt Yard couldn't learn shows the grey placeholder; pressing Build again (the morph
 * button, which a walker clicks as "Get the plan") used to rebuild the placeholder's leftover engine guess and price a
 * different object (toolbox → Planter box $50.43, lattice tower → a plywood lattice). Driven through the real store
 * the way run-prompt does: first build, the not-learned block, then the same words again.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { roughBlock, roughNote } from "../src/lib/yard/recipeBuild";
import { engineKeepsPrompt, routesToLearner } from "../src/lib/yard/formOwnership";
import { ignoredTypedWords } from "../src/lib/yard/promptMain";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { useYard } = await import("../src/lib/yard/store");

// run-prompt's learner gate (learn0), minus the unit-item and pocket checks these prompts never hit.
const learns = (q: string) => {
  const p = useYard.getState().project;
  const half = ignoredTypedWords(p, q).length > 0;
  return !engineKeepsPrompt(q, p, half) && routesToLearner(q, p, half);
};

for (const q of ["toolbox", "toolbox 18x16x18", "lattice tower 24.5 tall"]) {
  test(`${q}: Build again on the not-learned placeholder learns the typed object again, never a different priced build`, () => {
    useYard.getState().reset();
    useYard.getState().generate(q, undefined, undefined, { fresh: true });
    const first = useYard.getState().project;
    assert.ok(learns(q), "the first build goes to the learner (the placeholder case)");
    const b = roughBlock(q, first);
    useYard.getState().setProject({ ...b, notes: [roughNote(b.name, []), ...(b.notes ?? [])] });
    assert.equal(useYard.getState().project.displayOnly, true);
    useYard.getState().generate(q); // the second press: same words, no fresh flag (the bar's repeat)
    const again = useYard.getState().project;
    assert.equal(again.prompt, first.prompt, "rebuilt from the typed words, the same as the first build");
    assert.ok(learns(q), `the learner gate holds, so the page shows the placeholder again (got ${again.name})`);
  });
}
