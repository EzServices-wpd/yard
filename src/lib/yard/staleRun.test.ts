/**
 * Hotfix invariant (Critic B2 race): only the latest prompt's run may write. A late result from an older run
 * (learner recipe, rough shape, grey 'no parts' block, unavailable block, house brief, hint, interpret, the 22s
 * busy timer, the finally) never overwrites the newer build on the bench. Deferred promises hold the old run's
 * AI reply until the newer build is showing, then release it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// The 22s busy timers are held so a test can fire the ones still pending; every other timer is real.
const busyTimers = new Map<number, () => void>();
let fakeId = 1e9;
(globalThis as { window?: unknown }).window = {
  setTimeout: (fn: () => void, ms?: number) => {
    if (ms !== 22000) return setTimeout(fn, ms);
    const id = ++fakeId;
    busyTimers.set(id, fn);
    return id;
  },
  clearTimeout: (id: number) => (busyTimers.has(id) ? busyTimers.delete(id) : clearTimeout(id as never)),
  location: { search: "" },
};
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");
const { RECIPES } = await import("./recipes");
const { parseBrief } = await import("./fitted");

type Reply = unknown;
function deferred<T = Reply>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const snap = () => {
  const { project, plan } = useYard.getState();
  return JSON.stringify({ project, plan });
};

type Ai = Record<"lookupRecipe" | "hintSubject" | "interpretPrompt" | "briefHousePrompt" | "proposeRecipeFn", (...a: unknown[]) => Promise<unknown>>;
const quiet = (): Ai => ({
  lookupRecipe: async () => ({ ok: false, error: "bad" }),
  hintSubject: async () => ({ summary: "", subject: "" }),
  interpretPrompt: async () => ({ ok: false }),
  briefHousePrompt: async () => ({ ok: false }),
  proposeRecipeFn: async () => ({ status: "quiet" }),
});
/** One AI call held on a deferred; `reached` resolves once the old run is waiting on it. */
function held(call: keyof Ai) {
  const gate = deferred();
  const reached = deferred<void>();
  const ai = { ...quiet(), [call]: () => (reached.resolve(), gate.promise) } as Ai;
  return { gate, reached: reached.promise, ai: ai as never };
}

const bin = RECIPES.recipes.find((r) => r.key === "compost-bin")!;
const OLD_LEARN = "ukulele wall hanger";
// A prompt that reaches the hint and interpret calls (not engine-kept, not a house brief, not the learner). Row 51
// (#71) sends "storage cabinet" to the house brief now that "storage" is a read modifier, so this uses a builder's
// own words instead.
const HINT_PATH = "Adirondack chair from cedar";
const NEWER = "folding table";

/** Old run waits on `call`; the newer build lands; the old reply is released; the bench must not change. */
async function lateResultKeepsNewer(oldPrompt: string, call: keyof Ai, reply: Reply, opts: { boundMs?: number; newer?: string } = {}) {
  const newerPrompt = opts.newer ?? NEWER;
  const h = held(call);
  const old = runYardPrompt(oldPrompt, { fresh: true, ai: h.ai, boundMs: opts.boundMs });
  await h.reached;
  const fresh = await runYardPrompt(newerPrompt, { fresh: true, ai: quiet() as never });
  const shown = snap();
  assert.match(useYard.getState().project.name.toLowerCase(), new RegExp(`^${newerPrompt}`));
  h.gate.resolve(reply);
  const oldLive = await old;
  await settle();
  assert.equal(snap(), shown, `${oldPrompt} (${call}) wrote over the newer ${newerPrompt}`);
  assert.equal(fresh, true, "the newest run reports itself live");
  assert.equal(oldLive, false, "a superseded run reports itself stale so callers skip their writes");
}

describe("stale prompt results never overwrite a newer build", () => {
  it("learner recipe (final build) from an older prompt", async () => {
    // A passing recipe is remembered for its noun, so this case uses its own noun.
    const noun = "garden gnome house";
    await lateResultKeepsNewer(noun, "lookupRecipe", { ok: true, recipeJson: JSON.stringify({ ...bin, key: "x", title: noun }) });
  });
  it("learner rough shape from an older prompt", async () => {
    await lateResultKeepsNewer(OLD_LEARN, "lookupRecipe", { ok: false, error: "bad" });
  });
  it("learner 'unavailable' block from an older prompt", async () => {
    await lateResultKeepsNewer(OLD_LEARN, "lookupRecipe", { ok: false, error: "AI lookups not available" });
  });
  it("grey 'no parts' block after the learner bound runs out (the Critic repro)", async () => {
    // The bound is short here; on prod it is 160s against a 22s prompt-box re-enable.
    const h = held("lookupRecipe");
    const old = runYardPrompt(OLD_LEARN, { fresh: true, ai: h.ai, boundMs: 60 });
    await h.reached;
    await runYardPrompt(NEWER, { fresh: true, ai: quiet() as never });
    const shown = snap();
    await new Promise((r) => setTimeout(r, 150));
    await old;
    await settle();
    assert.equal(snap(), shown, "the timed-out learner block landed over the folding table");
    assert.doesNotMatch(useYard.getState().project.notes.join(" "), /ukulele/i);
    // Release the held reply so the lookup's own 145s call timer clears (prod aborts the fetch instead).
    h.gate.resolve({ ok: false, error: "bad" });
    await settle();
  });
  it("house brief from an older prompt", async () => {
    const brief = parseBrief("bookcase 40 wide 60 tall 12 deep");
    assert.ok(brief, "a brief to reply with");
    await lateResultKeepsNewer("bookcase", "briefHousePrompt", { ok: true, brief });
  });
  it("hint callback from an older prompt", async () => {
    // The hint branch re-reads the bench's form, so the newer build here is one the engine does not lock (umbrella
    // stand: no held-object row yet). "plant stand" builds its own stand family now (I34, row 76).
    await lateResultKeepsNewer(HINT_PATH, "hintSubject", { summary: "a tall box with legs and a top", subject: "cabinet" }, { newer: "umbrella stand" });
  });
  it("interpret callback from an older prompt", async () => {
    await lateResultKeepsNewer(HINT_PATH, "interpretPrompt", { ok: true, real: "Queried stale form", notes: "stale interpret note" });
  });
  it("an older run's finally and 22s timer never clear the newer run's busy state", async () => {
    busyTimers.clear();
    const a = held("lookupRecipe");
    const old = runYardPrompt(OLD_LEARN, { fresh: true, ai: a.ai });
    await a.reached;
    const b = held("hintSubject");
    const newer = runYardPrompt(HINT_PATH, { fresh: true, ai: b.ai });
    await b.reached;
    assert.equal(useYard.getState().grokBusy, true);
    // Every busy timer still armed fires (an older run's timer is armed only if the run was never cancelled).
    const newest = Math.max(...busyTimers.keys());
    for (const [id, fn] of [...busyTimers]) if (id !== newest) fn();
    assert.equal(useYard.getState().grokBusy, true, "an older run's 22s timer re-enabled the box during the newer lookup");
    a.gate.resolve({ ok: false, error: "bad" });
    await old;
    await settle();
    assert.equal(useYard.getState().grokBusy, true, "an older run's finally cleared the newer run's busy state");
    assert.match(useYard.getState().project.name, /^Adirondack chair/);
    b.gate.resolve({ summary: "", subject: "" });
    const newerLive = await newer;
    assert.equal(useYard.getState().grokBusy, false, "the latest run still clears its own busy state");
    assert.equal(newerLive, true);
  });
});
