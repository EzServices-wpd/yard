import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { applySpaceCuts } from "./spaceCuts";

function planText(prompt: string, ask: Parameters<typeof applySpaceCuts>[1]) {
  const base = generateFromPrompt(prompt);
  const cut = applySpaceCuts(base, ask);
  const a = buildPlan(base);
  const b = buildPlan(cut);
  const text = (p: typeof a) => p.cutList.map((c) => `${c.name} ${c.notes ?? ""}`).join("|") + p.instructions.map((s) => s.title + s.description).join("\n");
  return { base, cut, a, b, changed: text(a) !== text(b) };
}

describe("opening cuts change the model", () => {
  it("an arch is a curved top rail and side cuts", () => {
    const { cut, changed, b } = planText("bookshelf 36 wide", { shape: "arch", archRise: 4 });
    assert.equal(cut.panels.some((p) => p.name === "Curved top rail"), true);
    assert.equal(cut.panels.filter((p) => p.type === "upright").every((p) => /curve/.test(p.cutNote ?? "")), true);
    assert.equal(changed, true);
    assert.match(b.instructions.map((s) => s.description).join("\n"), /curve/);
  });

  it("a slope tapers the sides", () => {
    const { cut, changed, b } = planText("bookshelf 36 wide", { shape: "slope", lowSide: 60 });
    assert.equal(cut.panels.some((p) => /tapered side/.test(p.cutNote ?? "")), true);
    assert.equal(changed, true);
    assert.match(b.instructions.map((s) => s.description).join("\n"), /slope/);
  });

  it("an outlet is a cutout in the back", () => {
    const { cut, changed, b } = planText("bookshelf 36 wide", { shape: "rectangle", outlet: { x: 6, y: 12, width: 4.5, height: 2.75 } });
    const back = cut.panels.find((p) => p.type === "back");
    assert.equal(back?.cutouts?.some((c) => c.id === "space-outlet"), true);
    assert.equal(changed, true);
    assert.match(b.instructions.map((s) => s.description).join("\n"), /outlet/);
  });

  it("a baseboard notches the back edge at the floor", () => {
    const { base, cut, changed, b } = planText("bookshelf 36 wide", { shape: "rectangle", baseboard: { height: 3.5, depth: 0.5 } });
    const before = base.panels.find((p) => p.type === "back")!;
    const after = cut.panels.find((p) => p.type === "back")!;
    assert.ok(after.size.height < before.size.height);
    assert.match(after.cutNote ?? "", /baseboard/);
    assert.equal(changed, true);
    assert.match(b.instructions.map((s) => s.description).join("\n"), /baseboard/);
  });
});

describe("the panel action", () => {
  it("arched top and outlet on a linen closet change the model and add the step", () => {
    const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const cut = applySpaceCuts(linen, { shape: "arch", archRise: 4, outlet: { x: 6, y: 12, width: 4.5, height: 2.75 } });
    assert.equal(cut.panels.some((p) => p.name === "Curved top rail"), true);
    assert.equal(cut.panels.find((p) => p.type === "back")?.cutouts?.some((c) => c.id === "space-outlet"), true);
    const plan = buildPlan(cut);
    assert.match(plan.instructions.map((s) => s.title).join(" "), /Cut the opening/);
  });
});
