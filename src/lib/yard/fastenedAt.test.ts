/**
 * A part listed in partsUsed is not placed. Screw totals and spatial names follow the
 * step that attaches the part, and that never reorders the steps.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { fastenedAt } from "./fastenedAt.ts";
import { stepScrewCount } from "./stepJointScrews.ts";

function built(prompt: string, material?: string) {
  const project = generateFromPrompt(prompt, material);
  const plan = buildPlan(project);
  return { project, plan };
}

const shoeRack = `shoe rack 36x18x12`;

function buyScrews(plan: ReturnType<typeof buildPlan>): number {
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  return Number(line?.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
}

describe("fastened placement does not reorder steps", () => {
  const titles: [string, string[]?][] = [
    [shoeRack, [
      "Confirm the footprint before the first cut",
      "Cut the 3/4\" Plywood 4×8 and 1/4\" plywood (backer)",
      "Stand the main box",
      "Attach C Top to both D uprights",
      "Set cubby dividers",
      "Attach A Back to the back of the box",
      "Level it",
    ]],
    ["planter box", [
      "Confirm the footprint before the first cut",
      "Cut the 3/4\" Plywood 4×8",
      "Set the Front",
      "Stand the main box",
      "Attach B Bottom to both D uprights",
      "Drill drainage holes and line it",
      "Level it",
    ]],
    ["bench 48 wide", [
      "Confirm the footprint before the first cut",
      "Cut the 2×4 Stud (8 ft) and 3/4\" Plywood 4×8",
      "Set the Center support 2 and Center support 1",
      "Stand the main box",
      "Set the front apron",
      "Set the Seat",
      "Level it and sit-test",
    ]],
    ["linen closet 31.5 wide 78 tall 16 deep", [
      "Confirm the footprint before the first cut",
      "Cut the 3/4\" Plywood 4×8 and 1/4\" plywood (backer)",
      "Stand the main box",
      "Attach F Top to both B uprights",
      "Attach A Back to the back of the box",
      "Pin 4 adjustable shelves — 4 pins each",
      "Hang 2 doors — 4 concealed hinges each",
      "Level it",
      "Strap the top to a wall stud with the anti-tip kit",
    ]],
  ];

  for (const [prompt, expectTitles] of titles) {
    it(`${prompt}: titles and sequence stay the release order`, () => {
      const { plan } = built(prompt);
      assert.deepEqual(plan.instructions.map((s) => s.title), expectTitles);
      assert.deepEqual(plan.instructions.map((s) => s.step), expectTitles!.map((_, i) => i + 1));
    });
  }
});

describe("a part counts as placed when it is attached, not when it is first listed", () => {
  it("the thin back is listed on Stand the main box and attached on Attach A Back", () => {
    const { project, plan } = built(shoeRack);
    const back = project.panels.find((p) => p.name === "Back");
    assert.ok(back);
    const listed = placementIndex(project, plan.instructions).get(back.id);
    const fastened = fastenedAt(project, plan.instructions, plan.cutList).get(back.id);
    assert.equal(plan.instructions[listed!].title, "Stand the main box");
    assert.equal(plan.instructions[fastened!].title, "Attach A Back to the back of the box");
    assert.ok(fastened! > listed!);
  });

  it("shoe-rack divider screws do not include the back, and the back step carries those screws", () => {
    const { plan } = built(shoeRack);
    const divider = plan.instructions.find((s) => s.title === "Set cubby dividers");
    const back = plan.instructions.find((s) => /to the back of the box/.test(s.title));
    const top = plan.instructions.find((s) => s.title === "Attach C Top to both D uprights");
    assert.match(divider?.description ?? "", /Drive 12 × #8 /);
    assert.match(divider?.description ?? "", /Screw through the C top and bottom into each divider/);
    assert.doesNotMatch(top?.description ?? "", /cubby divider/i);
    assert.match(back?.description ?? "", /with 18 × #8 /);
    assert.doesNotMatch(back?.description ?? "", /counted in another step/);
    assert.equal(stepScrewCount(plan), buyScrews(plan));
  });

  it("the planter front does not say flush with uprights that are set on the next step", () => {
    const { plan } = built("planter box");
    const front = plan.instructions.find((s) => s.title === "Set the Front");
    const stand = plan.instructions.find((s) => s.title === "Stand the main box");
    assert.doesNotMatch(front?.description ?? "", /flush with the tops of both D uprights/);
    assert.ok(stand);
    assert.equal(stepScrewCount(plan), buyScrews(plan));
  });

  it("the bench apron line waits until the seat is set", () => {
    const { plan } = built("bench 48 wide");
    const apron = plan.instructions.find((s) => s.title === "Set the front apron");
    const seat = plan.instructions.find((s) => s.title === "Set the Seat");
    assert.doesNotMatch(apron?.description ?? "", /under the front edge of the A seat/);
    assert.match(seat?.description ?? "", /under the front edge of the A seat/);
    assert.equal(stepScrewCount(plan), buyScrews(plan));
  });

  it("the TV back step does not name shelves that are set later", () => {
    const { plan } = built("TV console 70x30x16 from 2x2");
    const back = plan.instructions.find((s) => /to the back of the box/.test(s.title));
    const shelfAt = plan.instructions.findIndex((s) => /fixed shel/i.test(s.title));
    const backAt = plan.instructions.findIndex((s) => s === back);
    assert.ok(shelfAt > backAt);
    assert.doesNotMatch(back?.description ?? "", /Shelves/);
    assert.equal(stepScrewCount(plan), buyScrews(plan));
  });

  it("the 1/4 inch alcove linen does not fasten the bottom to the back before the back step", () => {
    const { plan } = built("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep", "plywood-1-4-4x8");
    const stand = plan.instructions.find((s) => s.title === "Stand the main box");
    const backAt = plan.instructions.findIndex((s) => /to the back of the box/.test(s.title));
    const standAt = plan.instructions.findIndex((s) => s === stand);
    assert.ok(backAt > standAt);
    assert.doesNotMatch(stand?.description ?? "", /back edges of A Back/);
    const back = plan.instructions[backAt];
    assert.doesNotMatch(back.description, /\bF Top\b/);
    assert.equal(stepScrewCount(plan), buyScrews(plan));
  });
});
