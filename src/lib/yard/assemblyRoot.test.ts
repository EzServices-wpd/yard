/**
 * One root sentence per joined assembly. A part that meets the floor and is fastened to an
 * earlier part is placed against that neighbor, never told it is the base.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelWorldCorners } from "./geometry.ts";
import { familyWord, placementIndex } from "./placeEveryPart.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportsOf } from "./supportGraph.ts";
import type { Panel } from "./types.ts";

const ROOT = /it is the base the next parts fasten to|the base the rest fastens to/i;

/** Open boxes, crates, a planter, a bench, and carcasses whose floor parts all meet. */
const PROMPTS = [
  "pine 1x6 toolbox 18 long",
  "toolbox 18 wide 18 tall 16 deep",
  "garden tote",
  "tool caddy",
  "cedar 1x6 tote 18 long",
  "record crate",
  "lp crate",
  "toy airplane with propeller from pvc",
  "cedar planter box 24 long",
  "garden bench",
  "storage bench 48 wide",
  "blanket chest",
  "toy chest",
  "window box 36 long",
  "bookcase 36 wide 72 tall 12 deep",
  "nightstand 22 wide 24 tall 16 deep",
];

const minY = (p: Panel) => Math.min(...panelWorldCorners(p).map((q) => q.y));

describe("one root per joined assembly", () => {
  for (const prompt of PROMPTS) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const text = plan.instructions.map((s) => `${s.title}. ${s.description}`).join("\n");
      const roots = text.match(new RegExp(ROOT.source, "gi")) ?? [];
      assert.ok(roots.length <= 1, `${roots.length} root sentences:\n${text}`);

      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const name = new Map(project.panels.map((p) => [p.id, p.name]));
      for (const p of project.panels) {
        if (minY(p) > 0.1) continue;
        const info = sup.get(p.id);
        if (!info || info.how === "floor" || info.how === "hinges" || info.how === "slides" || info.how === "front") continue;
        const i = at.get(p.id);
        assert.ok(i != null, `${p.name} is not placed`);
        assert.ok(info.on.length > 0, `${p.name} fastens to nobody`);
        const placed = plan.instructions[i!];
        const step = `${placed.title} ${placed.description}`;
        assert.doesNotMatch(step, ROOT, `${p.name} is still called the base`);
        for (const id of info.on) {
          const j = at.get(id);
          assert.ok(j != null && j <= i!, `${p.name} (step ${i! + 1}) before ${name.get(id)} (step ${(j ?? -2) + 1})`);
        }
        // A step that places this part on its own names the neighbor. A shared carcase step
        // ("Stand the main box") already joins the parts it lists.
        const own = new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(placed.title);
        if (own) {
          const low = step.toLowerCase();
          const named = info.on.some((id) => {
            const n = name.get(id) ?? "";
            return n && (low.includes(n.toLowerCase()) || low.includes(familyWord(n)));
          });
          assert.ok(named, `${p.name} is not named against ${info.on.map((id) => name.get(id)).join(", ")}`);
        }
      }
    });
  }

  // A seat across a corner spans two walls. It goes in after both are standing, never on one wall alone.
  // So do a bay wall between two posts, a floor on its rims, an apron or rail between two legs.
  for (const prompt of [
    "sandbox with seat from 2x2",
    "sandbox with seat from pvc",
    "compost bin",
    "chicken coop",
    "raised dog feeder stand",
    "router table",
    "laptop stand",
    "adirondack footrest",
  ]) {
    it(`${prompt}: a carried part goes in after every floor part it spans`, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const at = placementIndex(project, plan.instructions);
      const box = (p: Panel) => {
        const c = panelWorldCorners(p);
        return [0, 1, 2].map((k) => {
          const v = c.map((q) => [q.x, q.y, q.z][k]);
          return [Math.min(...v), Math.max(...v)];
        });
      };
      const floor = project.panels.filter((p) => minY(p) <= 0.1);
      for (const p of project.panels.filter((x) => minY(x) > 0.1)) {
        const b = box(p);
        for (const f of floor) {
          const a = box(f);
          if (![0, 1, 2].every((k) => Math.min(a[k][1], b[k][1]) - Math.max(a[k][0], b[k][0]) >= -0.1)) continue;
          assert.ok((at.get(f.id) ?? -1) <= (at.get(p.id) ?? -1), `${p.name} goes in before ${f.name}`);
        }
      }
    });
  }

  it("a carry crate names every wall against the bottom, once", () => {
    const plan = buildPlan(generateFromPrompt("pine 1x6 toolbox 18 long"));
    const steps = plan.instructions.map((s) => `${s.title}. ${s.description}`);
    assert.equal(steps.filter((s) => ROOT.test(s)).length, 1);
    for (const part of ["Left end", "Right end", "Back side", "Front side"]) {
      const step = steps.find((s) => new RegExp(`the (?:[A-Z] )?${part}`, "i").test(s));
      assert.ok(step, part);
      assert.match(step!, new RegExp(`Fasten the (?:[A-Z] )?${part} to the (?:[A-Z] )?Bottom`, "i"));
      assert.doesNotMatch(step!, ROOT);
    }
  });
});

/**
 * Mixed stock in one joined assembly: posts and boards, legs and rails.
 * One base sentence for the assembly. Every other part that meets the floor
 * is fastened to a part already placed.
 */
const MIXED = [
  "raised garden bed",
  "cedar raised garden bed 4x8",
  "cedar 2x6 raised garden bed 48x24x11",
  "sandbox with seat from 2x2",
];

describe("one root in a mixed-stock assembly", () => {
  for (const prompt of MIXED) {
    it(`${prompt}: one base line, and every other floor part names a part already placed`, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const steps = plan.instructions.map((s) => `${s.title}. ${s.description}`);
      const text = steps.join("\n");
      const roots = text.match(new RegExp(ROOT.source, "gi")) ?? [];
      assert.equal(roots.length, 1, `${roots.length} root sentences:\n${text}`);

      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const name = new Map(project.panels.map((p) => [p.id, p.name]));
      for (const p of project.panels) {
        if (minY(p) > 0.1) continue;
        const info = sup.get(p.id);
        if (!info || info.how === "floor" || info.how === "hinges" || info.how === "slides" || info.how === "front") continue;
        const i = at.get(p.id);
        assert.ok(i != null, `${p.name} is not placed`);
        assert.ok(info.on.length > 0, `${p.name} fastens to nobody`);
        const placed = plan.instructions[i!];
        const step = `${placed.title} ${placed.description}`;
        assert.doesNotMatch(step, ROOT, `${p.name} is still called the base`);
        for (const id of info.on) {
          const j = at.get(id);
          assert.ok(j != null && j <= i!, `${p.name} (step ${i! + 1}) before ${name.get(id)} (step ${(j ?? -2) + 1})`);
        }
        const own = new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(placed.title);
        if (own) {
          const low = step.toLowerCase();
          const named = info.on.some((id) => {
            const n = name.get(id) ?? "";
            return n && (low.includes(n.toLowerCase()) || low.includes(familyWord(n)));
          });
          assert.ok(named, `${p.name} is not named against ${info.on.map((id) => name.get(id)).join(", ")}`);
        }
      }
    });
  }

  // A case stood on uprights keeps its box steps: the screws each step drives still add up to the Buy count.
  for (const prompt of ["planter box on legs", "mailbox", "boot tray", "bench with legs and aprons"]) {
    it(`${prompt}: the step screw counts add up to the build total`, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const text = plan.instructions.map((s) => s.description ?? "").join("\n");
      const driven = [...text.matchAll(/[Dd]rives? (\d+) ×/g)].reduce((n, m) => n + Number(m[1]), 0);
      const totals = [...text.matchAll(/brings the build to (\d+) screws/g)].map((m) => Number(m[1]));
      assert.ok(totals.length > 0, "no build total");
      assert.equal(driven, totals[totals.length - 1], text);
    });
  }

  // Two leg pairs meet. The long rails span both pairs, so each pair keeps one start
  // and both rails wait until every leg is standing.
  for (const prompt of ["sawbuck", "sawbuck from 2x4"]) {
    it(`${prompt}: one base line per leg pair, and the long rails wait for every leg`, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const text = plan.instructions.map((s) => `${s.title}. ${s.description}`).join("\n");
      const roots = text.match(new RegExp(ROOT.source, "gi")) ?? [];
      assert.equal(roots.length, 2, text);
      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const legs = project.panels.filter((p) => /leg/i.test(p.name));
      assert.equal(legs.length, 4);
      for (const rail of project.panels.filter((p) => /long rail/i.test(p.name))) {
        const on = sup.get(rail.id)?.on ?? [];
        assert.equal(on.length, 4, `${rail.name} dropped a leg`);
        const i = at.get(rail.id)!;
        for (const leg of legs) assert.ok((at.get(leg.id) ?? 99) <= i, `${rail.name} before ${leg.name}`);
      }
    });
  }

  // Bay walls span two posts that do not touch. Each post keeps a start, and the wall waits for both.
  for (const prompt of ["compost bin", "compost bin with lid"]) {
    it(`${prompt}: posts that do not meet keep a start, and each wall waits for both posts`, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const text = plan.instructions.map((s) => `${s.title}. ${s.description}`).join("\n");
      const roots = text.match(new RegExp(ROOT.source, "gi")) ?? [];
      assert.equal(roots.length, 4, text);
      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const walls = project.panels.filter((p) => /bay wall|slat/i.test(p.name));
      assert.ok(walls.length >= 2);
      for (const wall of walls) {
        const on = sup.get(wall.id)?.on ?? [];
        assert.ok(on.length >= 2, wall.name);
        const i = at.get(wall.id)!;
        for (const id of on) assert.ok((at.get(id) ?? 99) <= i, `${wall.name} before a post it spans`);
      }
    });
  }

  for (const prompt of ["potting bench", "potting table", "trestle table", "bench with legs and aprons", "firewood rack"]) {
    it(`${prompt}: a part that spans several members is placed after every one of them`, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const name = new Map(project.panels.map((p) => [p.id, p.name]));
      const spanned = project.panels.filter((p) => (sup.get(p.id)?.on.length ?? 0) >= 2);
      assert.ok(spanned.length >= 2, spanned.map((p) => p.name).join(", "));
      for (const part of spanned) {
        const i = at.get(part.id)!;
        for (const id of sup.get(part.id)!.on) {
          assert.ok((at.get(id) ?? 99) <= i, `${part.name} before ${name.get(id)}`);
        }
      }
    });
  }
});
