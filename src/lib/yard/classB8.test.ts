/** Spec 008 · bought-item path (I20 + I24): no whole-piece cut rows, no blank sizes, inches only, round pieces "across", typed title. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { isUnitItem } from "./unitItems";
import { UNIT_SIZES, BOUGHT_SIZES } from "./unitSizes";
import { mmToInches } from "./inchText";

const words = (n: string) => n.replace(/^No\. 1 |^Standard |^Round wooden /, "").replace(/ \d.*$/, "").toLowerCase();
const corpus = [...new Set<string>([...SWEEPS.b8.prompts, ...SWEEPS.c3.prompts, ...SWEEPS.c2b.prompts, ...[...UNIT_SIZES, ...BOUGHT_SIZES].map((u) => words(u.name))])];

test("B8/I20+I24: every bought-item build passes I20 and I24 (whole class)", () => {
  let n = 0;
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    if (!isUnitItem(p)) continue;
    n++;
    const plan = buildPlan(p);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I20" || x.id === "I24").map((x) => x.msg), [], q);
    assert.ok(plan.cutList.every((c) => c.lengthIn > 0 && c.widthIn > 0 && c.thicknessIn > 0), `${q}: blank cut-list size`);
    assert.ok(plan.cutList.every((c) => c.whole || /cord/i.test(c.name)), `${q}: whole piece listed as a cut`);
    assert.doesNotMatch([...p.notes, ...plan.instructions.map((s) => s.description), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join(" "), /\d\s*mm\b/, q);
  }
  assert.ok(n >= 30, `only ${n} bought-item builds`);
});

test("B8: round pieces are sized across, long pieces long", () => {
  for (const q of ["marble", "pony bead", "cotton ball", "button", "bottle cap"]) assert.match(generateFromPrompt(q).notes.join(" "), /" across/, q);
  assert.match(generateFromPrompt("washer").notes.join(" "), /" disc/);
  assert.match(generateFromPrompt("wine cork").notes.join(" "), /1 3\/4" long, 15\/16" across/);
  for (const q of ["marble", "pony bead", "cotton ball"]) assert.doesNotMatch(generateFromPrompt(q).notes.join(" "), /" long/, q);
  assert.match(generateFromPrompt("zip tie").notes.join(" "), /8" long/);
});

test("B8: the typed noun is the title", () => {
  assert.equal(generateFromPrompt("zip tie").name, "Zip tie");
  assert.equal(generateFromPrompt("pipe cleaner").name, "Pipe cleaner");
  assert.match(generateFromPrompt("3/8 dowel").name, /Dowel/);
  assert.match(generateFromPrompt("paper clip").name, /paper clip/i);
});

test("B8: mm text converts to inch fractions", () => {
  assert.equal(mmToInches("4.8 mm × 1.3 mm strap"), '3/16" × 1/16" strap');
  assert.equal(mmToInches("Pony bead 9 × 6 mm"), 'Pony bead 3/8" × 1/4"');
  assert.equal(mmToInches("Φ2.5 mm shaft"), '1/8" shaft');
});
