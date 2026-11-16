/**
 * A step's placement sentences name only parts that step, or an earlier step, places.
 * The rests-on line is built from parts already placed. A support set later is left out of the sentence.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { closableAt } from "./fastenedAt.ts";
import { partLetters } from "./pdfDraw.ts";
import { cutListName } from "./shopPlural.ts";
import { corpus } from "../../../scripts/invariants-corpus.ts";
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types.ts";

const EXAMPLES = [
  "shoe rack 36x18x12",
  "shoe rack 36x24x12",
  "shoe rack with cubbies 36 x 18 x 12",
  "mudroom bench 48x18",
  "mudroom bench 48x20",
  "window seat 48x20",
  "wardrobe 40x72",
  "dresser 54.375 wide 36 tall 18.75 deep",
  "dresser 54.5 wide",
  "pocket vanity",
  "pine 1x10 bookcase",
  "desk 60x29x30",
];

/** Other cubby, bench, and divided carcasses. None of these are in the reported list. */
const NOVEL = [
  "entry bench 48 wide",
  "storage bench 48 wide with cubbies",
  "shoe bench 42 wide",
  "window seat 36 wide",
  "mudroom bench 36 wide",
  "hall bench 60 wide",
  "closet organizer 60 wide 84 tall 16 deep",
  "bookcase 48 wide 84 tall 12 deep",
  "pantry cabinet 30 wide 84 tall 16 deep",
  "cube storage 30 wide 30 tall 12 deep",
];

function placementSentences(step: AssemblyStep): string[] {
  const desc = step.description ?? "";
  const at = desc.indexOf("Where:");
  if (at < 0) return [];
  return desc
    .slice(at)
    .replace(/^Where:\s*/, "")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/^(?:Drive |In all, |These screws |That brings |Screw through |One join|The desktop screws|Tape or glue|Set the joints)/.test(s));
}

function namedPanels(sentence: string, panels: Panel[], letters: Map<string, string>): Panel[] {
  const byL = new Map<string, Panel[]>();
  for (const p of panels) {
    const L = letters.get(p.id);
    if (!L) continue;
    byL.set(L, [...(byL.get(L) ?? []), p]);
  }
  const hit = new Map<string, Panel>();
  const add = (list: Panel[]) => list.forEach((p) => hit.set(p.id, p));
  for (const [L, list] of byL) {
    const fam = cutListName(list[0].name, list[0].type).toLowerCase();
    const stem = fam.replace(/y$/, "ie");
    // A lone letter is a support name ("of D", "A and both F"), not the "A" inside "Wall cleat A" or "A-frame".
    if (list.length === 1 && new RegExp(`(?:^|\\bof\\s+|\\band\\s+|,\\s*)${L}\\b(?!\\s+[A-Za-z]|-)`, "i").test(sentence)) add(list);
    // "both L legs" names two of that letter. With more than two, the pair is the ones already in the sentence's own supports.
    if (new RegExp(`\\bboth ${L} ${stem}s?\\b`, "i").test(sentence) && list.length <= 2) add(list);
    if (new RegExp(`\\b(?:each|all \\d+) ${L} ${stem}s?\\b`, "i").test(sentence)) add(list);
    if (new RegExp(`\\b${L} ${stem}s?\\b`, "i").test(sentence)) {
      const specific = list.filter((p) => new RegExp(`\\b${L} ${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence));
      // "both C legs" with four legs names the two this step joins, not every later leg of that letter.
      if (specific.length) add(specific);
      else if (!(list.length > 2 && new RegExp(`\\bboth ${L} ${stem}`, "i").test(sentence))) add(list);
    }
  }
  for (const p of panels) {
    if (letters.get(p.id) || p.name.trim().length < 5) continue;
    if (new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence)) hit.set(p.id, p);
  }
  return [...hit.values()];
}

/** "Top of A Board sits" is locating that part. A glue-up step is not in the attach index. */
function locates(sentence: string, p: Panel, letters: Map<string, string>): boolean {
  const L = letters.get(p.id);
  const fam = cutListName(p.name, p.type).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const name = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const who = L ? `(?:${L} ${fam}|${L} ${name})` : name;
  return new RegExp(`\\bTop(?: edge)?s? of (?:the |both |all \\d+ |each )?${who}\\b`, "i").test(sentence);
}

function lateNames(project: YardProject, plan: BuildPlan): string[] {
  const at = closableAt(project, plan.instructions, plan.cutList);
  const letters = partLetters(project, plan.cutList);
  const out: string[] = [];
  plan.instructions.forEach((step, i) => {
    for (const sentence of placementSentences(step)) {
      for (const p of namedPanels(sentence, project.panels, letters)) {
        const n = at.get(p.id);
        if (n == null && locates(sentence, p, letters)) continue;
        if (n == null || n > i) out.push(`${step.title} names ${p.name} (${n == null ? "unplaced" : `step ${n + 1}`})`);
      }
    }
  });
  return out;
}

function built(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return { project, plan };
}

function whereOf(plan: BuildPlan, title: RegExp): string {
  const step = plan.instructions.find((s) => title.test(s.title));
  assert.ok(step, title.source);
  const at = (step.description ?? "").indexOf("Where:");
  assert.ok(at >= 0, step.title);
  return (step.description ?? "").slice(at);
}

describe("placement sentences name only parts already placed", () => {
  for (const prompt of EXAMPLES) {
    it(`${prompt}: no placement sentence names a later part`, () => {
      const { project, plan } = built(prompt);
      assert.deepEqual(lateNames(project, plan), []);
    });
  }

  it("shoe racks drop the cubby dividers from the top step and keep the uprights", () => {
    for (const prompt of ["shoe rack 36x18x12", "shoe rack 36x24x12", "shoe rack with cubbies 36 x 18 x 12"]) {
      const { plan } = built(prompt);
      const where = whereOf(plan, /Attach [A-Z] Top/);
      assert.doesNotMatch(where, /cubby divider/i, prompt);
      assert.match(where, /flush with the top ends of both [A-Z] uprights/, prompt);
      const dividers = plan.instructions.find((s) => /cubby dividers/i.test(s.title));
      assert.ok(dividers);
      assert.ok(plan.instructions.findIndex((s) => s === dividers) > plan.instructions.findIndex((s) => /Attach [A-Z] Top/.test(s.title)));
    }
  });

  it("benches and the window seat do not rest the seat on the apron or the dividers", () => {
    for (const prompt of ["mudroom bench 48x18", "mudroom bench 48x20", "window seat 48x20"]) {
      const { plan } = built(prompt);
      const where = whereOf(plan, /Attach [A-Z] Seat/);
      assert.doesNotMatch(where, /cubby divider|apron/i, prompt);
      assert.match(where, /flush with the top ends of both [A-Z] uprights/, prompt);
    }
  });

  it("a top set before its divider does not name that divider", () => {
    for (const [prompt, title] of [
      ["wardrobe 40x72", /Attach [A-Z] Top/],
      ["dresser 54.375 wide 36 tall 18.75 deep", /Attach [A-Z] Top/],
      ["dresser 54.5 wide", /Attach [A-Z] Top/],
      ["pocket vanity", /Attach [A-Z] Top/],
      ["pine 1x10 bookcase", /Attach [A-Z] Top/],
    ] as const) {
      const { plan } = built(prompt);
      const where = whereOf(plan, title);
      assert.doesNotMatch(where, /rests on the top of/, prompt);
      assert.match(where, /flush with the top ends of both [A-Z] uprights/, prompt);
    }
  });

  it("the desk still rests on the uprights and the dividers, which are already set", () => {
    for (const prompt of ["desk 60x29x30", "desk 60x30x29"]) {
      const { plan } = built(prompt);
      const where = whereOf(plan, /Set the desktop/);
      assert.match(where, /Its underside rests on the top of both [A-Z] uprights and both [A-Z] dividers/, prompt);
      const stand = whereOf(plan, /Stand the main box/);
      assert.doesNotMatch(stand, /dividers/, prompt);
      assert.match(stand, /flush with the bottom ends of both [A-Z] uprights/, prompt);
    }
  });

  it("at least six other carcasses keep an already-placed upright and omit a later divider or apron", () => {
    const shown: string[] = [];
    for (const prompt of NOVEL) {
      const { project, plan } = built(prompt);
      assert.deepEqual(lateNames(project, plan), [], prompt);
      const at = closableAt(project, plan.instructions, plan.cutList);
      const later = project.panels.filter((p) => /divider|apron/i.test(p.name) && at.has(p.id));
      const seat = plan.instructions.findIndex((s) => /Attach [A-Z] (?:Top|Seat)|Set the desktop|Set the Top/.test(s.title));
      if (seat < 0 || !later.some((p) => (at.get(p.id) ?? -1) > seat)) continue;
      const where = plan.instructions[seat].description ?? "";
      assert.match(where, /uprights/, prompt);
      for (const p of later) if ((at.get(p.id) ?? -1) > seat) assert.doesNotMatch(where, new RegExp(p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), prompt);
      shown.push(prompt);
    }
    assert.ok(shown.length >= 6, `only ${shown.length}: ${shown.join(", ")}`);
  });

  it("the invariant holds across the compiled corpus", { timeout: 300_000 }, () => {
    const prompts = [...new Set([...corpus(), ...EXAMPLES, ...NOVEL])];
    const bad: string[] = [];
    let checked = 0;
    for (const prompt of prompts) {
      try {
        const { project, plan } = built(prompt);
        if (!project.panels.length || plan.instructions.length < 2) continue;
        checked++;
        for (const fault of lateNames(project, plan)) bad.push(`${prompt} — ${fault}`);
      } catch {
        continue;
      }
    }
    assert.ok(checked >= 80, `only ${checked} prompts compiled`);
    assert.deepEqual(bad, []);
  });
});
