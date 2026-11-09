import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { IDEAS } from "./ideas.ts";
import { RECIPES } from "./recipes.ts";
import { recipePrompt } from "./recipeIdeas.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { supportsOf } from "./supportGraph.ts";
import { memberStations } from "./steps.ts";
import { shelfLineCount } from "./shelfSpan.ts";
import before from "./buildOrder.before.json" with { type: "json" };
import type { AssemblyStep, YardProject } from "./types.ts";

const STOCKS = ["", " from pvc", " from 3/4 inch dowel", " from 2x2"];
const BASE = [...new Set([...IDEAS.map((i) => i.prompt), ...RECIPES.recipes.map((r) => recipePrompt(r))])];

/** Canary step text, hashed before this change. A mismatch means stop: the rule moved a canary. */
const CANARY: Record<string, string> = {
  "linen closet 31.5 wide 78 tall 16 deep": "f06940e713f5da10fd2b1bf396323e66689da110aa8d8291f0b34a727c3b94ea",
  "pocket vanity": "99c9cb20907007bf14f0390595461cdebe6e5886a1885c37abdedb9f64b66848",
  "Andersen 100 Series 36 by 48 double hung window, frame the rough opening": "14a244b680b96359fe3b2f266a1ad657725550293235e16f7239f3de22049451",
  "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space": "f037103cf07787483cade7fe1b5d29346e141ddc22bb45334fd4683212bdf4da",
  "3 foot Eiffel Tower from popsicle sticks": "98442939a879fc1a244b3599fd4435148b74ecefc30aea0ddae039d38b06b94c",
};

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, both: 2 };
const FAMILY = "braces?|posts?|aprons?|legs?|shelves|shelf|slats?|uprights?|dividers?|treads?|rungs?";

function familyKey(word: string): string {
  const s = word.toLowerCase();
  if (s === "shelves" || s === "shelf") return "shelf";
  return s.replace(/s$/, "");
}

const FAMILY_WORD = new Set(["brace", "post", "apron", "leg", "shelf", "slat", "upright", "divider", "tread", "rung"]);

function partCounts(project: YardProject): Map<string, number> {
  const m = new Map<string, number>();
  const add = (name: string) => {
    const words = name.toLowerCase().replace(/\(.*?\)/g, " ").replace(/\d+/g, " ").split(/\s+/).filter(Boolean);
    const keys = new Set(words.map(familyKey).filter((k) => FAMILY_WORD.has(k)));
    if (!keys.size) keys.add(familyKey(words[words.length - 1] ?? name));
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  };
  if (project.panels.length) for (const p of project.panels) add(p.name);
  else for (const inst of project.instances) add(inst.role || "member");
  return m;
}

function qualifiedCount(project: YardProject, phrase: string, family: string): number | null {
  const qual = phrase.toLowerCase().match(/\b(front|back|left|right|upper|lower|diagonal|center|centre)\b/);
  if (!qual || !project.panels.length) return null;
  const n = project.panels.filter((p) => {
    const bare = p.name.toLowerCase().replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
    const last = bare.split(/\s+/).pop() ?? "";
    return bare.includes(qual[1]) && familyKey(last) === family;
  }).length;
  return n || null;
}

/** Title counts that name a part family. A parenthetical piece count is the part quantity. */
function countFaults(project: YardProject, steps: AssemblyStep[]): string[] {
  const counts = partCounts(project);
  const faults: string[] = [];
  for (const step of steps) {
    if (/^(?:confirm|cut|read|lay out|do not|print|count|mark|check|level|seal|splice)\b/i.test(step.title)) continue;
    const title = step.title;
    if (/^brace\b/i.test(title) && (counts.get("brace") ?? 0) === 0) faults.push(`"${title}" names braces and this build has none`);
    const piece = title.match(/\((\d+)\s+(?:adjustable\s+)?pieces?\)/i);
    const re = new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|both)\\s+(?:(?:front|back|left|right|upper|lower|diagonal|center|centre|fixed|adjustable)\\s+)?(${FAMILY})\\b`, "gi");
    for (const m of title.matchAll(re)) {
      const qty = NUM[m[1].toLowerCase()] ?? Number(m[1]);
      const family = familyKey(m[2]);
      const have = counts.get(family) ?? 0;
      const stated = title.match(/—\s+(\d+)\s+/);
      if (stated && Number(stated[1]) === qty) continue;
      if (piece && Number(piece[1]) === have) continue;
      if (have === qty) continue;
      if (project.instances.length) {
        const members = project.instances.filter((i) => familyKey(i.role || "member") === family);
        if (members.length > qty && memberStations(members) === qty) continue;
      }
      if (family === "shelf" && project.panels.length && shelfLineCount(project.panels.filter((p) => p.type === "shelf")) === qty) continue;
      const subset = qualifiedCount(project, m[0], family);
      if (subset === qty) continue;
      // Paired boards glued into one post: the title counts the posts, the parts list counts the boards.
      if (family === "post" && /pair/i.test(step.description) && /into one post/i.test(step.description) && have === qty * 2) continue;
      if (have === 0) faults.push(`"${m[0]}" and this build has no ${family}`);
      else faults.push(`"${m[0]}" but the parts list has ${have} ${family}`);
    }
  }
  return faults;
}

function orderFaults(project: YardProject, steps: AssemblyStep[]): string[] {
  const supports = supportsOf(project);
  const at = placementIndex(project, steps);
  const name = (id: string) => project.panels.find((p) => p.id === id)?.name ?? id;
  const deps = steps.map(() => new Set<number>());
  for (const [id, info] of supports) {
    const i = at.get(id);
    if (i == null) continue;
    for (const support of info.on) {
      const j = at.get(support);
      if (j != null && j !== i) deps[i].add(j);
    }
  }
  const cyclic = new Set<number>();
  const visit = (step: number, stack: number[]) => {
    if (stack.includes(step)) {
      for (const n of stack.slice(stack.indexOf(step))) cyclic.add(n);
      return;
    }
    stack.push(step);
    for (const next of deps[step] ?? []) visit(next, stack);
    stack.pop();
  };
  deps.forEach((_, step) => visit(step, []));
  const late: string[] = [];
  for (const [key, info] of supports) {
    const i = at.get(key);
    if (i == null) continue;
    for (const support of info.on) {
      const j = at.get(support);
      if (j == null || j <= i) continue;
      // A step that also stands parts which do not wait on that later step keeps its written order.
      const here = [...at.entries()].filter(([, idx]) => idx === i).map(([id]) => id);
      const waits = here.every((id) => (supports.get(id)?.on ?? []).some((s) => at.get(s) === j));
      const there = [...at.entries()].filter(([, idx]) => idx === j).map(([id]) => id);
      const cycle = there.some((id) => (supports.get(id)?.on ?? []).some((s) => at.get(s) === i)) || cyclic.has(j);
      if (waits && !cycle) late.push(`${name(key)} (step ${i + 1}) before ${name(support)} (step ${j + 1})`);
    }
  }
  const spanAt = steps.findIndex((s) => !/^(?:confirm|cut|read|lay out|do not|print|count|mark)\b/i.test(s.title) && /\b(?:seat|top|shelf|deck|counter|tread)s?\b/i.test(s.title));
  const frameAt = steps.findIndex((s) => {
    if (/^(?:confirm|cut|read|lay out)\b/i.test(s.title)) return false;
    const used = (s.partsUsed ?? []).filter((n) => n !== "*" && n !== "all");
    return used.some((n) => /\b(?:apron|brace)s?\b/i.test(n)) && !used.some((n) => /\b(?:seat|top|shelf|deck|counter|tread)s?\b/i.test(n)) && !/\b(?:seat|top|shelf|deck|counter|tread)s?\b/i.test(s.title);
  });
  if (spanAt >= 0 && frameAt > spanAt) late.push(`frame step "${steps[frameAt].title}" after "${steps[spanAt].title}"`);
  return late;
}

function reason(oldTitles: string, titles: string): string {
  const a = oldTitles.split(" | ");
  const b = titles.split(" | ");
  if (a.length === b.length && a.slice().sort().join(" | ") === b.slice().sort().join(" | ") && a.join(" | ") !== b.join(" | ")) {
    return "reordered: aprons and braces before the seat, top, or shelf";
  }
  const added = b.filter((t) => !a.includes(t));
  const dropped = a.filter((t) => !b.includes(t));
  if (dropped.some((t) => /\b(?:four|two|three|\d+)\s+(?:legs?|ears?|braces?|posts?|shelves)\b/i.test(t)) || added.some((t) => /\(\d+ pieces\)/.test(t))) {
    return `count matches the parts list: ${(added[0] ?? dropped[0] ?? "").slice(0, 80)}`;
  }
  if (added.length || dropped.length) return `steps follow the parts on the bench: ${(added[0] ?? dropped[0]).slice(0, 80)}`;
  return "step order follows what each part rests on";
}

describe("canary steps stay byte-identical", () => {
  for (const [prompt, hash] of Object.entries(CANARY)) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const text = plan.instructions.map((s) => `${s.title}: ${s.description}`).join("\n");
      assert.equal(createHash("sha256").update(text).digest("hex"), hash);
    });
  }
});

it("ideas and recipes, in default stock, pvc, 3/4 inch dowel and 2x2", () => {
  const changed: string[] = [];
  const faults: string[] = [];
  for (const base of BASE) {
    for (const stock of STOCKS) {
      const prompt = `${base}${stock}`;
      let project: YardProject;
      try {
        project = generateFromPrompt(prompt);
      } catch (e) {
        faults.push(`${prompt}: ${(e as Error).message}`);
        continue;
      }
      const steps = buildPlan(project).instructions;
      const titles = steps.map((s) => s.title).join(" | ");
      const old = (before as Record<string, string>)[prompt];
      if (old && old !== titles) changed.push(`${prompt} — ${reason(old, titles)}`);
      for (const fault of [...orderFaults(project, steps), ...countFaults(project, steps)]) faults.push(`${prompt}: ${fault}`);
    }
  }
  const list = [...new Set(changed)].sort();
  console.log(`\n# builds whose steps changed: ${list.length}`);
  for (const line of list) console.log(line);
  assert.deepEqual(faults, []);
});
