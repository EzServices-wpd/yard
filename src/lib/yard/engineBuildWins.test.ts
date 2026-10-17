/**
 * Row 51 (P1, Critic verify-grok100 2026-10-17): when the engine has a complete build, the live bar shows it and the
 * learner never replaces it. The engine built these well, but the bar threw them away for the grey 'couldn't learn'
 * block because one typed modifier (a finish, wheels, a fit, a place, a size cue, what it holds) did not change the
 * build's piece count and so counted as a half-read noun.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");
const { generateFromPrompt, ignoredTypedWords } = await import("./promptMain");
const { genericFormMark } = await import("./formOwnership");
const { UNIT_ITEM_NOTE } = await import("./unitItems");
const { corpus, EVAL_PROMPTS } = await import("../../../scripts/invariants-corpus");
const { SWEEPS } = await import("../../../scripts/class-sweep-prompts");

/** The six Critic rows: the engine builds each one well (Bookcase 10 parts, Kitchen island, Chest, Closet, ...). */
const CRITIC_ROWS = [
  "black painted bookshelf 24x8x48",
  "rolling kitchen island",
  "blanket chest",
  "closet organizer 60",
  "fitted bookcase 42 under stairs",
  "nook shelves 30 for pantry",
];
/** Corpus rows the same gate threw away: a size cue, a purpose word or a carcase noun on a full engine build. */
const CORPUS_ROWS = [
  "about knee high bench",
  "waist high workbench",
  "as wide as a queen bed bench",
  "a full sheet of plywood table",
  "about waist high console",
  "chest high cabinet",
  "garage storage shelves",
  "over the toilet cabinet 27 wide 68 high 9 deep",
];
/** Critic f06: the engine builds a cardboard Rocket (16 parts); "ship" is the same object, not a half-read. */
const NIGHTLY_ROWS = ["cardboard rocket ship"];
/** C14 on release: bird feeder (11 parts) and rolling cart (Utility cart, 11 parts) are real engine forms now, so they must show. */
const C14_ROWS = ["bird feeder", "rolling cart"];
/**
 * Honest learner rows: the engine has no complete build, so the learner still runs. Step ladder is a simple
 * stand-in, play kitchen is an unmatched body, sandbox with lid is unasked popsicle stock.
 */
const HONEST_LEARNER = ["sandbox with lid", "play kitchen", "step ladder"];
/**
 * Critic 10-17 (live P1 after #71): these went from the honest grey block to the generic 36" × 30" × 16" fallback box.
 * A build wins over the learner only when it is the asked-for form, never the fitted storage fallback's bare carcase
 * (uprights or sides, back, top or front, bottom) with a title that only repeats the prompt.
 */
const NOT_GENERIC = [
  "cedar boot tray", "under-stairs storage", "outdoor wall planter box", "wall mounted outdoor planter",
  // Critic #79 (174aeca): the same box on casters is still the generic box.
  "rolling under-stairs storage", "rolling thing for hanging coats", "mobile under-stairs storage", "under-stairs storage on casters", "rolling outdoor wall planter box",
];
/** The rule is not "never the box": a plain storage ask and the planter stem's own nouns (planter, raised bed) keep it. */
const BOX_OWNS = ["storage unit", "cedar 2x4 planter 3 feet", "cedar raised garden bed 4x8", "raised garden bed 48 wide 96 long"];
const GENERIC_BOX_PART = /^(?:(?:left|right)\s+(?:upright|side)|back|top|front|bottom)$/i;
/** What the casters step adds (C13): casters are hardware under the box, never part of its form. */
const CASTER_PART = /^caster\b/i;
/** The generic fallback body: a storage-program carcase made only of the bare box parts (casters or not). */
function genericBox(p: ReturnType<typeof generateFromPrompt>) {
  const body = p.panels.filter((x) => !CASTER_PART.test(x.name ?? ""));
  return p.kind === "closet" && p.fitted?.program === "storage" && !(p.instances ?? []).length && body.length > 0 &&
    body.every((x) => GENERIC_BOX_PART.test(x.name ?? ""));
}
/** A word that changes the object still learns: the fix is not "never learn". */
const STILL_LEARN = ["lap desk", "standing desk", "desk organizer", "hanging planter", "chicken tractor", "cold frame", "tabletop loom", "wall clock"];

function stubs(calls: string[]) {
  return {
    lookupRecipe: (async () => (calls.push("lookup"), { ok: false, error: "bad" })) as never,
    hintSubject: (async () => ({ summary: "", subject: "" })) as never,
    interpretPrompt: (async () => ({ ok: false })) as never,
    briefHousePrompt: (async () => ({ ok: false })) as never,
    proposeRecipeFn: (async () => ({ status: "quiet" })) as never,
  };
}
const craftAsked = /popsicle|craft|stick|toy|model|miniature|kids?'? craft/i;
/** A complete engine build: a real form with parts, not a placeholder, stand-in, unmatched body or unasked craft stock. */
function complete(q: string) {
  const p = generateFromPrompt(q);
  const parts = p.panels.length + p.instances.length;
  const ok = !genericFormMark(p) && !genericBox(p) && !p.standIn && !p.unmatched && !p.displayOnly && parts >= 2 &&
    !(/popsicle|craft|stick/i.test(p.primaryMaterialId ?? "") && !craftAsked.test(q));
  return { p, ok };
}
async function shows(q: string) {
  const calls: string[] = [];
  await runYardPrompt(q, { fresh: true, ai: stubs(calls) });
  return { calls, p: useYard.getState().project };
}
function assertEngineShown(q: string, engine: ReturnType<typeof generateFromPrompt>, got: Awaited<ReturnType<typeof shows>>) {
  assert.ok(!got.calls.includes("lookup"), `${q}: the bar called the learner over a complete ${engine.name}`);
  assert.ok(!got.p.displayOnly && !genericFormMark(got.p), `${q}: shows '${genericFormMark(got.p)}' instead of ${engine.name}`);
  assert.doesNotMatch(got.p.notes.join(" "), /couldn.t learn|is learning/i, q);
  assert.equal(got.p.name, engine.name, q);
  assert.equal(got.p.panels.length + got.p.instances.length, engine.panels.length + engine.instances.length, q);
}

describe("row 51: a complete engine build always shows; the learner never replaces it", () => {
  for (const q of [...CRITIC_ROWS, ...CORPUS_ROWS, ...NIGHTLY_ROWS, ...C14_ROWS]) {
    it(q, async () => {
      const { p, ok } = complete(q);
      assert.ok(ok, `${q}: the engine build is complete (${p.name}, ${p.panels.length + p.instances.length} parts)`);
      assertEngineShown(q, p, await shows(q));
    });
  }
  it("every corpus prompt with a complete engine build that reads every typed word shows it, never the learner", async () => {
    const all = [...new Set([...corpus(), ...EVAL_PROMPTS, ...Object.values(SWEEPS).flatMap((s) => s.prompts), ...CRITIC_ROWS, ...NIGHTLY_ROWS, ...C14_ROWS, ...HONEST_LEARNER])];
    let checked = 0;
    for (const q of all) {
      const { p, ok } = complete(q);
      if (!ok || ignoredTypedWords(p, q).length || (p.notes ?? []).some((n) => n.startsWith(UNIT_ITEM_NOTE))) continue;
      checked++;
      const got = await shows(q);
      assert.ok(!got.calls.includes("lookup"), `${q}: learner called over a complete ${p.name}`);
      assert.ok(!got.p.displayOnly, `${q}: grey block over a complete ${p.name}`);
    }
    assert.ok(checked > 100, `only ${checked} corpus prompts checked`);
  });
  for (const q of HONEST_LEARNER) {
    it(`${q}: no complete engine build, so it stays an honest learner row`, async () => {
      const { p, ok } = complete(q);
      assert.ok(!ok, `${q}: the engine now builds a complete ${p.name}; move it to the rows that must show`);
      assert.ok((await shows(q)).calls.includes("lookup"), q);
    });
  }
  for (const q of STILL_LEARN) {
    it(`${q}: a word that changes the object still goes to the learner`, async () => {
      const got = await shows(q);
      assert.ok(got.calls.includes("lookup"), `${q} kept the engine's ${generateFromPrompt(q).name}`);
    });
  }
  for (const q of NOT_GENERIC) {
    it(`${q}: never the generic fallback box over the learner`, async () => {
      const got = await shows(q);
      assert.ok(!genericBox(got.p), `${q}: the bar shows the generic ${got.p.name} (${got.p.panels.map((x) => x.name).join(", ")})`);
      assert.ok(got.calls.includes("lookup"), `${q}: the learner never ran`);
    });
  }
  for (const q of BOX_OWNS) {
    it(`${q}: the asked-for box still shows, no learner`, async () => {
      const got = await shows(q);
      assert.ok(!got.calls.includes("lookup") && !got.p.displayOnly, `${q}: learner over the asked-for ${generateFromPrompt(q).name}`);
    });
  }
});
