import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { IDEAS } from "./ideas.ts";
import { RECIPES } from "./recipes.ts";
import { recipePrompt } from "./recipeIdeas.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { forwardRefs, type ForwardRef } from "./forwardOrder.ts";
import { countPlural } from "./shopPlural.ts";
import before from "./buildOrder.before.json" with { type: "json" };
import releaseText from "./buildOrder.release.json" with { type: "json" };
import movedPin from "./buildOrder.movers.json" with { type: "json" };
import unresolvedPin from "./buildOrder.unresolved.json" with { type: "json" };
import type { AssemblyStep, YardProject } from "./types.ts";

const STOCKS = ["", " from pvc", " from 3/4 inch dowel", " from 2x2"];
const EXTRA = ["folding table", "folding table 6 foot", "8 foot folding table", "step stool", "storage bench", "shoe bench", "coat bench", "shoe bench 36 wide"];
const BASE = [...new Set([...IDEAS.map((i) => i.prompt), ...RECIPES.recipes.map((r) => recipePrompt(r)), ...EXTRA])];

/** Canary step text, hashed before this change. A mismatch means stop: the rule moved a canary. */
const CANARY: Record<string, string> = {
  "linen closet 31.5 wide 78 tall 16 deep": "f06940e713f5da10fd2b1bf396323e66689da110aa8d8291f0b34a727c3b94ea",
  "pocket vanity": "99c9cb20907007bf14f0390595461cdebe6e5886a1885c37abdedb9f64b66848",
  "Andersen 100 Series 36 by 48 double hung window, frame the rough opening": "14a244b680b96359fe3b2f266a1ad657725550293235e16f7239f3de22049451",
  "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space": "f037103cf07787483cade7fe1b5d29346e141ddc22bb45334fd4683212bdf4da",
  "3 foot Eiffel Tower from popsicle sticks": "98442939a879fc1a244b3599fd4435148b74ecefc30aea0ddae039d38b06b94c",
};

function stepText(steps: AssemblyStep[]): string {
  return steps.map((s) => `${s.title}: ${s.description}`).join("\n");
}

function namesOf(project: YardProject): string[] {
  return [
    ...project.panels.filter((p) => p.type !== "drawer").map((p) => p.name),
    ...new Set(project.instances.map((i) => i.role || "member")),
  ];
}

function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ves")) return `${w.slice(0, -3)}f`;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (/(?:ses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** How many parts share a family word, from the parts list alone. */
function familyCounts(project: YardProject): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (name: string) => {
    const words = name.toLowerCase().replace(/\(.*?\)/g, " ").replace(/\d+/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const last = singular(words[words.length - 1] ?? "");
    if (last) counts.set(last, (counts.get(last) ?? 0) + 1);
  };
  if (project.panels.length) for (const p of project.panels) add(p.name);
  else for (const inst of project.instances) add(inst.role || "member");
  return counts;
}

/** A stated count of a real part family that is higher than the parts list. */
export function inflatedCounts(project: YardProject, steps: AssemblyStep[]): string[] {
  const have = familyCounts(project);
  const faults: string[] = [];
  for (const step of steps) {
    // A cut list counts plies and blanks, not the finished parts.
    if (/^(?:confirm|cut|read|lay out|glue up|level|seal|check|splice)\b/i.test(step.title)) continue;
    const text = `${step.title}. ${step.description}`;
    const each = text.match(/\b(\d+)\s+sticks each\b/i);
    const stop = new Set(["to", "on", "into", "per", "of", "from", "with", "and", "the", "a", "an", "each", "both"]);
    for (const m of text.matchAll(/\b(\d+)\s+([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,3})\b/g)) {
      const qty = Number(m[1]);
      const prior = text.slice(Math.max(0, (m.index ?? 0) - 1), m.index ?? 0);
      if (/[×x/]/.test(prior)) continue;
      const words: string[] = [];
      for (const word of m[2].split(/\s+/)) {
        if (stop.has(word.toLowerCase())) break;
        words.push(word);
      }
      if (!words.length) continue;
      const family = singular(words[words.length - 1]);
      const n = have.get(family);
      if (n == null || qty <= n) continue;
      if (each && qty * Number(each[1]) === n) continue;
      const after = text.slice((m.index ?? 0) + m[0].length);
      if (/^\s*(?:["″]|in\b|ft\b)/.test(after)) continue;
      faults.push(`${step.title} says ${qty} ${words.join(" ")}, the parts list has ${n}`);
    }
  }
  return faults;
}

/** A naive "<noun>s" the plural helper would not have written. */
export function badPlurals(text: string, names: string[]): string[] {
  const stems = new Set<string>(["shelf", "body", "chassis", "half", "leaf", "loaf", "knife", "life", "wife"]);
  for (const name of names) {
    const bare = name.replace(/^[A-Za-z]{1,2}\s+/, "").replace(/\s+\d+$/, "").toLowerCase();
    const last = bare.split(/\s+/).pop();
    if (last && last.length > 2) stems.add(last);
    if (bare.length > 2) stems.add(bare);
  }
  const faults: string[] = [];
  for (const stem of stems) {
    const right = countPlural(stem, 2).toLowerCase();
    const wrong = new Set<string>();
    if (`${stem}s` !== right) wrong.add(`${stem}s`);
    // chassis + es is "chassises". A word that already ends in s does not grow an extra -es.
    if (stem.endsWith("s") && `${stem}es` !== right) wrong.add(`${stem}es`);
    for (const bad of wrong) {
      if (new RegExp(`\\b${bad}\\b`, "i").test(text)) faults.push(bad);
    }
  }
  return faults;
}

function refsOf(steps: AssemblyStep[], names: string[]): ForwardRef[] {
  return forwardRefs(steps, names);
}

describe("canaries stay byte-identical, steps included", () => {
  for (const [prompt, hash] of Object.entries(CANARY)) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      assert.equal(createHash("sha256").update(stepText(plan.instructions)).digest("hex"), hash);
    });
  }
});

describe("the check reads the step text, not the build graph", () => {
  it("a stick build that sets the body before the legs fails", () => {
    const steps: AssemblyStep[] = [
      { step: 1, title: "Set the body", description: "Set the body on the legs.", partsUsed: ["body"] },
      { step: 2, title: "Set the legs", description: "Stand the legs on the bench.", partsUsed: ["leg"] },
    ];
    assert.ok(refsOf(steps, ["body", "leg"]).length > 0);
  });

  it("stringers named by a tread, then set last, fails", () => {
    const steps: AssemblyStep[] = [
      { step: 1, title: "Fasten the Tread 3", description: "Fasten the Tread 3 to the stringers.", partsUsed: ["Tread 3"] },
      { step: 2, title: "Set the stringers", description: "Set the Left stringer.", partsUsed: ["Left stringer"] },
    ];
    assert.ok(refsOf(steps, ["Tread 3", "Left stringer", "Center stringer", "Right stringer"]).some((r) => /stringer/i.test(r.target)));
  });

  it("support arms set after the desktop that fastens to them fails", () => {
    const steps: AssemblyStep[] = [
      { step: 1, title: "Fasten the Desktop", description: "Fasten the Desktop to both support arms.", partsUsed: ["Desktop"] },
      { step: 2, title: "Set the arms", description: "Set the Left support arm.", partsUsed: ["Left support arm"] },
    ];
    assert.ok(refsOf(steps, ["Desktop", "Left support arm", "Right support arm"]).length > 0);
  });

  it("a wall cleat set after the desktop that fastens to it fails", () => {
    const steps: AssemblyStep[] = [
      { step: 1, title: "Fasten the Desktop", description: "Fasten the Desktop to the wall cleat.", partsUsed: ["Desktop"] },
      { step: 2, title: "Set the Wall cleat", description: "Set the Wall cleat.", partsUsed: ["Wall cleat"] },
    ];
    assert.ok(refsOf(steps, ["Desktop", "Wall cleat"]).some((r) => /cleat/i.test(r.target)));
  });

  it("an inflated shelf count fails", () => {
    const project = { panels: Array.from({ length: 10 }, (_, i) => ({ name: `Shelf ${i + 1}`, type: "shelf" })), instances: [] } as unknown as YardProject;
    const steps: AssemblyStep[] = [{ step: 1, title: "Set the shelves", description: "Set the 12 shelves on the uprights.", partsUsed: ["Shelf 1"] }];
    assert.ok(inflatedCounts(project, steps).length > 0);
  });

  it("a bare +s plural the helper would change fails", () => {
    assert.ok(badPlurals("Set the 10 shelfs on the uprights.", ["shelf"]).includes("shelfs"));
    assert.ok(badPlurals("Set the 4 bodys flat.", ["body"]).includes("bodys"));
    assert.ok(badPlurals("on the 150 chassiss.", ["chassis"]).includes("chassiss"));
    assert.ok(badPlurals("on the 150 chassises.", ["chassis"]).includes("chassises"));
    assert.deepEqual(badPlurals("Set the 10 shelves on the 78 bodies and the 150 chassis.", ["shelf", "body", "chassis"]), []);
  });
});

it("ideas and recipes, in default stock, pvc, 3/4 inch dowel and 2x2", () => {
  const moved: string[] = [];
  const unresolved: string[] = [];
  const faults: string[] = [];
  const titles = before as Record<string, string>;
  const hashes = releaseText as Record<string, string>;
  for (const base of BASE) {
    for (const stock of STOCKS) {
      const prompt = `${base}${stock}`;
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const names = namesOf(project);
      const text = stepText(plan.instructions);
      const hash = createHash("sha256").update(text).digest("hex");
      if (hash !== hashes[prompt]) moved.push(prompt);
      const refs = refsOf(plan.instructions, names);
      const order = plan.instructions.map((s) => s.title).join(" | ");
      if (refs.length) {
        if (order !== titles[prompt]) faults.push(`${prompt} kept a forward reference and left release order`);
        unresolved.push(prompt);
      }
      for (const fault of inflatedCounts(project, plan.instructions)) faults.push(`${prompt}: ${fault}`);
      for (const fault of badPlurals(text, names)) faults.push(`${prompt}: ${fault}`);
    }
  }
  assert.deepEqual(faults, []);
  assert.deepEqual(moved.sort(), [...movedPin].sort());
  assert.deepEqual(unresolved.sort(), [...unresolvedPin].sort());
});
