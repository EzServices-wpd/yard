import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { refineChips, refinePrompt, refineProject } from "./refine.ts";

const count = (q: string, re: RegExp) => generateFromPrompt(q).panels.filter((p) => re.test(p.name)).length;
function refine(prompt: string, phrase: string) {
  const r = refinePrompt(prompt, phrase, generateFromPrompt(prompt));
  return { ...r, p: generateFromPrompt(r.prompt, r.materialId) };
}

describe("spec 003: Refine box merges phrases into the prompt (10 acceptance phrases)", () => {
  const book = "bookshelf 30 wide, 60 tall, five shelves";
  it("1 bookcase: make it 6 inches taller", () => {
    const { p } = refine(book, "make it 6 inches taller");
    assert.equal(p.overall.height, 66);
    assert.equal(p.overall.width, 30);
    assert.equal(count(refine(book, "make it 6 inches taller").prompt, /shelf/i), 5);
  });
  it("2 bookcase: two shelves", () => assert.equal(count(refine(book, "two shelves").prompt, /shelf/i), 2));
  it("3 bookcase: 36 inches wide", () => assert.equal(refine(book, "36 inches wide").p.overall.width, 36));
  it("4 nightstand: add a drawer", () => {
    const before = count("nightstand", /drawer.*front|front.*drawer/i);
    assert.equal(count(refine("nightstand", "add a drawer").prompt, /drawer.*front|front.*drawer/i), before + 1);
  });
  const desk = "desk 60 wide 30 deep 29 high";
  it("5 desk: 2 inches lower", () => {
    const { p } = refine(desk, "2 inches lower");
    assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [60, 27, 30]);
  });
  it("6 desk: one drawer", () => assert.equal(count(refine(desk, "one drawer").prompt, /drawer.*front|front.*drawer/i), 1));
  it("7 workbench: use plywood", () => {
    const { p, materialId } = refine("workbench", "use plywood");
    assert.match(materialId ?? "", /plywood/);
    assert.match(p.primaryMaterialId, /plywood/);
    assert.equal(p.kind, generateFromPrompt("workbench").kind);
  });
  it("8 workbench: 12 inches longer", () => assert.equal(refine("workbench", "12 inches longer").p.overall.width, 60));
  it("9 medicine cabinet: 2 inches deeper", () => assert.equal(refine("medicine cabinet", "2 inches deeper").p.overall.depth, 6));
  it("10 bookcase: use plywood keeps the shape and size", () => {
    const { p } = refine(book, "use plywood");
    assert.equal(p.kind, generateFromPrompt(book).kind);
    assert.equal(p.overall.height, 60);
  });
});

describe("spec 003: refine makes zero AI calls", () => {
  it("no fetch during 10 refines", () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls++; throw new Error("no AI"); }) as typeof fetch;
    try {
      for (const [q, ph] of [["bookshelf 30 wide, 60 tall", "make it 6 inches taller"], ["nightstand", "add a drawer"], ["workbench", "use plywood"], ["desk", "two shelves"]]) refine(q, ph);
    } finally { globalThis.fetch = real; }
    assert.equal(calls, 0);
  });
  it("refine code imports no AI or server function", () => {
    for (const f of ["src/lib/yard/refine.ts", "src/components/workspace/refine-box.tsx"]) {
      const src = fs.readFileSync(f, "utf8");
      assert.doesNotMatch(src, /lib\/ai|serverFn|createServerFn|runYardPrompt|lookupRecipe|interpretPrompt|hintSubject|fetch\(/);
    }
  });
});

describe("refineProject: one change to the current build, with feedback", () => {
  const g = generateFromPrompt;
  it("taller changes only the height", () => assert.deepEqual(refineProject(g("bookshelf 30 wide, 60 tall, five shelves"), "make it 6 inches taller").applied, ['Height 60" → 66"']));
  it("a bare comparative steps 2 inches", () => assert.deepEqual(refineProject(g("bookshelf 30 wide, 60 tall"), "make it narrower").applied, ['Width 30" → 28"']));
  it("add a shelf fits the bookcase", () => assert.deepEqual(refineProject(g("bookshelf 30 wide 60 tall"), "add a shelf").applied, ["Shelves 5 → 6"]));
  it("two clauses apply in order", () => {
    const r = refineProject(g("bookshelf 30 wide, 60 tall"), "2 inches taller and add a shelf");
    assert.deepEqual(r.applied, ['Height 60" → 62"', "Shelves 5 → 6"]);
  });
  it("conflicting clauses: the second is reported, not applied", () => {
    const r = refineProject(g("bookshelf 30 wide, 60 tall"), "2 inches taller, 4 inches shorter");
    assert.deepEqual(r.applied, ['Height 60" → 62"']);
    assert.equal(r.conflicts.length, 1);
  });
  it("nonsense is reported as not understood", () => {
    const r = refineProject(g("nightstand"), "paint it blue");
    assert.equal(r.project, null);
    assert.deepEqual(r.notUnderstood, ["paint it blue"]);
  });
  it("outdoor keeps every part, so supports never drop", () => {
    const b = g("garden bench");
    const r = refineProject(b, "outdoor");
    assert.deepEqual(r.project?.panels ?? b.panels, b.panels);
    assert.equal(r.notUnderstood.length, 0);
  });
  it("remove the doors never merges them into one", () => {
    const k = g("kitchen base cabinet");
    const r = refineProject(k, "remove the doors");
    if (r.project) assert.equal(r.project.panels.filter((p) => p.type === "door").length, 0);
    else assert.equal(r.refused.length, 1);
  });
  it("add drawers to a door cabinet is refused, not bolted in behind the doors", () => {
    for (const ph of ["add drawers", "add a drawer"]) {
      const r = refineProject(g("kitchen base cabinet"), ph);
      assert.equal(r.project, null, ph);
      assert.equal(r.refused.length, 1, ph);
    }
  });
  it("a bench stays a bench", () => {
    const b = g("garden bench");
    for (const ph of ["add a drawer", "2 inches taller", "use cedar"]) {
      const r = refineProject(b, ph);
      if (r.project) {
        assert.match(r.project.name.toLowerCase(), /garden bench/, ph);
        assert.equal(r.project.panels.filter((p) => p.type === "upright").length, 4, ph);
        assert.equal(r.project.panels.filter((p) => p.type === "divider").length, 2, `${ph}: supports kept`);
      }
    }
  });
  it("no fetch to xAI or the lookup", () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = ((u: unknown) => { urls.push(String(u)); throw new Error("no network"); }) as typeof fetch;
    try { for (const [q, ph] of [["nightstand", "add a drawer"], ["workbench", "use plywood"], ["bookshelf", "2 inches wider"]]) refineProject(g(q), ph); } finally { globalThis.fetch = real; }
    assert.equal(urls.length, 0);
  });
});

describe("refine chips are offered only when the engine supports the change", () => {
  const labels = (q: string) => refineChips(generateFromPrompt(q)).map((c) => c.label);
  it("bookcase: taller, wider, add a shelf; never a drawer it can't fit", () => {
    const l = labels("bookshelf 30 wide, 60 tall");
    for (const x of ["Taller", "Wider", "Add a shelf"]) assert.ok(l.includes(x), x);
  });
  it("plywood is not offered on a plywood build", () => assert.ok(!labels("bookshelf 30 wide, 60 tall").includes("Plywood")));
  it("kitchen base with doors: no drawer chip", () => assert.ok(!labels("kitchen base cabinet").includes("Add a drawer")));
  it("garden bench: no drawer or shelf chip", () => {
    const l = labels("garden bench");
    assert.ok(!l.includes("Add a drawer") && !l.includes("Add a shelf"));
  });
  it("every offered chip applies cleanly", () => {
    for (const q of ["nightstand", "desk", "workbench", "bookshelf", "medicine cabinet"]) {
      const p = generateFromPrompt(q);
      for (const c of refineChips(p)) assert.ok(refineProject(p, c.phrase).project, `${q}: ${c.label}`);
    }
  });
  it("no fetch while choosing chips", () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls++; throw new Error("no network"); }) as typeof fetch;
    try { for (const q of ["nightstand", "garden bench", "kitchen base cabinet"]) refineChips(generateFromPrompt(q)); } finally { globalThis.fetch = real; }
    assert.equal(calls, 0);
  });
});

it("refine keeps the form: remove doors keeps the carcase, add drawer on a bench builds it in a bay, outdoor drops nothing", () => {
  const bc = generateFromPrompt("bookcase 36 wide 72 tall with two doors");
  const r1 = refineProject(bc, "remove doors");
  assert.equal(r1.project?.panels.filter((p) => p.type === "upright").length, bc.panels.filter((p) => p.type === "upright").length);
  const r2 = refineProject(generateFromPrompt("entry bench 48 wide"), "add a drawer");
  // C41: a bench takes typed drawers in the bays under its seat (it used to refuse them).
  assert.deepEqual(r2.refused, []);
  assert.match(r2.project!.name, /bench/i);
  assert.equal(r2.project!.panels.filter((p) => p.drawerPart === "front").length, 1);
  // The drawer it adds is buildable from the plan: its slides are on Buy and the steps build, hang and front it (row 176).
  const plan2 = buildPlan(r2.project!);
  assert.ok(plan2.bom.some((b) => /side-mount drawer slides/i.test(b.name) && b.quantity === 1), "one pair of slides on Buy");
  const titles2 = plan2.instructions.map((s) => s.title);
  for (const re of [/^Build drawer sides, front, back, and bottom$/, /^Hang the drawer on \d+" slides$/, /^Fit the drawer front \(false front\)$/]) {
    assert.ok(titles2.some((t) => re.test(t)), `steps carry ${re}: ${titles2.join(" | ")}`);
  }
  const fit = plan2.instructions.find((s) => /^Fit the drawer front/.test(s.title))!;
  assert.ok(fit.partsUsed?.some((n) => /drawer front/i.test(n)), "the fit step owns the drawer front");
  for (const s of plan2.instructions.filter((s) => !/^(?:Cut|Fit)\b/.test(s.title))) {
    assert.ok(!(s.partsUsed ?? []).some((n) => /drawer front/i.test(n)), `${s.title} does not also set the drawer front`);
  }
  for (const q of ["entry bench 48 wide", "bookcase 36 wide 72 tall"]) {
    const before = generateFromPrompt(q);
    const r3 = refineProject(before, "outdoor");
    assert.deepEqual(r3.notUnderstood, []);
    assert.deepEqual(r3.project?.panels, before.panels, `${q}: outdoor keeps every part`);
    const bom = buildPlan(r3.project!).bom.map((b) => b.name).join(" | ");
    assert.match(bom, /exterior/i);
    assert.match(bom, /Titebond III/);
  }
});
