/** Spec 007 C2 · bought-item size table: every countable bought item builds as one real piece and passes I20. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { headerTitle } from "./pdf";
import { checkBuild } from "./invariants";
import { isUnitItem } from "./unitItems";
import { BOUGHT_SIZES } from "./unitSizes";
import { inchFrac } from "./inchText";

const corpus = [...new Set<string>([...SWEEPS.c2b.prompts, ...BOUGHT_SIZES.map((u) => u.key.replace(/-/g, " ").replace(/^nail 16d$/, "nail"))])];

test("C2/I20: every size-table bought item is a purchased item, one piece bought, no 0\" (whole class)", () => {
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    assert.ok(isUnitItem(p), q);
    const plan = buildPlan(p);
    assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I20").map((x) => x.msg), [], q);
    assert.doesNotMatch(headerTitle(p), /(?<![\d/.])0"|assumed/, q);
    assert.match(plan.bom.map((b) => b.notes ?? "").join(" "), /\b1 piece used\b/, q);
  }
});

test("C2: every size-table row cites a source and is one piece, not a pack", () => {
  for (const u of BOUGHT_SIZES) {
    assert.ok(u.source.length > 20, u.key);
    assert.ok(Math.max(u.dims.length ?? 0, u.dims.width ?? 0, u.dims.diameter ?? 0) <= 48, u.key);
  }
});

test("C2: a size under 1/32\" never prints as 0", () => {
  assert.equal(inchFrac(0.03), "0.03");
  assert.equal(inchFrac(0), "0");
  assert.equal(inchFrac(0.5), "1/2");
});

test("C2: bought-item words inside a bigger build stay that build", () => {
  for (const q of ["cork board 24 x 36", "button box", "nail organizer", "marble run"]) assert.ok(!isUnitItem(generateFromPrompt(q)), q);
});
