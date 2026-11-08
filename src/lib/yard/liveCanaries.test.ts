/**
 * Hotfix gate: the real bar handler (runYardPrompt, AI stubbed) on the weekend canaries, linen, ship, pirate ship and
 * keys. An engine-owned shape always wins; the learner runs only when no form exists. Engine-only checks
 * (weekend-canaries.test) missed this: the live bar sent 5 of 6 canaries to "Not learned yet".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { headerTitle } from "./pdf"; // before the window stub (jspdf reads the real global)

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");
const { generateFromPrompt, ignoredTypedWords } = await import("./promptMain");
const { engineKeepsPrompt } = await import("./formOwnership");
const { buildPlan } = await import("./report");
// Same list as scripts/weekend-canaries.ts CANARIES (that module pulls in the eval harness).
const CANARIES = ["big ben", "eiffel tower", "brooklyn bridge", "trebuchet", "submarine", "water wheel"];

const stubs = (calls: string[]) => ({
  lookupRecipe: (async () => (calls.push("lookup"), { ok: false, error: "bad" })) as never,
  hintSubject: (async () => (calls.push("hint"), { summary: "", subject: "" })) as never,
  interpretPrompt: (async () => (calls.push("interp"), { ok: false })) as never,
  briefHousePrompt: (async () => (calls.push("house"), { ok: false })) as never,
  proposeRecipeFn: (async () => (calls.push("propose"), { status: "quiet" })) as never,
});

// Any network call (a server function, Wikipedia, xAI) goes through fetch: record it.
const realFetch = globalThis.fetch;
async function live(q: string) {
  const calls: string[] = [];
  globalThis.fetch = (async (u: unknown) => (calls.push(`fetch ${String(u)}`), new Response("{}", { status: 503 }))) as typeof fetch;
  try {
    await runYardPrompt(q, { fresh: true, ai: stubs(calls) });
  } finally {
    globalThis.fetch = realFetch;
  }
  return { p: useYard.getState().project, calls };
}
const parts = (p: { panels: unknown[]; instances?: unknown[] }) => p.panels.length + (p.instances?.length ?? 0);

describe("live bar: engine forms before the learner", () => {
  for (const q of CANARIES) {
    it(`canary ${q}: the bench shows the engine build, never Not learned yet`, async () => {
      const { p, calls } = await live(q);
      const e = generateFromPrompt(q);
      assert.ok(!calls.includes("lookup"), `${q} went to the learner`);
      // Cost leak: an engine-owned prompt makes no AI or network call at all (no hint, interpret, house, fetch).
      assert.deepEqual(calls, [], `${q} made calls: ${calls.join(", ")}`);
      assert.ok(!p.displayOnly, `${q} is display-only`);
      assert.deepEqual([p.name, parts(p)], [e.name, parts(e)], q);
    });
  }
  // On main the form library and purpose resolver (release-18, #37) are not in yet: "pirate ship" reads as a Boat with
  // "pirate" ignored and "keys" matches no class. The invariant is the same either way: the learner runs exactly
  // when the engine owns no form for the prompt.
  for (const q of ["ship", "pirate ship", "something to hang my keys"]) {
    it(`${q}: the learner runs only when the engine owns no form`, async () => {
      const e = generateFromPrompt(q);
      const owned = engineKeepsPrompt(q, e, ignoredTypedWords(e, q).length > 0);
      const { p, calls } = await live(q);
      assert.equal(calls.includes("lookup"), !owned, `${q}: owned=${owned} lookup=${calls.includes("lookup")}`);
      if (owned) {
        assert.ok(!p.displayOnly, `${q} is display-only`);
        assert.deepEqual(calls, [], `${q} made calls: ${calls.join(", ")}`);
      }
    });
  }
  it("linen closet: exact header and $193.68 on the live bar", async () => {
    const { p, calls } = await live("linen closet 31.5 wide 78 tall 16 deep");
    assert.ok(!calls.includes("lookup"));
    // C10: every size is typed, so no house brief (or any network call) holds the lamp or reprices the plan.
    assert.deepEqual(calls, [], `linen made calls: ${calls.join(", ")}`);
    assert.equal(useYard.getState().plan?.totals.estCostUsd, 193.68);
    assert.equal(headerTitle(p).split(" · ").slice(0, 2).join(" · "), 'Linen · 31 1/2" W × 16" D × 78" H');
    assert.equal(buildPlan(p).totals.estCostUsd, 193.68);
  });
});
