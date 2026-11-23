/**
 * Shop wording for steps and notes. The denylist is the engine's own terms; Buy lines are not scanned.
 *   npx tsx --test src/lib/yard/plainMakerTalk.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadCorpus } from "../../../scripts/eval-gate-lib.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { plainMakerTalk, STEP_NOTE_DENY } from "./plainMakerTalk.ts";

const PAIRS: [string, string][] = [
  [
    'Drive 4 × #8 × 1 1/4" screws in this step, from the model\'s joints: one about every 8" along each joint (at least 2).',
    'Drive 4 × #8 × 1 1/4" screws in this step, where the parts meet: one about every 8" along each joint (at least 2).',
  ],
  [
    'In all, this step drives 16 × #8 × 1 1/4" screws, from the model\'s joints.',
    'In all, this step drives 16 × #8 × 1 1/4" screws, where the parts meet.',
  ],
  [
    "That brings the build to 44 screws from the model's joints, the count on the Buy list.",
    "That brings the build to 44 screws where the parts meet, the count on the Buy list.",
  ],
  [
    "That makes all 54 screws from the model's joints on the Buy list.",
    "That makes all 54 screws where the parts meet on the Buy list.",
  ],
  [
    "84 screws from the model's joints: 84 for 40 butt joints.",
    "84 screws where the parts meet: 84 for 40 butt joints.",
  ],
  [
    "Mark each hole from the model's spacing, clamp a scrap under the part, and drill square to the face.",
    "Mark each hole at the spacing shown, clamp a scrap under the part, and drill square to the face.",
  ],
  [
    "Screw on the 2 fold brackets where the model shows them, with the screws in each pack.",
    "Screw on the 2 fold brackets where the parts meet, with the screws in each pack.",
  ],
  [
    "Nothing on the model is left out of the steps.",
    "Nothing in the build is left out of the steps.",
  ],
  [
    "Fasten the second piece where the model shows it: on the back and up high.",
    "Fasten the second piece where the parts meet: on the back and up high.",
  ],
  ["This part was on the model and not yet in a step.", ""],
  ["One join class: attach the aprons to the legs.", "One join: attach the aprons to the legs."],
  ['Assumed 16" deep (default size) — type a depth to lock it.', 'Assumed 16" deep — type a depth to lock it.'],
  ['Assumed 36" wide (bookcase class default) — type a width to lock it.', 'Assumed 36" wide — type a width to lock it.'],
  [
    "Class defaults fill untyped axes — type Measure to lock size.",
    "Sizes you did not type are filled in — type them in Measure to lock the size.",
  ],
  ["Class anatomy: low bed. A floor of boards.", "Low bed. A floor of boards."],
  ["Raised enclosure class: outdoor coop.", "Raised enclosure: outdoor coop."],
  [
    "Wagon lies along its long axis. No class matched, so this is a body, not a standing frame.",
    "Wagon lies along its long axis. This is a body, not a standing frame.",
  ],
  ["No published wire for this name — built from its anatomy class.", "No published wire for this name — built from the shape of its parts."],
  ["Adirondack chair — outdoor seat family.", "Adirondack chair — outdoor seat."],
  ["Type popsicle sticks to build a model.", "Type popsicle sticks to build a small one."],
  [
    "This is a figure armature — it will stand as a display model, not a load-bearing frame.",
    "This is a figure armature — it will stand as a display piece, not a load-bearing frame.",
  ],
  ["Fasten the Front toekick.", "Fasten the Front kick strip."],
  ['Assumed 40" across × 30" tall (finished top, overhang included) — table class default. Type a size to change it.', 'Assumed 40" across × 30" tall (finished top, overhang included). Type a size to change it.'],
];

test("each engine phrase becomes the shop sentence", () => {
  for (const [before, after] of PAIRS) assert.equal(plainMakerTalk(before), after, before);
});

test("the phrase table itself is clean", () => {
  for (const [, after] of PAIRS) {
    for (const [re, name] of STEP_NOTE_DENY) assert.equal(re.test(after), false, `${name} in "${after}"`);
  }
});

test("generated steps and notes across the corpus stay free of engine terms", () => {
  const prompts = loadCorpus().map((e) => e.prompt);
  assert.ok(prompts.length >= 500, `corpus ${prompts.length}`);
  const hits: string[] = [];
  for (const q of prompts) {
    let project;
    let plan;
    try {
      project = generateFromPrompt(q);
      plan = buildPlan(project);
    } catch {
      continue;
    }
    const bits = [
      ...(project.notes ?? []).map((n) => `note: ${n}`),
      ...plan.instructions.flatMap((s) => [`title: ${s.title}`, `step: ${s.description}`, `tip: ${s.tips ?? ""}`]),
    ];
    for (const bit of bits) {
      for (const [re, name] of STEP_NOTE_DENY) {
        if (re.test(bit)) hits.push(`${q} [${name}] ${bit.slice(0, 180)}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});

test("the prompt's own words and numbers are never reworded", () => {
  for (const s of [
    "Yard built a stand for the model ship as a simple counter on legs sized for it.",
    "Set the model train on the layout board.",
    "A low-profile family room bench.",
    "Shelf 11 1/4\" deep (from the 12\" class default).",
    "Space the slats 1 1/2\" apart (default size).",
    "The derived height is 30\".",
  ]) assert.equal(plainMakerTalk(s), s, s);
});

test("the display card and the fallback-step gate still find their notes", async () => {
  const { buildPlanUnworded } = await import("./report.ts");
  const p = generateFromPrompt("craft stick planter");
  assert.ok(p.holdStockId && (p.notes ?? []).some((n) => /^This is a display (?:model|piece)\b/.test(n)));
  const q = generateFromPrompt("sandbox");
  assert.ok(buildPlanUnworded(q).instructions.some((s) => /not yet in a step/.test(s.tips ?? "")));
  assert.ok(!buildPlan(q).instructions.some((s) => /not yet in a step/.test(s.tips ?? "")));
});
