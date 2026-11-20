import test from "node:test";
import assert from "node:assert/strict";
import { FORGE_CATALOG } from "./catalog";
import { LISTINGS, decorateBom } from "./listings";
import { NAMED_LUMBER_SPECIES } from "./namedLumberSpecies";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const BOARDS = FORGE_CATALOG.filter((c) => c.category === "lumber" && /^lumber-\d+x\d+-\d+$/.test(c.id));
const label = (id: string) => id.replace(/^lumber-(\d+)x(\d+)-\d+$/, "$1×$2");

test("a named non-pine species board never takes a pine listing, for every species and every board", () => {
  const pine = new Set(LISTINGS.map((o) => o.title));
  for (const s of NAMED_LUMBER_SPECIES.filter((x) => x.id !== "pine")) {
    for (const b of BOARDS) {
      const [row] = decorateBom([{ name: `${s.display} ${label(b.id)}`, quantity: 3, unit: "boards", catalogId: b.id }]);
      for (const o of row.offers ?? []) assert.ok(!pine.has(o.title), `${s.display} ${label(b.id)} offered pine listing "${o.title}"`);
      assert.match(row.searchQuery ?? "", new RegExp(`^${s.display} `), `${s.display} ${label(b.id)} search drops the species`);
    }
  }
});

test("pine and unnamed boards keep the checked pine listings", () => {
  for (const b of BOARDS.filter((x) => LISTINGS.some((o) => o.catalogId === x.id))) {
    for (const name of [`Pine ${label(b.id)}`, b.name]) {
      const [row] = decorateBom([{ name, quantity: 2, unit: "boards", catalogId: b.id }]);
      assert.ok((row.offers ?? []).some((o) => LISTINGS.some((l) => l.catalogId === b.id && l.title === o.title)), `${name} lost its listing`);
    }
  }
});

test("a build's late species rows (walnut face trim) are priced as walnut", () => {
  const plan = buildPlan(generateFromPrompt("TV console 55 inch walnut"));
  const trim = plan.bom.find((b) => /^Walnut 1×3$/.test(b.name));
  assert.ok(trim && (trim.estimatedCost ?? 0) > 3.28, `Walnut 1×3 priced ${trim?.estimatedCost}`);
});
