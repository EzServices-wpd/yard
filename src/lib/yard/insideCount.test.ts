import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { POCKET_DREAM } from "./pocket";

describe("inside counts change the plan", () => {
  it("a bookcase shelf count changes the cut list and steps", () => {
    const a = generateFromPrompt("bookcase 36 wide 60 tall 11 deep", "plywood-3-4-4x8");
    const spec = a.fitted!;
    const b = generateFromPrompt(a.prompt, "plywood-3-4-4x8", undefined, {
      fittedOverride: { ...spec, unit: { ...spec.unit, shelfCount: 3 } },
      honorUnit: true,
    });
    assert.equal(b.prompt, a.prompt);
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 3);
    const qty = (p: ReturnType<typeof generateFromPrompt>) =>
      buildPlan(p).cutList.map((c) => `${c.name}×${c.quantity}`).join("|") + buildPlan(p).instructions.map((s) => s.description).join("\n");
    assert.notEqual(qty(a), qty(b));
  });

  it("a pocket shelf count changes the shelves", () => {
    const a = generateFromPrompt(POCKET_DREAM);
    const pocket = a.pocket!;
    const b = generateFromPrompt(a.prompt, undefined, undefined, {
      pocketOverride: { ...pocket, unit: { ...pocket.unit, shelfRows: 2 } },
    });
    assert.equal(b.prompt, a.prompt);
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 4);
    const qty = (p: ReturnType<typeof generateFromPrompt>) => buildPlan(p).cutList.map((c) => `${c.name}×${c.quantity}`).join("|");
    assert.notEqual(qty(a), qty(b));
  });
});

import { applyInsideCount } from "./insideCount";
import { drawerBoxes } from "./hollowDrawers.ts";
import { headerTitle, buildPlanPdf } from "./pdf.ts";
import { factsFromProject } from "./measureTabs.ts";
import { shelfLineCount } from "./shelfSpan.ts";

function planText(p: ReturnType<typeof generateFromPrompt>) {
  const plan = buildPlan(p);
  return (
    plan.cutList.map((c) => `${c.name}×${c.quantity}`).join("|") +
    "\n" +
    plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n")
  );
}

describe("shelf-family counts drive the cut list", () => {
  it("bookshelf 36 wide: shelves 5 to 3 changes the cut list and the pin step", () => {
    const a = generateFromPrompt("bookshelf 36 wide");
    assert.equal(a.panels.filter((p) => p.type === "shelf").length, 5);
    const b = applyInsideCount(a, { shelves: 3 });
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 3);
    const text = planText(b);
    assert.notEqual(planText(a), text);
    assert.match(text, /Pin 3 adjustable shelves/);
    assert.doesNotMatch(text, /Pin 5 adjustable shelves/);
    assert.match(text, /Shelf×3/);
  });

  it("a shoe rack cubby count changes the dividers and the steps", () => {
    const a = generateFromPrompt("shoe rack 36 wide");
    const before = a.panels.filter((p) => p.type === "divider").length;
    const b = applyInsideCount(a, { cubbies: 4 });
    assert.equal(b.panels.filter((p) => p.type === "divider").length, 3);
    assert.notEqual(before, 3);
    assert.notEqual(planText(a), planText(b));
  });

  it("a drawer count changes the cut list and the steps", () => {
    const a = generateFromPrompt("drawer unit 24 wide");
    assert.equal(drawerBoxes(a.panels).length, 3);
    const b = applyInsideCount(a, { drawers: 1 });
    assert.equal(drawerBoxes(b.panels).length, 1);
    const text = planText(b);
    assert.notEqual(planText(a), text);
    assert.match(text, /Drawer front×1/);
    assert.doesNotMatch(text, /3 drawers/);
  });

  it("a shelf family with no fitted spec still changes the cut list", () => {
    const a = generateFromPrompt("bookshelf 36 wide");
    const bare = { ...a, fitted: undefined, recastFrom: undefined };
    const b = applyInsideCount(bare, { shelves: 2 });
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 2);
    assert.notEqual(planText(bare), planText(b));
    assert.match(planText(b), /Pin 2 adjustable shelves/);
  });
});

describe("a shelf level counts once, however many bays it spans", () => {
  const cases: [string, number][] = [
    ["3 shelf bookshelf 42 wide", 3],
    ["5 shelf bookshelf 42 wide", 5],
    ["bookcase 48 wide with 7 shelves", 7],
    ["half a sheet of plywood shelf", 3],
    ["kitchen island 48 long 22 deep 36 tall with slat shelf", 1],
    ["butcher block island on wheels 42 by 30", 1],
  ];
  for (const [q, n] of cases) {
    it(q, () => {
      const p = generateFromPrompt(q);
      const word = `${n} shel${n === 1 ? "f" : "ves"}`;
      assert.match(headerTitle(p), new RegExp(` · ${word}$`), headerTitle(p));
      assert.equal(factsFromProject(p).shelves, p.panels.some((x) => x.type === "shelf") ? shelfLineCount(p.panels.filter((x) => x.type === "shelf")) : n);
      assert.equal(shelfLineCount(p.panels.filter((x) => /^(?:grid |adjustable |fixed |inner )?shelf$/i.test(x.name.replace(/\s*\d+$/, "")))), n);
      const pieces = p.panels.filter((x) => x.type === "shelf").length;
      if (q.startsWith("butcher")) assert.equal(pieces, n);
      else assert.ok(pieces > n, `${q}: cut list still has a piece per bay`);
      const notes = (p.notes ?? []).join("\n");
      assert.doesNotMatch(notes, new RegExp(`\\b${pieces} adjustable shelf`));
    });
  }

  it("the cover says the shelf level, and the cut list keeps the pieces", () => {
    const p = generateFromPrompt("3 shelf bookshelf 42 wide");
    const text = buildPlanPdf(p, buildPlan(p)).output("arraybuffer");
    const raw = Buffer.from(text as ArrayBuffer).toString("latin1");
    assert.match(raw, /3 shelves/);
    assert.equal(p.panels.filter((x) => x.type === "shelf").length, 6);
    const qty = buildPlan(p).cutList.filter((c) => /\bshelf\b/i.test(c.name) && !/nosing/i.test(c.name)).reduce((s, c) => s + c.quantity, 0);
    assert.equal(qty, 6);
  });
});
