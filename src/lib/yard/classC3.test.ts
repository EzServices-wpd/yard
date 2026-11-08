/** Spec 006 C3 · purchased whole items: I20 over the whole class (every unit-table item × every shape it makes). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { headerTitle } from "./pdf";
import { checkBuild } from "./invariants";
import { UNIT_SIZES } from "./unitSizes";
import { isUnitItem, pluralUnit } from "./unitItems";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";

const words = (name: string) => name.replace(/^No\. 1 |^Standard |^Round wooden /, "").replace(/ \d.*$/, "").toLowerCase();
const corpus = [
  ...SWEEPS.c3.prompts,
  ...UNIT_SIZES.flatMap((u) => {
    const w = words(u.name);
    return [w, ...(u.key === "paper-clip" ? [`${w} chain`, `${w} necklace`, `${w} bracelet`] : []), ...(u.key.endsWith("bead") ? [`${w} bracelet`, `${w} necklace`] : []), ...(u.key.startsWith("washer") ? [`${w} tower`] : [])];
  }),
];

test("C3/I20: every purchased-item build passes I20 and its header is not assumed", () => {
  let built = 0;
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    if (!isUnitItem(p)) continue;
    built++;
    const v = checkBuild(p, q).filter((x) => x.id === "I20");
    assert.deepEqual(v, [], q);
    assert.doesNotMatch(headerTitle(p), /assumed/, q);
  }
  assert.ok(built >= 20, `only ${built} purchased-item builds`);
});

test("C3: the 20-prompt sweep all build as purchased items", () => {
  for (const q of SWEEPS.c3.prompts) assert.ok(isUnitItem(generateFromPrompt(q)), q);
});

test("C3: paper clip loops are linked clips (no cord), chains say 'nearest whole clip', clips are wire loops", () => {
  const n = generateFromPrompt("paper clip necklace");
  const plan = buildPlan(n);
  assert.ok(n.panels.every((x) => /^Clip \d+$/.test(x.name) && (x.polygon?.pts.length ?? 0) > 20));
  assert.ok(!plan.bom.some((b) => /cord/i.test(b.name)));
  assert.match(plan.instructions.map((s) => s.description).join(" "), /last clip through the end loop of the first/);
  for (const len of [6, 10, 12, 18]) {
    const p = generateFromPrompt(`paper clip chain ${len} inches long`);
    if (Math.abs(p.overall.width - len) > 0.125) assert.ok((p.notes ?? []).some((x) => /nearest whole clip/.test(x)), String(len));
  }
});

test("C3: whole dowel Buy line agrees with the step; jumbo stick from the table; plural on the noun", () => {
  const plan = buildPlan(generateFromPrompt("3/8 dowel"));
  assert.match(plan.bom.find((b) => /dowel/i.test(b.name))!.notes ?? "", /used as bought/);
  const j = generateFromPrompt("jumbo craft stick");
  assert.deepEqual([j.panels.length, j.panels[0].materialId, j.overall.width, j.overall.depth], [1, "popsicle-jumbo", 6, 0.75]);
  assert.equal(pluralUnit("Pony bead 9 × 6 mm"), "Pony beads 9 × 6 mm");
});
