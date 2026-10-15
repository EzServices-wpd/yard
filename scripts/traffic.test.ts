import assert from "node:assert/strict";
import test from "node:test";
import { designKey } from "../src/lib/yard/designKey.ts";
import { timedLookup, lookupAndBuild, UNAVAILABLE } from "../src/lib/yard/recipeBuild.ts";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";

test("one design key per prompt and size; a different size is a different design", () => {
  assert.equal(designKey("A lap desk 24 inches wide"), designKey("lap desk, 24in wide"));
  assert.notEqual(designKey("lap desk 24 wide"), designKey("lap desk 30 wide"));
});

test("the daily cap or an xAI error makes one call, then the engine build (no error, no second call)", async () => {
  for (const error of ["That's today's free AI lookups for this visitor.", "xAI API error 503"]) {
    let calls = 0;
    const lookup = timedLookup(async () => { calls++; return { ok: false, error }; });
    await assert.rejects(lookup("x", undefined), new RegExp(UNAVAILABLE));
    const out = await lookupAndBuild("glowing widget stand", timedLookup(async () => ({ ok: false, error })), () => generateFromPrompt("shelf"));
    assert.ok(out.unavailable && !out.recipe, error);
    assert.equal(calls, 1);
  }
});
