/** UX Batch B (#38): cut-list rows and sheet pieces carry the 3D part ids (data-part) they cover. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { getCatalogItem } from "./catalog";
import { planOverviewSvg } from "./planStepPicture";

const P = JSON.parse(readFileSync("evals/prompts.json", "utf8"));
const PROMPTS: string[] = (P.prompts ?? P).map((x: string | { prompt: string }) => (typeof x === "string" ? x : x.prompt));
// Bought whole, never cut: mirrors, glass and window units, hooks and other hardware, fabric covers.
const bought = (p: { type?: string; materialId: string }) =>
  p.type === "mirror" || p.type === "glass_panel" || /^(?:hardware|window-unit)$/.test(p.materialId) || !getCatalogItem(p.materialId)?.formFactor;

test("every cut-list row's partIds resolve to real model parts, and every cut part is covered", () => {
  for (const q of PROMPTS) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const ids = new Set([...(p.panels ?? []).map((x) => x.id), ...(p.instances ?? []).map((x) => x.id)]);
    const covered = new Set<string>();
    for (const r of plan.cutList) {
      assert.ok(Array.isArray(r.partIds) && r.partIds.length > 0, `${q}: row ${r.label} ${r.name} has no partIds`);
      for (const id of r.partIds!) { assert.ok(ids.has(id), `${q}: ${r.name} → unknown part ${id}`); covered.add(id); }
    }
    if (!plan.cutList.length) continue;
    for (const x of p.panels ?? []) if (!bought(x)) assert.ok(covered.has(x.id), `${q}: cut part ${x.name} is on no cut-list row`);
    for (const x of p.instances ?? []) assert.ok(covered.has(x.id), `${q}: member ${x.id} is on no cut-list row`);
  }
});

test("every sheet-layout piece carries partIds from its row", () => {
  for (const q of PROMPTS) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const ids = new Set((p.panels ?? []).map((x) => x.id));
    for (const nest of [plan.sheetNest?.sheets, plan.sheetNest?.backer])
      for (const s of nest?.sheets ?? []) for (const pc of s.parts) {
        assert.ok(pc.partIds?.length, `${q}: sheet piece ${pc.label} ${pc.name} has no partIds`);
        for (const id of pc.partIds!) assert.ok(ids.has(id), `${q}: sheet piece → unknown part ${id}`);
      }
  }
});

test("partIds are the same ids planOverviewSvg draws as data-part", () => {
  const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const svg = planOverviewSvg(p).svg;
  for (const r of buildPlan(p).cutList) for (const id of r.partIds!) if (!/drawer/.test(r.name.toLowerCase())) assert.match(svg, new RegExp(`data-part="${id}"`), r.name);
});
