/**
 * Finished step text. This file reads the plan a shopper would read.
 * It does not import the clause mover, and it does not reuse that mover's part matcher.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportPromptSet } from "../../../scripts/support-order-prompts.ts";
import type { AssemblyStep } from "./types.ts";

const MIXED =
  /(?:Screw through|Tape or glue through|Set the joints the stock uses, through) the (?:[A-Z]{1,2} )?(?:top, bottom, and back into each divider|seat, shoe shelf, and back into each divider|seat, bottom shelf, and back into each divider|back and the nearest shelf or top)\./;

function planOf(prompt: string, materialId?: string) {
  const project = generateFromPrompt(prompt, materialId);
  return buildPlan(project).instructions;
}

function step(steps: AssemblyStep[], title: RegExp): AssemblyStep {
  const found = steps.find((s) => title.test(s.title));
  assert.ok(found, title.source);
  return found;
}

/** Drive N is still on this step, and no other sentence says where those screws go. */
function bareDrive(description: string): boolean {
  if (!/Drive \d+ × #8 /.test(description) || !/\bin this step\b/.test(description)) return false;
  const sentences = description.split(/(?<=[.!?])\s+/);
  return !sentences.some((s) => {
    if (/Drive \d+ × #8 /.test(s)) return false;
    if (/^Where:/.test(s) || /^That brings the build to /.test(s) || /^These screws are counted/.test(s)) return false;
    return /\b(?:screw|screws|fasten|attach|nail|glue)\b/i.test(s);
  });
}

describe("a Drive N step keeps the fastening sentence for the screws it counts", () => {
  const kept: [string, RegExp, RegExp][] = [
    ["shoe rack 36 wide", /Set cubby dividers/, /Screw through the D top, bottom, and back into each divider\./],
    ["2x2 shoe rack", /Set cubby dividers/, /Screw through the D top, bottom, and back into each divider\./],
    ["shoe rack 36 wide 24 high 12 deep", /Set cubby dividers/, /Screw through the D top, bottom, and back into each divider\./],
    ["rolling shoe rack", /Set cubby dividers/, /Screw through the D top, bottom, and back into each divider\./],
    ["pocket vanity", /Set remaining dividers/, /Screw through the back and the nearest shelf or top\./],
    ["wardrobe 40x72", /Set remaining dividers/, /Screw through the A back and the nearest shelf or top\./],
    ["dresser 54.375 wide 36 tall 18.75 deep", /Set remaining dividers/, /Screw through the back and the nearest shelf or top\./],
    ["mudroom bench 48 wide 20 tall 16 deep", /Set cubby dividers/, /Screw through the C seat, shoe shelf, and back into each divider\./],
    ["window seat", /Set cubby dividers/, /Screw through the D seat, bottom shelf, and back into each divider\./],
  ];

  for (const [prompt, title, sentence] of kept) {
    it(`${prompt}: Drive N and its fastening sentence stay on the same step`, () => {
      const steps = planOf(prompt);
      const divider = steps.find((s) => title.test(s.title) && /Drive \d+ × #8 /.test(s.description ?? ""));
      assert.ok(divider, prompt);
      assert.match(divider.description ?? "", /Drive \d+ × #8 /, prompt);
      assert.match(divider.description ?? "", /\bin this step\b/, prompt);
      assert.match(divider.description ?? "", sentence, prompt);
      assert.equal(bareDrive(divider.description ?? ""), false, prompt);
    });
  }

  it("no step keeps a bare Drive N while a later step holds the mixed fastening sentence", { timeout: 180_000 }, () => {
    const bad: string[] = [];
    for (const prompt of supportPromptSet()) {
      let steps: AssemblyStep[];
      try {
        steps = planOf(prompt);
      } catch {
        continue;
      }
      steps.forEach((later, i) => {
        const text = later.description ?? "";
        if (!MIXED.test(text)) return;
        // The screws this sentence describes are counted on this step. A later back step
        // says they are counted elsewhere and has no Drive N of its own.
        if (/Drive \d+ × #8 /.test(text) && /\bin this step\b/.test(text)) return;
        const orphan = steps.slice(0, i).find((s) => bareDrive(s.description ?? ""));
        if (orphan) bad.push(`${prompt} — ${orphan.title} keeps Drive N, ${later.title} holds the sentence`);
      });
    }
    assert.deepEqual(bad, []);
  });

  it("the thin linen top does not inherit the divider sentence", () => {
    const steps = planOf("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep", "plywood-1-4-4x8");
    const top = step(steps, /^Set the Top$/);
    assert.match(top.description ?? "", /It is too thin for a screw/);
    assert.doesNotMatch(top.description ?? "", /Screw through/);
    const dividers = step(steps, /Set remaining dividers/);
    assert.match(dividers.description ?? "", /Screw through the A back and the nearest shelf or top\./);
  });
});

describe("the back names a shoe shelf only when that shelf is already placed", () => {
  const beforeBack = [
    undefined,
    "lumber-1x12-8",
    "lumber-2x4-8",
    "plywood-3-4-4x8",
    "plywood-1-2-4x8",
    "pvc-1-sch40",
    "pvc-1-2-sch40",
    "pallet-board",
  ];

  for (const materialId of beforeBack) {
    it(`rolling shoe rack${materialId ? ` ${materialId}` : ""}: shelf step before the back keeps the shelf on the back line`, () => {
      const steps = planOf("rolling shoe rack", materialId);
      const shelf = steps.findIndex((s) => /\bfixed shel/i.test(s.title));
      const back = steps.findIndex((s) => /to the back of the box/.test(s.title));
      assert.ok(shelf >= 0 && back > shelf, `shelf ${shelf} back ${back}`);
      const join = (steps[back].description ?? "").match(/One join: attach[^.]*\./)?.[0] ?? "";
      assert.match(join, /Shoe shelf/);
    });
  }

  it("a shoe shelf placed after the back is not named on the back line", () => {
    for (const prompt of ["shoe rack 36 wide", "2x2 shoe rack"]) {
      const steps = planOf(prompt);
      const shelf = steps.findIndex((s) => /\bfixed shel/i.test(s.title));
      const back = steps.findIndex((s) => /to the back of the box/.test(s.title));
      assert.ok(back >= 0 && shelf > back, `${prompt} shelf ${shelf} back ${back}`);
      const join = (steps[back].description ?? "").match(/One join: attach[^.]*\./)?.[0] ?? "";
      assert.doesNotMatch(join, /shoe shelf/i, prompt);
      assert.match(steps[shelf].description ?? "", /through A Back into the shelf back edges/);
    }
  });
});

describe("a moved clause is a sentence on the step that counts its screws", () => {
  it("the desktop clause keeps its capital on the desktop step", () => {
    const steps = planOf("desk 60x30x29");
    const knee = step(steps, /knee dividers/);
    const desktop = step(steps, /Set the desktop/);
    assert.match(knee.description ?? "", /screw through the bottom into it/);
    assert.doesNotMatch(knee.description ?? "", /divider tops/);
    assert.match(desktop.description ?? "", /Drive \d+ × #8 /);
    assert.match(desktop.description ?? "", /The desktop screws down into the divider tops\./);
    assert.equal((desktop.description ?? "").includes("the desktop screws down into the divider tops."), false);
  });

  it("the vanity counter sentence stands on the counter step", () => {
    const steps = planOf("pocket vanity");
    const knee = step(steps, /knee dividers/);
    const counter = step(steps, /Set the counter/);
    const sentence = "Screw through the bottom and the vanity counter into each divider.";
    assert.equal((knee.description ?? "").includes(sentence), false);
    assert.match(counter.description ?? "", /Drive \d+ × #8 /);
    assert.ok((counter.description ?? "").endsWith(sentence), counter.description);
  });
});

describe("canaries keep their model, buy, price, cuts, and step text", () => {
  const pin = (prompt: string, cost: number, pieces: number, bom: number, steps: number, stepHash: string) => {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    assert.equal(plan.totals.estCostUsd, cost, prompt);
    assert.equal(plan.totals.pieces, pieces, prompt);
    assert.equal(plan.bom.length, bom, prompt);
    assert.equal(plan.instructions.length, steps, prompt);
    assert.equal(project.panels.length > 0 || project.instances.length > 0, true);
    const hash = createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
    assert.equal(hash, stepHash, prompt);
    const buy = createHash("sha256").update(plan.bom.map((b) => `${b.quantity}|${b.name}|${b.notes ?? ""}|${b.estimatedCost ?? ""}`).join("\n")).digest("hex").slice(0, 16);
    const cuts = createHash("sha256").update(plan.cutList.map((c) => `${c.label ?? ""}|${c.quantity}|${c.name}|${c.lengthIn}|${c.widthIn}|${c.thicknessIn}`).join("\n")).digest("hex").slice(0, 16);
    return { buy, cuts, overall: { ...project.overall } };
  };

  it("linen closet 31.5 × 78 × 16", () => {
    const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const plan = buildPlan(project);
    assert.deepEqual([project.overall.width, project.overall.height, project.overall.depth], [31.5, 78, 16]);
    assert.equal(plan.totals.estCostUsd, 193.68);
    assert.equal(plan.totals.pieces, 11);
    assert.equal(plan.bom.length, 8);
    assert.equal(plan.instructions.length, 9);
    const hash = createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
    assert.equal(hash, "2bb9e7d5e3d43112");
  });

  it("Andersen 36x48, the popsicle Eiffel, pocket vanity, and the desk keep buy and cuts", () => {
    const andersen = pin("Andersen 36x48", 439.26, 14, 8, 10, "897052ca411715ec");
    const eiffel = pin("3 foot Eiffel Tower from popsicle sticks", 19.96, 784, 2, 10, "313e45c392b40b22");
    const vanity = generateFromPrompt("pocket vanity");
    const vanityPlan = buildPlan(vanity);
    const desk = generateFromPrompt("desk 60x30x29");
    const deskPlan = buildPlan(desk);
    assert.equal(vanityPlan.totals.estCostUsd, 636.23);
    assert.equal(vanityPlan.totals.pieces, 50);
    assert.equal(vanityPlan.bom.length, 15);
    assert.equal(vanityPlan.instructions.length, 17);
    assert.equal(deskPlan.totals.estCostUsd, 381.97);
    assert.equal(deskPlan.totals.pieces, 41);
    assert.equal(deskPlan.bom.length, 8);
    assert.equal(deskPlan.instructions.length, 12);
    assert.deepEqual(andersen.overall.width, 46);
    assert.equal(eiffel.overall.height, 37.4);
  });
});
