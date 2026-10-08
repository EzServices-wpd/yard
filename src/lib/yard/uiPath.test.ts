/**
 * The prompt bar builds what the engine builds. runYardPrompt (the bar and the homepage ?q=) used to
 * pre-parse a fitted brief and pass it as fittedOverride, which skipped every dedicated builder
 * (garbage-bin enclosure → "Cedar 1x4 box", picnic table → plywood carcase), and the AI hint /
 * interpretation / house-brief steps could swap any dedicated builder's form. Now the bar calls the
 * engine with the typed words only, and the AI steps never reshape a form the engine owns.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./prompt.ts";
import { engineOwnsForm } from "./form.ts";
import { useYard } from "./store.ts";
import { getCatalogItem } from "./catalog.ts";
import { promptNamingStock, speakCatalogStock } from "./promptHelpers.ts";
import { STRESS_PROMPTS } from "./stressPrompts.ts";
import type { YardProject } from "./types.ts";

// Offline bar: the same runYardPrompt the page runs, stopping before the network AI steps.
(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "?offline=1" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt.ts");

const sig = (p: YardProject) => `${p.name} | ${p.kind} | ${p.primaryMaterialId} | ${p.panels.length}`;
const names = (p: YardProject) => p.panels.map((x) => x.name ?? "");
const count = (p: YardProject, re: RegExp) => names(p).filter((n) => re.test(n)).length;
const bar = async (prompt: string) => {
  await runYardPrompt(prompt);
  return useYard.getState().project;
};

function assertEnclosure(p: YardProject, why: string) {
  assert.equal(p.kind, "custom", `${why}: ${p.name}`);
  assert.match(p.name, /Garbage bin enclosure for 2 bins/, why);
  assert.equal(count(p, /post/i), 6, `${why}: 6 posts (2 bays)`);
  assert.ok(count(p, /slat/i) > 20, `${why}: slatted walls`);
  assert.ok(count(p, /^Door 2 /), `${why}: a door per bay`);
  assert.ok(count(p, /^Lid 2 /), `${why}: a lid per bay`);
}

describe("prompt bar builds what the engine builds", () => {
  test("garbage-bin enclosure typed after another build is the 2-bay enclosure, not a cedar 1x4 box", async () => {
    await bar("maple 1x10 record console");
    const p = await bar("cedar garbage bin enclosure for two bins");
    assert.equal(sig(p), sig(generateFromPrompt("cedar garbage bin enclosure for two bins")));
    assertEnclosure(p, "bar");
    assert.ok(engineOwnsForm(p.prompt, p), "AI steps may not reshape it");
  });

  test("picnic table typed after a plywood build is real 2×6 picnic structure, not a plywood carcase", async () => {
    await bar("linen closet 31.5 wide 78 tall 16 deep");
    const p = await bar("picnic table");
    assert.equal(sig(p), sig(generateFromPrompt("picnic table")));
    assert.equal(p.kind, "custom");
    assert.equal(p.primaryMaterialId, "lumber-2x6-8");
    assert.equal(count(p, /^Leg /), 6);
    assert.equal(count(p, /^Tabletop board/), 5);
    assert.ok(engineOwnsForm(p.prompt, p), "AI steps may not reshape it");
  });

  test("switching stock in the picker keeps the enclosure form", async () => {
    for (const id of ["lumber-1x4-8", "plywood-3-4-4x8", "lumber-2x4-8"]) {
      const base = await bar("cedar garbage bin enclosure for two bins");
      const item = getCatalogItem(id)!;
      // CatalogPanel.useStock
      useYard.getState().generate(promptNamingStock(base.prompt, speakCatalogStock(item)), id, undefined, {
        fresh: true,
        keepView: true,
        restock: true,
      });
      assertEnclosure(useYard.getState().project, `restock ${id}`);
    }
  });

  test("an unmatched noun is still open to the AI lookup", () => {
    const p = generateFromPrompt("zorblax");
    assert.ok(p.unmatched, p.name);
    assert.equal(engineOwnsForm("zorblax", p), false);
  });

  test("every stress prompt: the bar's build equals generateFromPrompt", async () => {
    const bad: string[] = [];
    for (const raw of STRESS_PROMPTS) {
      const prompt = typeof raw === "string" ? raw : (raw as { prompt: string }).prompt;
      const ui = await bar(prompt);
      const eng = generateFromPrompt(prompt);
      if (sig(ui) !== sig(eng)) bad.push(`${prompt}\n  bar:    ${sig(ui)}\n  engine: ${sig(eng)}`);
    }
    assert.deepEqual(bad, []);
  });
});
