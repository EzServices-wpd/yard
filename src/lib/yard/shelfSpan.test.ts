import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { isFixedSpanShelf, shelfDepthSpan, shelfSpanLimit, shelfSpanViolations } from "./shelfSpan";
import { solidsOverlap } from "./solids";
import { supportsOf } from "./supportGraph";
import { shelfSpansUprights } from "./report";
import { panelJoints } from "./modelJoints";
import { BUY_JOINTS, stepScrewCount } from "./stepJointScrews";
import { corpus } from "../../../scripts/invariants-corpus.ts";

/** The 55 carcass probes that spanned 3/4" plywood with no centre support (row 206). */
const SPAN_PROBES = `
bookcase
bookcase 36x14x66
bookcase 76 tall
bookcase 14 deep
cabinet
cabinet 36x18x28
cabinet 38 tall
cabinet 18 deep
linen closet
linen closet 82 tall
linen closet 18 deep
wardrobe
wardrobe 46x26x66
wardrobe 36 wide
wardrobe 76 tall
wardrobe 26 deep
pantry cabinet
pantry cabinet 88 tall
pantry cabinet 18 deep
bookcase 22-1/2 deep
bookcase 5ft6in tall
cabinet 2ft10in tall
bookcase from 3/4 plywood
cabinet from pine boards
linen closet from 1x12s
linen closet from MDF
wardrobe from 1x12s
wardrobe from MDF
pantry cabinet from oak
pantry cabinet from exterior plywood
bookcase with glass doors
bookcase with 3 shelves
bookcase with 4 adjustable shelves
bookcase with 2 drawers at the bottom
bookcase on casters
cabinet with 1 door
cabinet with 2 doors and 2 drawers
cabinet with glass doors
cabinet on wheels
linen closet with 6 shelves
linen closet with 1 door
linen closet with 2 drawers
linen closet with glass doors and 5 shelves
wardrobe with 2 drawers
wardrobe with 1 door
wardrobe with 3 shelves
wardrobe on casters
pantry cabinet with 6 adjustable shelves
pantry cabinet with 2 drawers
pantry cabinet on wheels
pantry cabinet with 1 door
wardrobe 8 deep
pantry cabinet with 40 shelves 60 tall
bookcase with 0 shelves
garage cabinet 36 x 18 x 72 from 3/4 plywood with 2 doors
`.trim().split("\n");

const dividers = (prompt: string, stock?: string) =>
  generateFromPrompt(prompt, stock).panels.filter((p) => /^Center divider\b/.test(p.name));
const cols = (prompt: string, stock?: string) =>
  new Set(dividers(prompt, stock).map((p) => Math.round(p.position.x * 4) / 4)).size;

describe("shelf span supports", () => {
  it("keeps the linen closet canary at 31 1/2 × 16 × 78, 11 parts, $183.70", () => {
    const prompt = "linen closet 31.5 wide 78 tall 16 deep";
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    assert.deepEqual([project.overall.width, project.overall.depth, project.overall.height], [31.5, 16, 78]);
    assert.equal(plan.totals.pieces, 11);
    assert.equal(plan.totals.estCostUsd, 183.7);
    assert.equal(dividers(prompt).length, 0);
    assert.deepEqual(shelfSpanViolations(project), []);
  });

  it("puts a center divider on a 36 inch bookcase in the model, cut list, steps and buy", () => {
    const project = generateFromPrompt("bookcase");
    const plan = buildPlan(project);
    const parts = project.panels.filter((p) => /^Center divider\b/.test(p.name));
    assert.ok(parts.length >= 1);
    assert.equal(shelfSpanViolations(project).length, 0);
    assert.equal(project.panels.filter((p) => p.name.startsWith("Center support")).length, 0);
    const ids = new Set(parts.map((p) => p.id));
    const cut = plan.cutList.filter((c) => (c.partIds ?? []).some((id) => ids.has(id)));
    assert.equal(cut.reduce((n, c) => n + c.quantity, 0), parts.length);
    assert.ok(plan.instructions.some((s) => /Center divider/.test(`${s.title} ${s.description} ${(s.partsUsed ?? []).join(" ")}`)));
    assert.ok(plan.bom.some((b) => b.catalogId === parts[0].materialId));
    assert.ok(plan.bom.some((b) => b.catalogId === "shelf-pins"));
    assert.match(parts[0].cutNote ?? "", /pin holes on both faces/);
    const shelves = project.panels.filter((p) => p.type === "shelf");
    assert.equal(shelves.length, 5);
    assert.equal(new Set(shelves.map((s) => s.name)).size, shelves.length);
    assert.match(plan.instructions.find((s) => /Pin /.test(s.title))?.title ?? "", /Pin 5 adjustable shelves/);
    assert.match(plan.bom.find((b) => b.catalogId === "shelf-pins")?.notes ?? "", /5 shelves × 4/);
    assert.equal(project.panels.some((q) => parts.some((d) => d !== q && solidsOverlap(d, q))), false);
    const looseIds = new Set(shelves.filter((s) => !isFixedSpanShelf(s)).map((s) => s.id));
    assert.equal(
      panelJoints(project.panels).some((j) => (ids.has(j.a) && looseIds.has(j.b)) || (ids.has(j.b) && looseIds.has(j.a))),
      false,
    );
    assert.ok((BUY_JOINTS.get(project) ?? []).some((j) => j.screws > 0 && (ids.has(j.a) || ids.has(j.b))));
    assert.deepEqual(checkBuild(project, "bookcase", plan).map((v) => v.id), []);
  });

  it("adds a divider for 1/2 inch at 30 inches and leaves 3/4 inch open", () => {
    const prompt = "bookcase 30 wide 12 deep 72 tall";
    const thick = generateFromPrompt(prompt, "plywood-3-4-4x8");
    const half = generateFromPrompt(prompt, "plywood-1-2-4x8");
    assert.equal(thick.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 0);
    assert.ok(half.panels.some((p) => /^Center divider\b/.test(p.name)));
    assert.equal(half.panels.filter((p) => p.name.startsWith("Center support")).length, 0);
    assert.deepEqual([half.overall.width, half.overall.height, half.overall.depth], [thick.overall.width, thick.overall.height, thick.overall.depth]);
    for (const type of ["door", "upright"] as const) {
      assert.equal(half.panels.filter((p) => p.type === type).length, thick.panels.filter((p) => p.type === type).length);
    }
    assert.equal(half.panels.filter((p) => p.type === "shelf").length, thick.panels.filter((p) => p.type === "shelf").length);
    assert.equal(shelfSpanViolations(half).length, 0);
    assert.equal(checkBuild(half, prompt, buildPlan(half)).some((v) => v.id === "I14"), false);
  });

  it("keeps one divider column when a 36 inch bookcase switches from 3/4 to 1/2", () => {
    assert.equal(cols("bookshelf 36 wide", "plywood-3-4-4x8"), 1);
    assert.equal(cols("bookshelf 36 wide", "plywood-1-2-4x8"), 1);
    const half = generateFromPrompt("bookshelf 36 wide", "plywood-1-2-4x8");
    assert.equal(half.panels.filter((p) => p.name.startsWith("Center support")).length, 0);
    assert.equal(half.panels.filter((p) => p.type === "shelf").length, 5);
  });

  it("does not divide a shallow spice rack or run a divider through a jar lip", () => {
    for (const prompt of [
      "spice rack",
      "spice rack for kitchen wall 30 inches",
      "spice rack wall mounted 24 inches",
      "wall mounted spice rack 18 inches",
    ]) {
      const project = generateFromPrompt(prompt);
      assert.equal(project.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 0, prompt);
      assert.equal(project.panels.some((p) => /jar lip/i.test(p.name)), true, prompt);
    }
  });

  it("leaves the hanging rod one piece and keeps the divider out of that bay", () => {
    const project = generateFromPrompt("wardrobe");
    assert.equal(project.panels.filter((p) => p.name === "Hanging rod").length, 1);
    const rod = project.panels.find((p) => p.name === "Hanging rod")!;
    for (const div of project.panels.filter((p) => /^Center divider\b/.test(p.name))) {
      assert.equal(solidsOverlap(div, rod), false);
      const y0 = div.position.y;
      const y1 = y0 + div.size.height;
      const overlapsY = y1 > rod.position.y && y0 < rod.position.y + rod.size.height;
      assert.equal(overlapsY, false);
    }
    assert.equal(shelfSpanViolations(project).length, 0);
    const rodTop = rod.position.y + rod.size.height;
    for (const part of project.panels) {
      if (part === rod) continue;
      const ox = Math.min(part.position.x + part.size.width, rod.position.x + rod.size.width) - Math.max(part.position.x, rod.position.x);
      const oz = Math.min(part.position.z + part.size.depth, rod.position.z + rod.size.depth) - Math.max(part.position.z, rod.position.z);
      if (part.type === "shelf" || ox < 0.5 || oz < 0.5) continue;
      assert.ok(part.position.y >= rodTop + 2 - 0.02 || part.position.y + part.size.height <= rodTop + 0.02, `${part.name} is within 2" of the rod`);
    }
    assert.equal(project.panels.some((p) => /^Span cleat\b/.test(p.name)), false);
    const sup = supportsOf(project);
    const loose = new Set(project.panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p) && shelfSpansUprights(p, project.panels)).map((p) => p.id));
    for (const div of project.panels.filter((p) => /^Center divider\b/.test(p.name))) {
      const info = sup.get(div.id);
      assert.equal(info?.on.some((id) => loose.has(id)) ?? false, false, div.name);
    }
    const plan = buildPlan(project);
    const planText = plan.instructions.map((s) => s.description).join("\n");
    assert.doesNotMatch(planText, /Fasten the Center divider to the .*Shelf/i);
    const bought = BUY_JOINTS.get(project) ?? [];
    const divIds = new Set(project.panels.filter((p) => /^Center divider\b/.test(p.name)).map((p) => p.id));
    assert.ok(bought.some((j) => j.screws > 0 && (divIds.has(j.a) || divIds.has(j.b))));
    const screwLine = Number(plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""))?.notes?.match(/(\d+) screws/)?.[1] ?? NaN);
    assert.equal(stepScrewCount(plan), screwLine);
  });

  it("supports the shelf over a wide hanging bay without crossing the rod", () => {
    for (const prompt of ["wardrobe 48 wide", "wardrobe 72 wide"]) {
      const project = generateFromPrompt(prompt);
      assert.equal(shelfSpanViolations(project).length, 0, prompt);
      const rod = project.panels.find((p) => p.name === "Hanging rod")!;
      assert.ok(rod);
      for (const part of project.panels.filter((p) => /^Center divider\b/.test(p.name) || /^Span cleat\b/.test(p.name))) {
        assert.equal(solidsOverlap(part, rod), false, `${prompt} ${part.name}`);
        const overlapsY = part.position.y + part.size.height > rod.position.y && part.position.y < rod.position.y + rod.size.height;
        assert.equal(overlapsY, false, `${prompt} ${part.name}`);
      }
      const lines = new Set(project.panels.filter((p) => p.type === "shelf").map((p) => Math.round(p.position.y * 4) / 4));
      assert.equal(lines.size, project.fitted?.unit.shelfCount);
    }
  });

  it("keeps every shelf piece within the stock limit after overlap cleanup", () => {
    const prompts = ["kids playhouse for a 5 year old", "pantry cabinet 36x18x78"];
    for (const prompt of prompts) {
      const project = generateFromPrompt(prompt);
      assert.deepEqual(shelfSpanViolations(project), [], prompt);
      for (const shelf of project.panels.filter((p) => p.type === "shelf" && !p.outline)) {
        const thick = Math.min(shelf.size.width, shelf.size.height, shelf.size.depth);
        const limit = shelfSpanLimit(shelf.materialId, thick);
        const depth = shelfDepthSpan(shelf, project.panels);
        assert.ok(depth <= limit + 1 / 32, `${prompt} ${shelf.name} depth ${depth.toFixed(1)} > ${limit}`);
      }
    }
  });

  it("matches the divider step's fasteners to Buy when a shelf count is typed", () => {
    const prompt = "bookcase 36 wide 12 deep 72 tall with three shelves";
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const step = plan.instructions.find((s) => /center divider/i.test(s.title));
    assert.ok(step);
    assert.doesNotMatch(step.description, /Shelf[^.]*Fasten it with #8/i);
    assert.match(step.description, /takes no screws|Screw through the bottom/);
    const bought = Number(plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""))?.notes?.match(/(\d+) screws/)?.[1] ?? NaN);
    assert.equal(stepScrewCount(plan), bought);
    const open = buildPlan(generateFromPrompt("bookcase"));
    const openBought = Number(open.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""))?.notes?.match(/(\d+) screws/)?.[1] ?? NaN);
    assert.equal(stepScrewCount(open), openBought);
  });

  it("leaves cardboard and the desk knee without a span divider", () => {
    const card = generateFromPrompt("bookshelf 36 wide 72 tall", "cardboard-corrugated-sheet");
    assert.equal(card.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 0);
    assert.ok((card.panels.find((p) => /^Shelf 1/.test(p.name))?.size.width ?? 0) > 35.5);
    const desk = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
    const plan = buildPlan(desk);
    assert.equal(desk.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 0);
    assert.equal(plan.totals.pieces, 41);
    assert.equal(plan.totals.estCostUsd, 381.97);
  });

  it("holds every corpus and probe carcass shelf inside its stock limit", () => {
    const prompts = [...new Set([...corpus(), ...SPAN_PROBES])];
    const bad: string[] = [];
    for (const prompt of prompts) {
      const project = generateFromPrompt(prompt);
      const hits = shelfSpanViolations(project);
      if (hits.length) bad.push(`${prompt}: ${hits[0].name} ${hits[0].span.toFixed(1)} > ${hits[0].limit}`);
      for (const shelf of project.panels.filter((p) => p.type === "shelf" && !p.outline)) {
        const thick = Math.min(shelf.size.width, shelf.size.height, shelf.size.depth);
        const limit = shelfSpanLimit(shelf.materialId, thick);
        const sharesSupport = project.panels.some(
          (q) =>
            q.name.startsWith("Center support") &&
            q.position.y < shelf.position.y + shelf.size.height &&
            q.position.y + q.size.height > shelf.position.y - 0.2,
        );
        if (sharesSupport && shelfDepthSpan(shelf, project.panels) > limit + 1 / 32) {
          bad.push(`${prompt}: ${shelf.name} depth ${shelfDepthSpan(shelf, project.panels).toFixed(1)} > ${limit}`);
        }
      }
      const loose = new Set(project.panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p) && shelfSpansUprights(p, project.panels)).map((p) => p.id));
      const sup = supportsOf(project);
      for (const div of project.panels.filter((p) => /^Center divider\b/.test(p.name))) {
        const other = project.panels.find((q) => q !== div && solidsOverlap(div, q));
        if (other) bad.push(`${prompt}: ${div.name} overlaps ${other.name}`);
        const info = sup.get(div.id);
        if (info?.on.some((id) => loose.has(id))) bad.push(`${prompt}: ${div.name} stands on a pinned shelf`);
      }
      for (const rod of project.panels.filter((p) => p.type === "rail" && /hanging rod/i.test(p.name))) {
        const rodTop = rod.position.y + rod.size.height;
        const crowd = project.panels.find((p) => {
          if (p === rod || p.type === "shelf") return false;
          const ox = Math.min(p.position.x + p.size.width, rod.position.x + rod.size.width) - Math.max(p.position.x, rod.position.x);
          const oz = Math.min(p.position.z + p.size.depth, rod.position.z + rod.size.depth) - Math.max(p.position.z, rod.position.z);
          return ox > 0.5 && oz > 0.5 && p.position.y < rodTop + 2 - 0.02 && p.position.y + p.size.height > rodTop + 0.02;
        });
        if (crowd) bad.push(`${prompt}: ${crowd.name} is within 2" of the rod`);
      }
    }
    assert.deepEqual(bad, []);
  });
});
