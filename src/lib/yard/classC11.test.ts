/** C11 · whole bought items carry no cutting language; shelf pins are said in inches (whole class). */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { isUnitItem } from "./unitItems";
import { UNIT_SIZES, BOUGHT_SIZES } from "./unitSizes";
import { typedAxesTalk, headerTitle } from "./pdf";
import { cutListIntro, cutProgressRows, unletterWhole } from "./wholeItems";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { getCatalogItem } from "./catalog";

const words = (n: string) => n.replace(/^No\. 1 |^Standard |^Round wooden /, "").replace(/ \d.*$/, "").toLowerCase();
const corpus = [...new Set<string>([...SWEEPS.c11.prompts, ...SWEEPS.b8.prompts, ...SWEEPS.c3.prompts, ...SWEEPS.c2b.prompts, ...[...UNIT_SIZES, ...BOUGHT_SIZES].map((u) => words(u.name))])];

test("C11: every bought whole item and every shelf-pin build passes C11 (whole class)", () => {
  let whole = 0;
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "C11").map((x) => x.msg), [], q);
    if (!isUnitItem(p)) continue;
    whole++;
    assert.equal(typedAxesTalk(p).assumedTalk, "", `${q}: header assumes a known trade size`);
    assert.doesNotMatch(cutListIntro(plan), /first cut/, q);
    assert.ok(cutProgressRows(plan).every((c) => !c.whole), `${q}: whole piece counted as a cut`);
  }
  assert.ok(whole >= 30, `only ${whole} whole-item builds`);
});

test("C11: the zip tie reads as bought", () => {
  const p = generateFromPrompt("zip tie");
  const plan = buildPlan(p);
  assert.doesNotMatch(plan.instructions.map((s) => s.description).join(" "), /\bOne A\b/);
  assert.match(plan.instructions[0].description, /One 8" cable tie at its real size/);
  assert.equal(namedStockDisplayName("zip tie", getCatalogItem(p.primaryMaterialId)), '8" cable tie');
  assert.doesNotMatch(typedAxesTalk(p).subtitle, /assumed|measure to lock/);
  assert.equal(cutListIntro(plan), "Whole pieces, used as bought. Nothing to cut.");
});

test("C11: a bracelet keeps its real cord cut and counts only it", () => {
  const plan = buildPlan(generateFromPrompt("pony bead bracelet"));
  assert.ok(plan.instructions.some((s) => /Cut 1\/32" stretch cord/.test(s.description)));
  assert.doesNotMatch(plan.instructions.map((s) => s.description).join(" "), /\bA beads?\b/);
});

test("C11: linen and the bookcase say shelf pins in inches; linen's header, price and cuts are unchanged", () => {
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "bookcase 36 wide 72 tall 12 deep"]) {
    const plan = buildPlan(generateFromPrompt(q));
    const all = [...plan.bom.map((b) => b.name), ...plan.instructions.map((s) => `${s.description} ${s.tips ?? ""}`)].join(" ");
    assert.doesNotMatch(all, /\d\s*mm\b/, q);
    assert.ok(plan.bom.some((b) => b.name === '3/16" shelf pins'), q);
    assert.match(all, /Drill 13\/64" pin holes/, q);
  }
  const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const plan = buildPlan(p);
  assert.equal(headerTitle(p).split(" · ").slice(0, 2).join(" · "), 'Linen · 31 1/2" W × 16" D × 78" H');
  assert.equal(plan.totals.estCostUsd.toFixed(2), "183.70");
});

test("C11: multi-word names never prefix the Material chip with their first word", () => {
  assert.equal(namedStockDisplayName("pipe cleaner", getCatalogItem("piece-pipe-cleaner")), 'Chenille stem 12"');
  assert.equal(namedStockDisplayName("craft stick", getCatalogItem("popsicle-standard")), "Standard Popsicle Stick");
  assert.equal(namedStockDisplayName("titebond", getCatalogItem("glue")), "Titebond · Wood glue");
});

test("C11: unletterWhole drops a whole piece's letter, keeps an article", () => {
  const rows = [{ id: "x", label: "A", name: "Bead", whole: true, quantity: 1, lengthIn: 1, widthIn: 1, thicknessIn: 1, material: "m" }] as never;
  assert.equal(unletterWhole("Slide a bead on. All 30 A beads sit. One A Bead.", rows), "Slide a bead on. All 30 beads sit. One Bead.");
});
