/**
 * Spec 007 L1 · live path: the real bar handler (runYardPrompt) with the AI stubbed. A prompt the engine can build
 * from its purpose resolver or form library never reaches the learner, so it never shows "Not learned yet".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");
const { SWEEPS } = await import("../../../scripts/class-sweep-prompts");

const stubs = (calls: string[]) => ({
  lookupRecipe: (async () => (calls.push("lookup"), { ok: false, error: "bad" })) as never,
  hintSubject: (async () => ({ summary: "", subject: "" })) as never,
  interpretPrompt: (async () => ({ ok: false })) as never,
  briefHousePrompt: (async () => ({ ok: false })) as never,
  proposeRecipeFn: (async () => ({ status: "quiet" })) as never,
});

describe("live path: engine forms never reach the learner", () => {
  for (const q of ["ship", "pirate ship", "something to hang my keys", ...SWEEPS.c1.prompts]) {
    it(q, async () => {
      const calls: string[] = [];
      await runYardPrompt(q, { fresh: true, ai: stubs(calls) });
      const p = useYard.getState().project;
      assert.ok(!calls.includes("lookup"), `${q} went to the learner`);
      assert.ok(!p.displayOnly, `${q} shows Not learned yet`);
    });
  }
});
