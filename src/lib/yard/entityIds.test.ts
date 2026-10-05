import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { lookupRealForm, lookupRealMeasures, stripEntityIds } from "./wiki.ts";
import { recipeFromAnatomy } from "./form.ts";
import { isRepeatPrompt, refinedPrompt } from "./promptHelpers.ts";

const ENTITY = /\(Q\d+/;
const realFetch = globalThis.fetch;

/** Wikidata + Wikipedia answers for "lemonade stand", as the live walk saw them. */
function stubLookup() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const body = url.includes("wbsearchentities")
      ? { search: [{ id: "Q135209751", label: "Lemonade Stand", description: "American business run by children" }] }
      : url.includes("wbgetentities")
        ? { entities: { Q135209751: { labels: { en: { value: "Lemonade Stand" } }, claims: {} } } }
        : { title: "Lemonade stand", extract: "A lemonade stand (Q135209751) is a business that sells lemonade." };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Wikidata entity ids never reach titles or notes", () => {
  it("stripEntityIds drops (Q…), [Q…], (wd:Q…) and 'wikidata Q…' only", () => {
    assert.equal(stripEntityIds("Lemonade Stand (Q135209751) · American"), "Lemonade Stand · American");
    assert.equal(stripEntityIds("Eiffel Tower [Q243]"), "Eiffel Tower");
    assert.equal(stripEntityIds("Taj Mahal (wd:Q9141) tomb"), "Taj Mahal tomb");
    assert.equal(stripEntityIds("see wikidata Q9141 for more"), "see for more");
    assert.equal(stripEntityIds("Q3 shelf, 12 in"), "Q3 shelf, 12 in");
  });

  it("lemonade stand lookup: label and summary are the English label, id kept internally", async () => {
    stubLookup();
    const m = await lookupRealMeasures("lemonade stand");
    assert.ok(m);
    assert.equal(m.id, "Q135209751");
    assert.equal(m.label, "Lemonade Stand");
    assert.doesNotMatch(m.summary, ENTITY);
    assert.doesNotMatch(m.summary, /Q\d+/);
    const form = await lookupRealForm("lemonade stand");
    assert.doesNotMatch(form.summary, ENTITY);
    assert.match(form.summary, /^Lemonade Stand · American/);
  });

  it("lemonade stand title from the looked-up path reads the typed words, no Q", async () => {
    stubLookup();
    const { summary } = await lookupRealForm("lemonade stand");
    const size = { width: 36, height: 48, depth: 24 };
    const recipe = recipeFromAnatomy(`lemonade stand ${summary}`, size, "lemonade stand");
    assert.equal(recipe.name, "Lemonade Stand");
    assert.doesNotMatch(recipe.name, ENTITY);
    for (const note of recipe.notes) assert.doesNotMatch(note, ENTITY);
    // Even an old summary that still carried the id cannot leak into a title or densify note.
    for (const p of ["lemonade stand Lemonade Stand (Q135209751) · American", "lattice tower (Q12518) 40 in tall"]) {
      const r = recipeFromAnatomy(p, size);
      assert.doesNotMatch(r.name, ENTITY, p);
      for (const note of r.notes) assert.doesNotMatch(note, ENTITY, p);
    }
  });
});

describe("refining never grows '. Then:' on a repeat", () => {
  it("same prompt or empty is a repeat, not a refinement", () => {
    assert.equal(isRepeatPrompt("lemonade stand", "lemonade stand"), true);
    assert.equal(isRepeatPrompt("  Lemonade Stand. ", "lemonade stand"), true);
    assert.equal(isRepeatPrompt("lemonade stand", "lemonade stand. Then: taller"), true);
    assert.equal(isRepeatPrompt("", "lemonade stand"), true);
    assert.equal(isRepeatPrompt("taller", "lemonade stand"), false);
    // Fallback nouns remap the bench prompt; the bench name is still the typed words.
    assert.equal(isRepeatPrompt("lemonade stand", "table 48 wide 42 tall 24 deep", "Lemonade Stand"), true);
    assert.equal(isRepeatPrompt("taller", "table 48 wide 42 tall 24 deep", "Lemonade Stand"), false);
    assert.equal(refinedPrompt("lemonade stand", "lemonade stand"), "lemonade stand");
    assert.equal(refinedPrompt("lemonade stand", ""), "lemonade stand");
  });

  it("different words refine once; repeated refining keeps one '. Then:'", () => {
    let p = "lemonade stand";
    p = refinedPrompt(p, "taller");
    assert.equal(p, "lemonade stand. Then: taller");
    p = refinedPrompt(p, "taller");
    p = refinedPrompt(p, "lemonade stand");
    assert.equal((p.match(/\. Then:/g) ?? []).length, 0);
    p = refinedPrompt("lemonade stand. Then: taller", "wider");
    assert.equal(p, "lemonade stand. Then: wider");
  });

  it("store.generate twice with the same typed prompt leaves the prompt box unchanged", async () => {
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
    // The looked-up pass builds from a form recipe, then the interpretation pass re-runs the same words.
    const size = { width: 48, height: 42, depth: 24 };
    const looked = recipeFromAnatomy("lemonade stand Lemonade Stand · American business run by children", size, "lemonade stand");
    useYard.getState().generate("lemonade stand", undefined, looked, { fresh: true });
    const first = useYard.getState().project.prompt;
    assert.doesNotMatch(first, /Then:/);
    useYard.getState().generate("lemonade stand", undefined, looked);
    useYard.getState().generate("Lemonade stand ");
    const after = useYard.getState().project.prompt;
    assert.doesNotMatch(after, /Then:/, after);
    assert.doesNotMatch(useYard.getState().project.name, ENTITY);
    // A genuine refinement still appends once.
    useYard.getState().setProject({ ...useYard.getState().project, prompt: "lemonade stand" });
    useYard.getState().generate("taller");
    assert.equal(useYard.getState().project.prompt.match(/\. Then:/g)?.length ?? 0, 1);
  });
});
