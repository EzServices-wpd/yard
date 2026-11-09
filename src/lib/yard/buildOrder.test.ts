import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { IDEAS } from "./ideas.ts";
import { RECIPES } from "./recipes.ts";
import { recipePrompt } from "./recipeIdeas.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { memberStations } from "./steps.ts";
import { shelfLineCount } from "./shelfSpan.ts";
import { panelWorldCorners } from "./geometry.ts";
import before from "./buildOrder.before.json" with { type: "json" };
import type { AssemblyStep, Panel, YardProject } from "./types.ts";

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
  if (project.instances.length) {
    const words = "one|two|three|four|five|six|seven|eight|nine|ten|both";
    for (const role of new Set(project.instances.map((i) => i.role || "member"))) {
      const members = project.instances.filter((i) => (i.role || "member") === role);
      const stations = memberStations(members);
      if (stations >= members.length || members.length % stations !== 0) continue;
      const each = members.length / stations;
      const titled = steps.find((s) => {
        const m = s.title.match(new RegExp(`\\b(${words}|\\d+)\\s+(?:[a-z]+\\s+){0,2}${role}s?\\b`, "i"));
        if (!m) return false;
        const qty = NUM[m[1].toLowerCase()] ?? Number(m[1]);
        return qty === stations && !s.title.includes(String(members.length));
      });
      if (titled && !titled.description.includes(`${each} stick`)) faults.push(`"${titled.title}" counts ${role}s as ${stations} and never says ${each} sticks each`);
    }
  }
  return faults;
}

type Box = { min: [number, number, number]; max: [number, number, number] };

function panelBox(p: Panel): Box {
  const c = panelWorldCorners(p);
  return {
    min: [Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.min(...c.map((q) => q.z))],
    max: [Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), Math.max(...c.map((q) => q.z))],
  };
}

const overlap = (a: Box, b: Box, k: number) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);

/** The carrier's top face is flush with the span's underside, and the two overlap. */
function carries(carrier: Box, span: Box): boolean {
  return Math.abs(carrier.max[1] - span.min[1]) <= 0.1 && overlap(span, carrier, 0) >= 0.25 && overlap(span, carrier, 2) >= 0.25;
}

function orderFaults(project: YardProject, steps: AssemblyStep[], baseline: string | undefined): string[] {
  const at = placementIndex(project, steps);
  const late: string[] = [];
  const boxes = new Map(project.panels.map((p) => [p.id, panelBox(p)]));
  const stepOf = (id: string) => at.get(id);
  const bought = (p: Panel) => !/\bcaster\b/i.test(p.name) && (p.materialId === "hardware" || /\b(?:bracket|hinge|latch|hook)\b/i.test(p.name));
  for (const panel of project.panels) {
    const i = stepOf(panel.id);
    if (i == null) continue;
    const box = boxes.get(panel.id)!;
    const carriers = project.panels.filter((q) => q.id !== panel.id && carries(boxes.get(q.id)!, box));
    const seat = /\bseat\b/i.test(panel.name);
    for (const carrier of carriers) {
      // A cabinet top stays on its uprights. A seat, and any span a bracket carries, waits for that carrier.
      if (!seat && !bought(carrier)) continue;
      const j = stepOf(carrier.id);
      if (j == null || j <= i) continue;
      if (carries(box, boxes.get(carrier.id)!)) continue;
      late.push(`${panel.name} (step ${i + 1}) before ${carrier.name} (step ${j + 1})`);
    }
    const head = project.panels.find((q) => q !== panel && /\bhead\b/i.test(q.name));
    if (head && /\b(?:antler|tine)\b/i.test(panel.name)) {
      const h = stepOf(head.id);
      if (h != null && i < h) late.push(`${panel.name} (step ${i + 1}) before ${head.name} (step ${h + 1})`);
    }
  }
  if (!project.panels.length) {
    const segs = project.instances.filter((m) => m.from && m.to);
    const roleOf = (m: (typeof segs)[number]) => m.role || "member";
    const near = (pt: { x: number; y: number; z: number }, o: (typeof segs)[number]) => {
      const a = o.from!, b = o.to!;
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
      const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * ab.x + (pt.y - a.y) * ab.y + (pt.z - a.z) * ab.z) / L2));
      return Math.hypot(a.x + ab.x * t - pt.x, a.y + ab.y * t - pt.y, a.z + ab.z * t - pt.z) <= 1;
    };
    for (const role of new Set(segs.map(roleOf))) {
      const members = segs.filter((m) => roleOf(m) === role);
      const i = at.get(role);
      if (i == null) continue;
      let touched = false;
      for (const m of members) {
        const low = m.from!.y <= m.to!.y ? m.from! : m.to!;
        for (const o of segs) if (roleOf(o) !== role && near(low, o)) touched = true;
      }
      if (!touched && baseline && /\b(?:antler|tine)\b/i.test(role)) {
        const was = baseline.split(" | ").indexOf(steps[i].title);
        const here = steps.map((s) => s.title).indexOf(steps[i].title);
        if (was >= 0 && here >= 0 && here < was) late.push(`${role} has no contact and moved ahead of its written step`);
      }
    }
  }
  for (let i = 0; i < steps.length; i++) {
    if (/^(?:confirm|cut|read|lay out|do not|print|count|mark)\b/i.test(steps[i].title)) continue;
    const text = `${steps[i].title} ${steps[i].description}`;
    for (const panel of project.panels) {
      const j = stepOf(panel.id);
      if (j == null || j <= i) continue;
      const watches = /\bseat\b/i.test(panel.name) || bought(panel) || /\bramp\b/i.test(panel.name);
      if (!watches) continue;
      const plain = panel.name.replace(/^[A-Z]{1,2} /, "");
      if (plain.length < 4) continue;
      const escaped = plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?:through|to|onto|into|on|under) the (?:[A-Z]{1,2} )?${escaped}\\b`, "i");
      if (re.test(text)) late.push(`"${steps[i].title}" names ${panel.name} before that part is placed`);
    }
  }
  const rotor = project.panels.some((p) => p.turns && /^dowel-/.test(p.materialId) && !/\blid\b/i.test(p.name))
    || project.panels.some((p) => /\b(?:wheel|axle|hub|paddle|spoke)\b/i.test(p.name));
  const boughtName = (name: string) => project.panels.some((p) => p.name.toLowerCase() === name.toLowerCase() && (p.materialId === "hardware" || /\b(?:hinge|bracket|latch|hook|caster)\b/i.test(p.name)));
  for (const step of steps) {
    const text = `${step.title} ${step.description}`;
    if (!rotor && /wheel parts|the wheel turns/i.test(text)) late.push(`"${step.title}" talks about a wheel and nothing turns`);
    if (/glue/i.test(text)) {
      const to = text.match(/to (?:the |both )?(?:[A-Z]{1,2} )?([A-Za-z][\w ]{0,40}?)(?:\s+with|\s+and|\.|,)/i);
      if (to && (boughtName(to[1].trim()) || /\b(?:hinges?|brackets?|latches?|hooks?|casters?)\b/i.test(to[1]))) late.push(`"${step.title}" glues a part to bought hardware`);
    }
    if (/\bthe [A-Z]{1,2} (?:Lid|Backrest|Seat lid)\b/.test(text)) late.push(`"${step.title}" prints a cut-list letter in the name`);
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
      for (const fault of [...orderFaults(project, steps, old), ...countFaults(project, steps)]) faults.push(`${prompt}: ${fault}`);
    }
  }
  const list = [...new Set(changed.map((line) => line.split(" — ")[0]))].sort();
  console.log(`\n# builds whose steps changed: ${list.length}`);
  for (const line of [...new Set(changed)].sort()) console.log(line);
  assert.deepEqual(faults, []);
  assert.deepEqual(list, MOVED);
});

/** Reviewed prompts whose step titles differ from buildOrder.before.json. A new one fails until it is added here. */
const MOVED = [
  "8 foot folding table from 2x2",
  "adirondack footrest from pvc",
  "coat bench",
  "coat bench from 2x2",
  "coat rack with bench 48 wide",
  "coat rack with bench 48 wide from 2x2",
  "colosseum from 3/4 inch dowel",
  "compost bin from 3/4 inch dowel",
  "daybed 75 wide 22 high 39 deep",
  "daybed 75 wide 22 high 39 deep from 2x2",
  "deck stairs from pvc",
  "dog from popsicle sticks",
  "dog from popsicle sticks from 2x2",
  "dog from popsicle sticks from pvc",
  "ferris wheel from 3/4 inch dowel",
  "floating desk from 3/4 inch dowel",
  "floating desk from pvc",
  "folding table 6 foot from 2x2",
  "folding table from 2x2",
  "laundry folding table 48 wide 36 high 24 deep from 2x2",
  "marble run from 3/4 inch dowel",
  "mudroom bench 48 wide 18 high 16 deep",
  "mudroom bench 48 wide 18 high 16 deep from 2x2",
  "outdoor storage bench",
  "outdoor storage bench from 2x2",
  "outdoor storage bench from 3/4 inch dowel",
  "outdoor storage bench from pvc",
  "raised dog feeder stand from 3/4 inch dowel",
  "raised dog feeder stand from pvc",
  "reindeer from pvc",
  "router table from pvc",
  "shoe bench",
  "shoe bench 36 wide",
  "shoe bench 36 wide from 2x2",
  "shoe bench from 2x2",
  "standing desk converter",
  "standing desk converter from 2x2",
  "standing desk converter from 3/4 inch dowel",
  "standing desk converter from pvc",
  "step stool",
  "step stool from 2x2",
  "storage bench",
  "storage bench from 2x2",
  "taj mahal from 3/4 inch dowel",
  "toy train track riser",
  "toy train track riser from 2x2",
  "toy train track riser from 3/4 inch dowel",
  "toy train track riser from pvc",
  "window seat 60 wide 18 high 20 deep",
  "window seat 60 wide 18 high 20 deep from 2x2",
];
