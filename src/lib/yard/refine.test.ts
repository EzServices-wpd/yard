import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { generateFromPrompt } from "./promptMain.ts";
import { refinePrompt, refineProject } from "./refine.ts";

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

describe("refineProject: one change to the current build, never a new one", () => {
  it("taller changes only the height", () => {
    const p = generateFromPrompt("bookshelf 30 wide, 60 tall, five shelves");
    const r = refineProject(p, "make it 6 inches taller");
    assert.ok(r.project);
    assert.deepEqual(r.changed, ['Height 60" → 66"']);
  });
  it("add a drawer reports the count", () => {
    const r = refineProject(generateFromPrompt("nightstand"), "add a drawer");
    assert.ok(r.project);
    assert.deepEqual(r.changed, ["Drawers 1 → 2"]);
  });
  it("free text is refused, nothing rebuilt", () => {
    const r = refineProject(generateFromPrompt("nightstand"), "paint it blue");
    assert.equal(r.project, null);
  });
  it("no fetch to xAI or the lookup", () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = ((u: unknown) => { urls.push(String(u)); throw new Error("no network"); }) as typeof fetch;
    try { for (const [q, ph] of [["nightstand", "add a drawer"], ["workbench", "use plywood"], ["bookshelf", "2 inches wider"]]) refineProject(generateFromPrompt(q), ph); } finally { globalThis.fetch = real; }
    assert.equal(urls.length, 0);
  });
});
