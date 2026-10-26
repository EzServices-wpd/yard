// PR 10 (plan L631): the Watch it build scrubber reads the plan's own step order from buildOrder, never
// touches parts, price or plan text, keeps the scale figure and props (#176) out, and its last position is
// the default finished frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { buildOrder } from "../src/components/workspace/build-order";
import { playGap, scrubLabel, scrubShown, scrubState, scrubTrack, setScrub, subscribeScrub } from "../src/components/workspace/build-scrub";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const planJson = (p: object) => JSON.stringify({ ...p, generatedAt: undefined });
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};
const CASES = [
  { prompt: "linen closet 31.5 wide 78 tall 16 deep", pieces: 11 },
  { prompt: "bookshelf 36 wide 72 tall 12 deep" },
  { prompt: "3 ft popsicle stick eiffel tower" },
];

for (const c of CASES) {
  test(`${c.prompt}: beats follow the plan's step order, straight from buildOrder`, () => {
    const project = generateFromPrompt(c.prompt);
    const plan = buildPlan(project);
    const track = scrubTrack(project, plan);
    assert.ok(track, "a built plan gets a scrubber");
    const order = buildOrder(project, plan);
    assert.deepEqual([...track.at], [...order.at], "the part-to-beat map is buildOrder's own, entry for entry");
    assert.deepEqual(track.beats.map((b) => b.step), order.steps.map((s) => plan.instructions[s].step), "one beat per buildOrder beat");
    const nums = track.beats.map((b) => b.step);
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b), "beats run in Steps order");
    assert.equal(new Set(nums).size, nums.length, "no step twice");
    for (const b of track.beats) assert.equal(b.title, plan.instructions.find((s) => s.step === b.step)!.title, "the label is the plan's own step title");
    assert.match(scrubLabel(track, 1), new RegExp(`^Step ${nums[0]} of ${plan.instructions.length}: `));
    for (const id of track.ids) assert.ok(track.at.get(id)! < track.beats.length, `${id} lands on a real beat`);
  });

  test(`${c.prompt}: parts only accumulate, and the last position is the default finished frame`, () => {
    const project = generateFromPrompt(c.prompt);
    const track = scrubTrack(project, buildPlan(project))!;
    const n = track.beats.length;
    const all = [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)];
    assert.deepEqual([...track.ids].sort(), [...all].sort(), "every part of the model is in the scrub, nothing else (no prop, no figure)");
    let prev = new Set<string>();
    for (let k = 1; k < n; k++) {
      const shown = scrubShown(track, k)!;
      assert.ok(shown, `position ${k} of ${n} draws a partial build`);
      for (const id of prev) assert.ok(shown.has(id), `a part shown at ${k - 1} stays at ${k}`);
      assert.ok(shown.size < all.length, `position ${k} is not yet the whole build`);
      prev = shown;
    }
    assert.ok(scrubShown(track, 1)!.size > 0, "step 1 already places wood");
    // null is exactly what the bench draws with no reveal and no scrub: the default full-build frame.
    assert.equal(scrubShown(track, n), null, "scrub-to-final renders the default frame");
    assert.equal(scrubShown(track, n + 3), null);
    assert.equal(all.filter((id) => track.at.get(id)! < n).length, all.length, "every part is wood by the last step");
  });

  test(`${c.prompt}: reading the scrub never mutates parts, price or plan`, () => {
    const project = generateFromPrompt(c.prompt);
    const plan = buildPlan(project);
    const before = { project: JSON.stringify(project), plan: planJson(plan), pieces: plan.totals.pieces, price: JSON.stringify(plan.totals) };
    deepFreeze(project);
    deepFreeze(plan); // frozen: any write would throw
    const track = scrubTrack(project, plan)!;
    for (let k = 0; k <= track.beats.length + 1; k++) { scrubShown(track, k); scrubLabel(track, k); }
    assert.equal(JSON.stringify(project), before.project, "the project is untouched");
    assert.equal(planJson(plan), before.plan, "the plan (Buy, cuts, steps, price) is untouched");
    assert.equal(JSON.stringify(buildPlan(generateFromPrompt(c.prompt)).totals), before.price);
    if (c.pieces) assert.equal(plan.totals.pieces, c.pieces, "linen canary keeps its 11 parts");
  });
}

test("no plan, or a one-beat plan: no scrubber", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(scrubTrack(project, null), null);
  assert.equal(scrubTrack(project, { instructions: [], cutList: [] }), null);
});

test("play pacing: 700 ms a beat, a long build held to about 8 s, never under 250 ms", () => {
  assert.equal(playGap(6), 700);
  assert.equal(playGap(20), 400);
  assert.equal(playGap(100), 250);
});

test("shared state: the scrubber writes, the bench hears it", () => {
  let heard = 0;
  const off = subscribeScrub(() => heard++);
  setScrub({ open: true, k: 3 });
  assert.deepEqual(scrubState(), { open: true, k: 3 });
  setScrub({ open: false, k: 0 });
  off();
  setScrub({ k: 1 });
  assert.equal(heard, 2);
  setScrub({ open: false, k: 0 });
});

test("wiring: order is consumed, not re-derived; props hide while scrubbing; reduced motion opens on the finished build", () => {
  const lib = read("src/components/workspace/build-scrub.ts");
  assert.match(lib, /buildOrder\(project, plan\)/);
  assert.doesNotMatch(lib, /stepOwners|planStepParts|partLetters/, "no second copy of the build order");
  const canvas = read("src/components/workspace/canvas.tsx");
  assert.match(canvas, /<ScaleLayer[^>]*\|\| scrubbing\}/, "the scale figure and props hide while scrubbing");
  assert.match(canvas, /const reveal = stepReveal \?\? scrubbed;/, "the scrub draws through the reveal's outline/wood path");
  const ui = read("src/components/workspace/build-scrubber.tsx");
  assert.match(ui, /const still = reducedMotion\(\);\s*setScrub\(\{ open: true, k: still \? n : 1 \}\);\s*setPlaying\(!still\);/, "reduced motion: no autoplay, the finished frame");
  assert.match(ui, /type="range"[\s\S]*aria-valuetext=\{label\}/, "a native slider: arrows, Home, End, with the step named");
  assert.match(ui, /document\.hidden \|\| !seen\.current/, "play pauses off screen");
  assert.doesNotMatch(ui, /useYard\(\(s\) => s\.(setProject|patchProject|setPlan)/, "the scrubber writes no project or plan");
});
