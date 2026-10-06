import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { getCatalogItem } from "./catalog";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p), notes: (p.notes ?? []).join(" ") };
};

describe("a typed species carries on unknown nouns; named recipes keep their own title", () => {
  it("walnut snorflax: title, notes and Buy say Walnut", () => {
    const { p, plan, notes } = build("walnut snorflax 18 tall");
    assert.equal(p.name, "Walnut Snorflax");
    assert.match(notes, /Walnut 1×4/);
    assert.ok(plan.bom.some((b) => /^Walnut 1×4$/.test(b.name)));
  });
  it("pine step stool 20 inches tall keeps a bare title, Pine on the cut list", () => {
    const { p, plan } = build("pine step stool 20 inches tall");
    assert.match(p.name, /^Step stool/);
    assert.ok(plan.cutList.every((c) => !/^lumber-/.test(c.id) || /^Pine /.test(c.material ?? "")));
  });
});

describe("a storage noun in a named opening builds the fitted unit there", () => {
  it("bookshelf in the wall nook is a fitted bookcase, not cleated wall shelves", () => {
    const { p } = build("bookshelf in the wall nook 40 wide 60 tall 10 deep");
    assert.match(p.name, /^Bookcase/);
    assert.equal(p.fitted?.opening.kind, "alcove");
    assert.ok(!p.panels.some((x) => /wall cleat/i.test(x.name)));
  });
  it("floating shelves in the nook stay floating shelves", () => {
    assert.match(build("floating shelves in the wall nook 30 wide 40 tall 8 deep").p.name, /^Floating shelves/);
  });
});

describe("a typed cue that changes what the thing normally is says so", () => {
  it("dresser no drawers", () => {
    assert.match(build("dresser no drawers").notes, /A dresser normally has drawers\. You typed "no drawers", so this one is a plain carcase with an open front\./);
  });
  it("pantry with no doors", () => {
    assert.match(build("pantry with no doors").notes, /A pantry normally has doors\./);
  });
  it("bookcase no doors (a bookcase has no doors anyway) says nothing", () => {
    assert.doesNotMatch(build("bookcase no doors").notes, /normally has/);
  });
});

describe("a typed board snaps a close default depth to its face; notes say plain stock", () => {
  it("step stool 2 steps pine 1x10: treads are one 9 1/4\" board, bought as one 1×10", () => {
    const { p, plan, notes } = build("step stool 2 steps pine 1x10");
    const treads = p.panels.filter((x) => /tread/i.test(x.name));
    assert.ok(treads.length && treads.every((t) => t.size.depth === 9.25), JSON.stringify(treads.map((t) => t.size)));
    assert.match(notes, /one board wide \(9 1\/4"\), not 11" glued up/);
    assert.equal(plan.bom.find((b) => b.name === "Pine 1×10")?.quantity, 1);
  });
  it("bookshelf from 1x10 is 9 1/4\" deep and its notes say 1×10, not the catalog row", () => {
    const { p, notes } = build("bookshelf from 1x10");
    assert.equal(p.overall.depth, 9.25);
    assert.doesNotMatch(notes, /Board \(8 ft\)/);
    assert.match(notes, /one 1×10 wide \(9 1\/4"\)/);
  });
  it("a typed depth keeps its glue-up", () => {
    assert.equal(build("bookshelf from 1x10 12 deep").p.overall.depth, 12);
  });
});

describe("a species carries to every lumber part and Buy row", () => {
  it("picnic table 6 ft cedar: bench legs are Cedar too, and every lumber part is bought", () => {
    const { plan } = build("picnic table 6 ft cedar");
    const lumber = plan.cutList.filter((c) => getCatalogItem(c.id.split("|")[0])?.category === "lumber");
    assert.ok(lumber.length && lumber.every((c) => /^Cedar /.test(c.material ?? "")), JSON.stringify(lumber.map((c) => c.material)));
    const rows = plan.bom.filter((b) => getCatalogItem(b.catalogId ?? "")?.category === "lumber");
    assert.ok(rows.length && rows.every((b) => /^Cedar /.test(b.name)), JSON.stringify(rows.map((b) => b.name)));
  });
});
