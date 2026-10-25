import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { spanFindings } from "./spanCheck";
import { adjustableShelfTalk, isFixedSpanShelf, sagLimitIn, shelfDepthSpan, shelfLevelsFit, shelfLineCount, shelfSagIn, shelfSpanLimit, shelfSpanViolations, typedShelfDemand } from "./shelfSpan";
import { closetShelfMinHeight, rodShelfMinHeight } from "./shelfClear";
import { withAxis } from "./tooSmall";
import { namedMinimum } from "../../../scripts/eval-gate-refusal.ts";
import { hiddenOverlaps, solidsOverlap } from "./solids";
import { headerTitle } from "./pdf";
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

  it("divides a 36 inch bookcase into bays within the stock limit, and keeps five shelves on pins", () => {
    const project = generateFromPrompt("bookcase");
    const plan = buildPlan(project);
    assert.equal(project.panels.filter((p) => /^Shelf nosing\b|^Front rail\b|^Front stiffener\b/.test(p.name)).length, 0);
    assert.equal(cols("bookcase"), 1);
    assert.equal(project.panels.filter((p) => p.name === "Shelf bearer").length, 0);
    assert.equal(shelfSpanViolations(project).length, 0);
    assert.deepEqual(spanFindings(project), []);
    assert.equal(project.panels.filter((p) => p.name.startsWith("Center support")).length, 0);
    const shelves = project.panels.filter((p) => p.type === "shelf");
    assert.equal(shelfLineCount(shelves), 5);
    assert.equal(shelves.length, 10);
    assert.equal(shelves.some((s) => s.polygon), false);
    for (const shelf of shelves) assert.ok(shelf.size.width <= shelfSpanLimit(shelf.materialId, shelf.size.height) + 1 / 32, shelf.name);
    assert.match(plan.instructions.find((s) => /Pin /.test(s.title))?.title ?? "", /Pin 5 shelves \(10 adjustable pieces\)/);
    assert.match(plan.bom.find((b) => b.catalogId === "shelf-pins")?.notes ?? "", /5 shelves \(10 adjustable pieces\)/);
    assert.doesNotMatch(plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n"), /nosing/i);
    assert.equal(project.panels.some((q) => project.panels.some((d) => d !== q && /^Center divider\b/.test(d.name) && solidsOverlap(d, q))), false);
    assert.equal(stepScrewCount(plan), Number(plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""))?.notes?.match(/(\d+) screws/)?.[1] ?? NaN));
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
    assert.equal(shelfLineCount(half.panels.filter((p) => p.type === "shelf")), shelfLineCount(thick.panels.filter((p) => p.type === "shelf")));
    assert.ok(half.panels.filter((p) => p.type === "shelf").length > thick.panels.filter((p) => p.type === "shelf").length);
    assert.equal(half.panels.some((p) => p.type === "shelf" && p.polygon), false);
    assert.equal(shelfSpanViolations(half).length, 0);
    assert.equal(checkBuild(half, prompt, buildPlan(half)).some((v) => v.id === "I14"), false);
  });

  it("divides a 36 inch bookcase in 3/4 and in 1/2, and keeps five shelf levels", () => {
    assert.equal(cols("bookshelf 36 wide", "plywood-3-4-4x8"), 1);
    assert.ok(cols("bookshelf 36 wide", "plywood-1-2-4x8") >= 1);
    const full = generateFromPrompt("bookshelf 36 wide", "plywood-3-4-4x8");
    const half = generateFromPrompt("bookshelf 36 wide", "plywood-1-2-4x8");
    assert.equal(shelfLineCount(full.panels.filter((p) => p.type === "shelf")), 5);
    assert.equal(half.panels.filter((p) => p.name.startsWith("Center support")).length, 0);
    assert.equal(shelfLineCount(half.panels.filter((p) => p.type === "shelf")), 5);
    assert.equal(shelfSpanViolations(full).length, 0);
    assert.equal(shelfSpanViolations(half).length, 0);
    const bay = (p: ReturnType<typeof generateFromPrompt>, stock: string) => {
      const shelf = p.panels.find((s) => s.type === "shelf")!;
      return { span: Math.max(...p.panels.filter((s) => s.type === "shelf").map((s) => s.size.width)), limit: shelfSpanLimit(stock, shelf.size.height) };
    };
    const thickBay = bay(full, "plywood-3-4-4x8");
    const halfBay = bay(half, "plywood-1-2-4x8");
    assert.ok(thickBay.span <= thickBay.limit + 1 / 32);
    assert.ok(halfBay.span <= halfBay.limit + 1 / 32);
    assert.ok(halfBay.limit < thickBay.limit);
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

  it("row 342: a divider standing on the hat shelf never cuts it; each hat stays one piece with its front rail", () => {
    for (const [q, n, w] of [["wardrobe", 1, 34.5], ["wardrobe 96 wide", 3, 31]] as const) {
      const project = generateFromPrompt(q);
      const hats = project.panels.filter((p) => p.type === "shelf" && /^Screwed fixed shelf/.test(p.cutNote ?? ""));
      assert.deepEqual(hats.map((h) => h.size.width), Array(n).fill(w), q);
      assert.equal(project.panels.filter((p) => /^Front rail\b/.test(p.name)).length, n, q);
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
    assert.equal(project.panels.some((p) => p.type === "shelf" && p.polygon), false);
    assert.deepEqual(spanFindings(project), []);
    const screwLine = Number(plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""))?.notes?.match(/(\d+) screws/)?.[1] ?? NaN);
    assert.equal(stepScrewCount(plan), screwLine);
  });

  it("gives each wide hanging bay its own rod and one fixed shelf clear of the rod", () => {
    for (const prompt of ["wardrobe 48 wide", "wardrobe 72 wide"]) {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      assert.equal(shelfSpanViolations(project).length, 0, prompt);
      assert.deepEqual(spanFindings(project), [], prompt);
      assert.equal(checkBuild(project, prompt, plan).some((v) => v.id === "I1" || v.id === "I7"), false, prompt);
      const rods = project.panels.filter((p) => /hanging rod/i.test(p.name));
      const divs = project.panels.filter((p) => /^Center divider\b/.test(p.name));
      assert.ok(divs.length >= 1 && rods.length === divs.length + 1, prompt);
      assert.ok(rods.some((r) => r.name === "Hanging rod"), prompt);
      for (const rod of rods) {
        assert.equal(divs.some((d) => solidsOverlap(d, rod)), false, `${prompt} ${rod.name}`);
        const hat = project.panels.find((p) => isFixedSpanShelf(p) && Math.min(p.position.x + p.size.width, rod.position.x + rod.size.width) - Math.max(p.position.x, rod.position.x) > 1);
        assert.ok(hat, `${prompt} ${rod.name} hat`);
        assert.ok(hat.position.y >= rod.position.y + rod.size.height + 2 - 0.02, `${prompt} gap`);
        assert.equal(project.panels.some((p) => /^Back cleat\b/.test(p.name) && Math.abs(p.position.x - hat.position.x) < 0.2 && Math.abs(p.size.width - hat.size.width) < 0.2), true, prompt);
        assert.equal(project.panels.some((p) => /^Front stiffener\b|^Shelf nosing\b/.test(p.name)), false, prompt);
        const span = Math.max(...project.panels.filter((p) => p.type === "shelf" && Math.abs(p.position.y - hat.position.y) < 0.05).map((p) => p.size.width));
        const limit = shelfSpanLimit(hat.materialId, hat.size.height);
        if (span > limit + 1 / 32) {
          const rail = project.panels.find((p) => /^Front rail\b/.test(p.name) && Math.abs(p.position.x - hat.position.x) < 0.2);
          assert.ok(rail, `${prompt} fixed shelf past ${limit}" has no front rail`);
          assert.ok(shelfSagIn(span, hat.size.depth, hat.size.height, hat.materialId, rail.size.height) <= sagLimitIn(span) + 1 / 32, prompt);
        }
      }
      const top = Math.min(...project.panels.filter((p) => p.type === "top").map((p) => p.position.y));
      for (const div of divs) assert.ok(Math.abs(div.position.y + div.size.height - top) < 0.05, `${prompt} ${div.name} stops short`);
      const lines = new Set(project.panels.filter((p) => p.type === "shelf").map((p) => Math.round(p.position.y * 4) / 4));
      assert.equal(lines.size, project.fitted?.unit.shelfCount);
    }
  });

  it("splits a wide carcass into bays and does not hang a bearer beside the divider", () => {
    for (const prompt of ["closet 72 wide 96 tall 24 deep", "half a sheet of plywood shelf", "office bookcase with doors 42 wide"]) {
      const project = generateFromPrompt(prompt);
      assert.deepEqual(spanFindings(project), [], prompt);
      assert.equal(project.panels.some((p) => p.name === "Shelf bearer"), false, prompt);
      assert.equal(project.panels.some((p) => p.type === "shelf" && p.polygon), false, prompt);
      const shelves = project.panels.filter((p) => p.type === "shelf");
      assert.ok(shelves.length > shelfLineCount(shelves), prompt);
      const divs = project.panels.filter((p) => /^Center divider\b/.test(p.name));
      const top = Math.min(...project.panels.filter((p) => p.type === "top").map((p) => p.position.y));
      assert.ok(divs.length >= 1, prompt);
      for (const div of divs) {
        assert.ok(div.position.y < 2, `${prompt} ${div.name} does not start at the bottom`);
        assert.ok(Math.abs(div.position.y + div.size.height - top) < 0.05, `${prompt} ${div.name} stops short of the top`);
        assert.equal(project.panels.some((q) => q !== div && solidsOverlap(div, q)), false, prompt);
      }
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
    const prompt = "bookcase 48 wide 12 deep 72 tall with three shelves";
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

  it("counts a screw in Buy when the divider step says screw and the divider ends under a shelf", () => {
    // file cabinet at 877f11d: the divider step says "Screw through the bottom" and the divider
    // stops under Shelf 2, a pair Buy leaves out (0 screws).
    const prompt = "file cabinet";
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const step = plan.instructions.find((s) => /center divider/i.test(s.title));
    const buy = BUY_JOINTS.get(project) ?? [];
    const paired = (a: string, b: string) =>
      buy.some((j) => j.screws > 0 && ((j.a === a && j.b === b) || (j.a === b && j.b === a)));
    if (step && /screw/i.test(step.description) && !/takes no screws/i.test(step.description)) {
      for (const div of project.panels.filter((p) => /^Center divider\b/.test(p.name))) {
        const top = div.position.y + div.size.height;
        for (const shelf of project.panels.filter((p) => p.type === "shelf")) {
          const ox = Math.min(div.position.x + div.size.width, shelf.position.x + shelf.size.width) - Math.max(div.position.x, shelf.position.x);
          const oz = Math.min(div.position.z + div.size.depth, shelf.position.z + shelf.size.depth) - Math.max(div.position.z, shelf.position.z);
          if (ox <= 0.2 || oz <= 0.2 || Math.abs(shelf.position.y - top) > 0.35) continue;
          assert.ok(paired(div.id, shelf.id), `${prompt}: ${div.name} ends under ${shelf.name} and Buy has 0 screws`);
        }
      }
    }
    assert.equal(project.panels.filter((p) => /^Shelf nosing\b/.test(p.name)).length, 0);
    for (const rail of project.panels.filter((p) => /^Front rail\b/.test(p.name))) {
      const shelf = project.panels.find((s) => s.type === "shelf" && Math.abs(s.position.y - (rail.position.y + rail.size.height)) < 0.12);
      assert.ok(shelf, `${rail.name} is not under a shelf`);
      assert.ok(paired(rail.id, shelf.id), `${rail.name} is screwed in the step and missing from Buy`);
    }
  });

  it("a 34 1/2 inch pine 1×10 shelf sags past 0.02 inch per foot until the divider shortens the bay", () => {
    const span = 34.5;
    const bare = shelfSagIn(span, 9.25, 0.75, "lumber-1x10-8");
    const asCut = shelfSagIn(span, 8, 0.75, "lumber-1x10-8");
    assert.ok(bare > sagLimitIn(span), `1×10 section sags ${bare.toFixed(4)} against ${sagLimitIn(span).toFixed(4)}`);
    assert.ok(asCut > bare);
    const project = generateFromPrompt("bookshelf from 1x10");
    assert.equal(project.panels.filter((p) => /^Shelf nosing\b|^Front rail\b/.test(p.name)).length, 0);
    assert.equal(project.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 1);
    const shelves = project.panels.filter((p) => p.type === "shelf");
    assert.equal(shelfLineCount(shelves), 5);
    assert.equal(shelves.length, 10);
    for (const shelf of shelves) {
      assert.ok(shelfSagIn(shelf.size.width, shelf.size.depth, shelf.size.height, shelf.materialId) <= sagLimitIn(shelf.size.width) + 0.005, shelf.name);
      assert.ok(shelf.size.width <= shelfSpanLimit(shelf.materialId, shelf.size.height) + 1 / 32);
    }
    assert.equal(shelfSpanViolations(project).length, 0);
  });

  it("leaves a solid-top island without a span divider", () => {
    const prompt = "butcher block island on wheels 42 by 30";
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    assert.equal(project.panels.filter((p) => /^Center divider\b/.test(p.name)).length, 0);
    assert.equal(plan.instructions.some((s) => /center divider/i.test(s.title)), false);
    assert.equal(plan.totals.estCostUsd, 326.09);
  });

  it("keeps a wide wardrobe free of floating parts and over-span shelves", () => {
    const bad: string[] = [];
    for (const prompt of ["wardrobe 72 wide", "wardrobe 40x72"]) {
      const project = generateFromPrompt(prompt);
      const ids = checkBuild(project, prompt, buildPlan(project)).map((v) => v.id);
      if (ids.includes("I1")) bad.push(`${prompt} I1`);
      if (ids.includes("I7")) bad.push(`${prompt} I7`);
    }
    assert.deepEqual(bad, []);
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

  it("seats the wine front rail inside one height and writes its step", () => {
    const project = generateFromPrompt("pine wine rack 30 wide with 20 slots");
    const plan = buildPlan(project);
    const rail = project.panels.find((p) => /^Front rail\b/.test(p.name));
    assert.ok(rail);
    const sides = project.panels.filter((p) => p.type === "upright");
    const y0 = Math.min(...sides.map((p) => p.position.y));
    const y1 = Math.max(...sides.map((p) => p.position.y + p.size.height));
    assert.ok(rail.position.y >= y0 - 1 / 32 && rail.position.y + rail.size.height <= y1 + 1 / 32);
    const said = headerTitle(project).match(/× ([\d /]+)" H/)?.[1];
    assert.ok(said);
    const notes = (project.notes ?? []).join("\n");
    const step = plan.instructions[0]?.description ?? "";
    assert.match(notes, new RegExp(said.replace(/ /g, "\\s")));
    assert.match(step, new RegExp(said.replace(/ /g, "\\s")));
    assert.doesNotMatch(`${notes}\n${step}`, /18 3\/4/);
    const railStep = plan.instructions.find((s) => /Front rail/.test(s.title));
    assert.match(`${railStep?.title} ${railStep?.description}`, /on edge under the front/);
    assert.doesNotMatch(`${railStep?.title} ${railStep?.description}`, /mounts to the wall|Lay the Front rail flat/);
    assert.equal(plan.cutList.every((l) => /^Pine 1×4$/.test(l.material ?? "")), true);
  });

  it("counts pinned shelf pieces and lets I26 catch a 0.05 inch overlap", () => {
    // #112: an untyped wardrobe's 66" rod leaves room for the hat alone at 7" clear, so the typed 4 carries the pin talk.
    const wardrobe = generateFromPrompt("wardrobe with 4 shelves");
    const pinned = wardrobe.panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p));
    assert.equal(pinned.length, 6);
    const hat = "4 shelves: 1 fixed hat shelf over the rod and 3 adjustable (6 pieces)";
    assert.equal(adjustableShelfTalk(wardrobe.panels).phrase, hat);
    assert.match((wardrobe.notes ?? []).join("\n"), /4 shelves: 1 fixed hat shelf over the rod and 3 adjustable \(6 pieces\)/);
    assert.doesNotMatch((wardrobe.notes ?? []).join("\n"), /4 adjustable shelf lines/);
    const wardrobePlan = buildPlan(wardrobe);
    assert.match(wardrobePlan.instructions.find((s) => /Pin /.test(s.title))?.title ?? "", /Pin 4 shelves: 1 fixed hat shelf over the rod and 3 adjustable \(6 pieces\)/);
    assert.match(wardrobePlan.instructions.find((s) => /center divider/i.test(s.title))?.description ?? "", /hat shelf over the rod/);
    assert.match(wardrobePlan.bom.find((b) => /shelf pins/i.test(b.name))?.notes ?? "", /4 shelves: 1 fixed hat shelf over the rod and 3 adjustable \(6 pieces\)/);
    // #112's 'wardrobe with 2 drawers' builds no shelf over its rod; the typed 4 has a divider standing on Shelf 1.
    const div = wardrobe.panels.find((p) => p.name === "Center divider")!;
    const shelf = wardrobe.panels.find((p) => p.name === "Shelf 1")!;
    const yOverlap = Math.min(div.position.y + div.size.height, shelf.position.y + shelf.size.height) - Math.max(div.position.y, shelf.position.y);
    assert.ok(yOverlap <= 1 / 32);
    const bite = { ...div, position: { ...div.position, y: shelf.position.y + shelf.size.height - 0.05 } };
    assert.ok(hiddenOverlaps({ panels: [shelf, bite] }).some((m) => /Center divider/.test(m) && /Shelf 1/.test(m)));
    const vanity = generateFromPrompt("pocket vanity");
    const vanityPlan = buildPlan(vanity);
    assert.equal(vanityPlan.totals.pieces, 50);
    assert.equal(vanityPlan.totals.estCostUsd, 636.23);
    assert.equal(vanity.panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p)).length, 6);
    assert.match(vanityPlan.instructions.find((s) => /Pin /.test(s.title))?.title ?? "", /Pin 6 adjustable shelves/);
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
      if (project.panels.some((p) => p.type === "shelf" && !isFixedSpanShelf(p) && p.polygon)) bad.push(`${prompt}: notched loose shelf`);
      const loose = new Set(project.panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p) && shelfSpansUprights(p, project.panels)).map((p) => p.id));
      const sup = supportsOf(project);
      for (const div of project.panels.filter((p) => /^Center divider\b/.test(p.name))) {
        const other = project.panels.find((q) => q !== div && solidsOverlap(div, q));
        if (other) bad.push(`${prompt}: ${div.name} overlaps ${other.name}`);
        const info = sup.get(div.id);
        if (info?.on.some((id) => loose.has(id))) bad.push(`${prompt}: ${div.name} stands on a pinned shelf`);
        const meetX = (q: { position: { x: number }; size: { width: number } }) => Math.min(div.position.x + div.size.width, q.position.x + q.size.width) - Math.max(div.position.x, q.position.x) > 0.2;
        const cap = project.panels.filter((q) => q.type === "top" && meetX(q)).map((q) => q.position.y);
        const caseTop = cap.length ? Math.min(...cap) : null;
        const underLoose = project.panels.find((q) => loose.has(q.id) && Math.abs(q.position.y - (div.position.y + div.size.height)) <= 0.35 && meetX(q));
        if (underLoose && (caseTop == null || div.position.y + div.size.height < caseTop - 1)) bad.push(`${prompt}: ${div.name} ends under ${underLoose.name}`);
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

  it("gives every typed shelf its own height, or names the height that fits", () => {
    const cases: [string, number, "fits" | "refuses"][] = [
      ["bookcase 36 tall with 8 shelves", 8, "refuses"],
      ["bookcase 24 tall with 8 shelves", 8, "refuses"],
      ["bookcase 30 wide 24 tall with 8 shelves", 8, "refuses"],
      ["bookshelf 42 wide with 5 shelves", 5, "fits"],
      ["wardrobe 36 wide 36 tall with 10 shelves", 10, "refuses"],
      ["wardrobe 36 wide 84 tall with 4 shelves", 4, "fits"],
      ["closet 36 tall with 8 shelves", 8, "refuses"],
      ["closet 24 tall with 10 shelves", 10, "refuses"],
      ["pantry cabinet 84 tall with 6 shelves", 6, "fits"],
      ["pantry cabinet 24 tall with 8 shelves", 8, "refuses"],
      ["linen closet 78 tall with 4 shelves", 4, "fits"],
      ["linen closet 24 tall with 10 shelves", 10, "refuses"],
    ];
    const atHeight = (prompt: string, width: number, height: number) => {
      const pinned = /\b(?:wide|width)\b/i.test(prompt) ? prompt : `${prompt} ${width} wide`;
      const next = withAxis(pinned, "height", height);
      return generateFromPrompt(next !== pinned ? next : `${pinned} ${height} tall`);
    };
    for (const [prompt, n, expect] of cases) {
      assert.equal(typedShelfDemand(prompt), n, prompt);
      const project = generateFromPrompt(prompt);
      if (expect === "fits") {
        assert.equal(project.refused, undefined, prompt);
        assert.equal(shelfLevelsFit(project.panels, n), true, prompt);
        assert.match(headerTitle(project), new RegExp(`\\b${n} shelves\\b`), prompt);
        continue;
      }
      assert.equal(typeof project.refused, "string", prompt);
      assert.equal(project.panels.length, 0, prompt);
      assert.match(String(project.refused), /nothing is built/i);
      assert.match(String(project.refused), /7" clear/);
      assert.match(headerTitle(project), /nothing built/);
      const min = namedMinimum(String(project.refused));
      const expectMin = /\brods?\b/i.test(prompt) ? rodShelfMinHeight(n) : closetShelfMinHeight(n);
      assert.equal(min?.value_in, expectMin, `${prompt} ${project.refused}`);
      assert.ok(min && min.axis === "H" && min.value_in > project.overall.height + 1 / 32, `${prompt} ${project.refused}`);
      const built = atHeight(prompt, project.overall.width, min.value_in);
      assert.equal(built.refused, undefined, `${prompt} at ${min.quote}`);
      assert.ok(Math.abs(built.overall.width - project.overall.width) < 0.02, prompt);
      assert.equal(shelfLevelsFit(built.panels, n), true, `${prompt} at ${min.quote}`);
      assert.match(headerTitle(built), new RegExp(`\\b${n} shelves\\b`), headerTitle(built));
      const under = atHeight(prompt, project.overall.width, min.value_in - 1);
      assert.equal(typeof under.refused, "string", `${prompt} an inch under ${min.quote}`);
    }
    assert.equal(typedShelfDemand("wardrobe with 2 drawers"), null);
    assert.equal(typedShelfDemand("small 6 foot shelf"), null);
    assert.equal(typedShelfDemand("pocket vanity"), null);
    assert.equal(generateFromPrompt("wardrobe with 2 drawers").refused, undefined);
    const four = generateFromPrompt("wardrobe with 4 shelves");
    assert.equal(four.refused, undefined);
    assert.equal(shelfLevelsFit(four.panels, 4), true);
    assert.match((four.notes ?? []).join("\n"), /4 shelves: 1 fixed hat shelf over the rod and 3 adjustable \(6 pieces\)/);
    assert.match((four.notes ?? []).join("\n"), /so shirts hang/);
    assert.doesNotMatch((four.notes ?? []).join("\n"), /left out/);
    const six = generateFromPrompt("wardrobe with 6 shelves");
    assert.equal(six.refused, undefined);
    assert.equal(shelfLevelsFit(six.panels, 6), true);
    assert.equal(six.panels.some((p) => /hanging rod/i.test(p.name)), false);
    assert.match((six.notes ?? []).join("\n"), /The hanging rod is left out so the shelves keep 7" clear between them/);
    const sixTall = generateFromPrompt("wardrobe 36 wide 100 tall with 6 shelves");
    assert.equal(sixTall.refused, undefined);
    assert.match(adjustableShelfTalk(sixTall.panels).phrase, /6 shelves: 1 fixed hat shelf over the rod and 5 adjustable \(10 pieces\)/);
    assert.match((sixTall.notes ?? []).join("\n"), /fixed hat shelf over the rod/);
    const wide = generateFromPrompt("wardrobe 66 wide with 4 shelves");
    const widePhrase = adjustableShelfTalk(wide.panels).phrase;
    assert.match(widePhrase, /fixed hat shelf over the rod/);
    const widePlan = buildPlan(wide);
    assert.match((wide.notes ?? []).join("\n"), new RegExp(widePhrase.replace(/[()]/g, "\\$&")));
    assert.match(widePlan.instructions.find((s) => /Pin /.test(s.title))?.title ?? "", new RegExp(widePhrase.replace(/[()]/g, "\\$&")));
    assert.match(widePlan.bom.find((b) => /shelf pins/i.test(b.name))?.notes ?? "", new RegExp(widePhrase.replace(/[()]/g, "\\$&")));
    const ten = generateFromPrompt("wardrobe 36 wide 36 tall with 10 shelves");
    assert.match(String(ten.refused), /86 3\/4" tall for 10 shelves with 7" clear/);
    assert.equal(namedMinimum(String(ten.refused))?.value_in, 86.75);
    const tenBuilt = generateFromPrompt("wardrobe 36 wide 86.75 tall with 10 shelves");
    assert.equal(tenBuilt.refused, undefined);
    assert.equal(shelfLevelsFit(tenBuilt.panels, 10), true);
    assert.match((tenBuilt.notes ?? []).join("\n"), /hanging rod is left out/);
    assert.match(headerTitle(tenBuilt), /\b10 shelves\b/);
    const tenRod = generateFromPrompt("wardrobe 36 wide 36 tall with a rod and 10 shelves");
    assert.match(String(tenRod.refused), /128 3\/4" tall for 10 shelves with 7" clear between them and a hanging rod/);
    assert.equal(namedMinimum(String(tenRod.refused))?.value_in, rodShelfMinHeight(10));
    const tenRodBuilt = generateFromPrompt("wardrobe 36 wide 128.75 tall with a rod and 10 shelves");
    assert.equal(tenRodBuilt.refused, undefined);
    assert.equal(tenRodBuilt.panels.some((p) => /hanging rod/i.test(p.name)), true);
    assert.equal(shelfLevelsFit(tenRodBuilt.panels, 10), true);
    assert.match(adjustableShelfTalk(tenRodBuilt.panels).phrase, /10 shelves: 1 fixed hat shelf over the rod and 9 adjustable/);
  });
});
