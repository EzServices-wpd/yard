import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { panelSupports } from "./supportGraph";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, notes: (p.notes ?? []).join(" ") };
};
const roles = (p: ReturnType<typeof generateFromPrompt>) => {
  const c: Record<string, number> = {};
  for (const i of p.instances) c[i.role ?? "member"] = (c[i.role ?? "member"] ?? 0) + 1;
  return c;
};

describe("pole-frame family: poles splay from a ground ring and meet at one top tie", () => {
  it("a teepee is full-size 2×2 poles when nothing is typed, one pole each", () => {
    const { p, notes } = build("teepee");
    assert.equal(p.primaryMaterialId, "lumber-2x2-8");
    assert.ok(p.overall.height >= 66 && p.overall.height <= 80, `height ${p.overall.height}`);
    assert.equal(roles(p).leg, 5);
    assert.match(notes, /meet at one top tie/);
    assert.match(notes, /No material typed, so this builds from 2×2 lumber/);
  });
  it("typed stock drives the poles (1×2) and a typed count drives the pole count", () => {
    const { p } = build("kids teepee from 1x2 with 6 poles");
    assert.equal(p.primaryMaterialId, "lumber-1x2-8");
    assert.equal(roles(p).leg, 6);
  });
  it("a bean pole tower has tie rings between the poles; craft stock builds a model", () => {
    const { p } = build("bean pole tower");
    assert.ok((roles(p).rail ?? 0) >= 6);
    const m = build("popsicle stick teepee").p;
    assert.ok(m.overall.height <= 14, `model height ${m.overall.height}`);
  });
  it("an unknown cone-like noun maps to the family and says so", () => {
    const { p, notes } = build("cone");
    assert.match(p.name, /Pole cone/);
    assert.match(notes, /nearest Yard has for a cone/);
  });
});

describe("trellis: real proportions, a slat grid, typed stock", () => {
  it("a bare trellis is 6' of 2×2 stiles with slats about 6\" apart", () => {
    const { p } = build("trellis");
    assert.equal(p.primaryMaterialId, "lumber-2x2-8");
    assert.ok(p.overall.height >= 70 && p.overall.height <= 98, `height ${p.overall.height}`);
    const slats = roles(p).brace ?? 0;
    assert.ok(slats >= 8 && slats <= 16, `slats ${slats}`);
  });
  it("typed cedar 1×4 and a typed height win", () => {
    const { p } = build("cedar trellis 8 ft from 1x4");
    assert.equal(p.primaryMaterialId, "lumber-1x4-8");
    assert.ok(Math.abs(p.overall.height - 96) <= 2, `height ${p.overall.height}`);
  });
});

describe("typed framing stock wins over a recipe's own stock", () => {
  it("step stool from 2x4: treads are 2×4 edge-glued; posts that keep 2×2 say so", () => {
    const { p, notes } = build("step stool from 2x4");
    const treads = p.panels.filter((x) => /tread/i.test(x.name));
    assert.ok(treads.length >= 2 && treads.every((t) => t.materialId === "lumber-2x4-8"));
    assert.doesNotMatch(notes, /plywood treads/);
    assert.match(notes, /Not 2×4: .*stay 2×2/);
  });
});

describe("bridges build a road that matches the notes", () => {
  for (const prompt of ["golden gate bridge from popsicle sticks", "4 foot bridge from plastic drinking straws"]) {
    it(prompt, () => {
      const { p } = build(prompt);
      assert.ok((roles(p).deck ?? 0) >= 10, JSON.stringify(roles(p)));
      assert.ok(buildPlan(p).instructions.some((s) => /road deck/i.test(s.title)));
    });
  }
});

describe("outdoor frames: frame before boards, no glides on fixed builds, a real mini sawhorse", () => {
  it("gate boards go on after both rails and the brace", () => {
    const { p } = build("garden gate");
    const sup = panelSupports(p.panels);
    const name = new Map(p.panels.map((x) => [x.id, x.name]));
    const board = p.panels.find((x) => /Board 3/.test(x.name))!;
    const on = sup.get(board.id)!.on.map((id) => name.get(id));
    assert.ok(on.includes("Bottom rail") && on.includes("Top rail"), on.join(","));
    const titles = buildPlan(p).instructions.map((s) => s.title);
    const lastFrame = Math.max(...titles.map((t, i) => (/^(?:Set|Fasten) the .*(?:stile|rail|brace)/i.test(t) ? i : -1)));
    const firstBoard = titles.findIndex((t) => /^Fasten the Board/.test(t));
    assert.ok(lastFrame < firstBoard, titles.join(" | "));
  });
  for (const prompt of ["garden gate", "backyard deck 10x12"]) {
    it(`${prompt}: no glides under feet`, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const text = JSON.stringify(plan);
      assert.doesNotMatch(text, /glides? under the feet|nylon glide/i);
    });
  }
  it("mini sawhorse is a low 2×4 A-frame; a popsicle sawhorse is the A-frame in sticks", () => {
    const { p } = build("mini sawhorse");
    assert.equal(p.primaryMaterialId, "lumber-2x4-8");
    assert.ok(p.overall.height <= 20);
    const m = build("popsicle stick sawhorse").p;
    assert.match(m.name, /Sawhorse/);
    assert.ok((roles(m).leg ?? 0) >= 4 && m.instances.length <= 30, JSON.stringify(roles(m)));
  });
});
