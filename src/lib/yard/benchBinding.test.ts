import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { benchBindsForm, bindsNamedForm, recipeFromOps } from "./form.ts";
import { bindsDeterministically } from "./weekendFamily.ts";

/** What an LLM interpretation swapped in on the live walk: a ring/box hull. */
const llmRings = recipeFromOps("Chair", "custom", [
  { op: "shell", y0: 0, y1: 30, r: 12, profile: "hemisphere", role: "ring" },
]);

function roles(p: ReturnType<typeof generateFromPrompt>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of p.instances) out[i.role ?? "?"] = (out[i.role ?? "?"] ?? 0) + 1;
  return out;
}

describe("named recipes are bound against the LLM form swap", () => {
  for (const prompt of ["adirondack chair", "rocking chair", "lounge chair", "ottoman", "porch swing frame"]) {
    it(`${prompt} is always bound`, () => {
      const bench = generateFromPrompt(prompt);
      assert.equal(bindsDeterministically(prompt, bench), true);
      assert.equal(benchBindsForm(prompt, bench), true);
    });
  }

  for (const prompt of ["birdhouse", "ferris wheel", "castle", "adirondack chair"]) {
    it(`${prompt}: the bench built its dedicated recipe, so it binds`, () => {
      assert.equal(benchBindsForm(prompt, generateFromPrompt(prompt)), true);
    });
  }

  it("adirondack chair keeps seat/back/arm sticks; it never becomes legs + rings", () => {
    const bench = generateFromPrompt("adirondack chair");
    assert.equal(bindsNamedForm("adirondack chair", bench), true);
    assert.ok(!Object.keys(roles(bench)).includes("ring"), JSON.stringify(roles(bench)));
  });

  it("generic and fallback builds stay open to the LLM form", () => {
    assert.equal(benchBindsForm("bookcase 36 wide", generateFromPrompt("bookcase 36 wide")), false);
    assert.equal(benchBindsForm("lemonade stand", generateFromPrompt("lemonade stand")), false);
    // A HITS noun the bench did not build as that recipe (remapped fallback) is not bound by name.
    assert.equal(bindsNamedForm("lighthouse 24 tall", { kind: "closet" }), false);
    // Catch-alls never bind by name.
    assert.equal(bindsNamedForm("a person", { kind: "figure" }), false);
  });

  for (const prompt of ["coat hook board 36 wide with 5 hooks", "peg rail 48 wide"]) {
    it(`${prompt}: fitted panels survive an LLM form`, () => {
      const bench = generateFromPrompt(prompt);
      const after = generateFromPrompt(prompt, undefined, llmRings);
      assert.ok(bench.panels.length > 0);
      assert.equal(after.panels.length, bench.panels.length);
      assert.equal(after.name, bench.name);
      assert.ok(!Object.keys(roles(after)).includes("ring"));
    });
  }
});

describe("toy beds are a small bed frame; fallbacks keep the typed words", () => {
  it("doll bed is legs + rails + a deck, not a planter box", () => {
    const bed = generateFromPrompt("doll bed");
    const r = roles(bed);
    assert.ok((r.leg ?? r.upright) > 0 && r.deck > 0 && r.rail > 0, JSON.stringify(r));
    assert.ok(!r.bottom, JSON.stringify(r));
    assert.doesNotMatch(bed.prompt, /planter/);
    assert.match(bed.notes[0], /bed frame on legs/);
    assert.equal(bed.typedPrompt, "doll bed");
  });

  it("doll bed cut list names Leg, Rail, and Deck", () => {
    const plan = buildPlan(generateFromPrompt("doll bed"));
    const names = plan.cutList.map((c) => c.name).join(" ");
    assert.match(names, /Leg/i);
    assert.match(names, /Rail/i);
    assert.match(names, /Deck/i);
    assert.doesNotMatch(names, /^Standard Popsicle Stick$/);
    assert.ok(plan.cutList.reduce((s, c) => s + c.quantity, 0) <= 40);
  });


  it("lemonade stand shows 'lemonade stand' in the box, not the primitive", () => {
    const stand = generateFromPrompt("lemonade stand");
    assert.equal(stand.typedPrompt, "lemonade stand");
    assert.equal(stand.name, "Lemonade Stand");
  });

  it("store keeps the typed words through a repeat and a refinement", async () => {
    const mem = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const { useYard } = await import("./store.ts");
    useYard.getState().generate("lemonade stand", undefined, undefined, { fresh: true });
    assert.equal(useYard.getState().project.typedPrompt, "lemonade stand");
    useYard.getState().generate("lemonade stand");
    assert.equal(useYard.getState().project.typedPrompt, "lemonade stand");
    assert.doesNotMatch(useYard.getState().project.prompt, /Then:/);
    const p = useYard.getState().project;
    useYard.getState().generate(p.prompt, "plywood-1-2-4x8", undefined, { restock: true });
    assert.equal(useYard.getState().project.typedPrompt, "lemonade stand");
    useYard.getState().generate("taller");
    assert.equal(useYard.getState().project.typedPrompt, "lemonade stand. Then: taller");
  });
});

describe("new subject without typed stock does not inherit bench stock", () => {
  it("after a popsicle birdhouse, lemonade stand lands plywood fallback", async () => {
    const mem = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const { useYard } = await import("./store.ts");
    useYard.getState().generate("popsicle stick birdhouse", undefined, undefined, { fresh: true });
    assert.match(useYard.getState().project.primaryMaterialId, /popsicle/);
    useYard.getState().generate("lemonade stand");
    const next = useYard.getState().project;
    assert.doesNotMatch(next.primaryMaterialId, /popsicle|craft/);
    assert.match(next.primaryMaterialId, /plywood|lumber|wood/);
    assert.doesNotMatch(next.prompt, /Then:/);
    assert.equal(next.typedPrompt, "lemonade stand");
  });

  it("lemonade stand 60 wide after a plywood lemonade rebuilds at 60, not as Then:", async () => {
    const mem = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const { useYard } = await import("./store.ts");
    useYard.getState().generate("lemonade stand", undefined, undefined, { fresh: true });
    assert.match(useYard.getState().project.primaryMaterialId, /plywood|lumber/);
    useYard.getState().generate("lemonade stand 60 wide");
    const next = useYard.getState().project;
    assert.doesNotMatch(next.prompt, /Then:/);
    assert.equal(next.overall.width, 60);
    assert.ok(next.overall.height >= 36, `height ${next.overall.height}`);
    assert.doesNotMatch(next.primaryMaterialId, /popsicle|craft/);
    assert.equal(next.typedPrompt, "lemonade stand 60 wide");
  });

  it("taller after lemonade still refines and keeps stock", async () => {
    const mem = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const { useYard } = await import("./store.ts");
    useYard.getState().generate("lemonade stand", undefined, undefined, { fresh: true });
    const stock = useYard.getState().project.primaryMaterialId;
    useYard.getState().generate("taller");
    const next = useYard.getState().project;
    assert.match(next.prompt, /Then: taller/);
    assert.equal(next.primaryMaterialId, stock);
  });
});
