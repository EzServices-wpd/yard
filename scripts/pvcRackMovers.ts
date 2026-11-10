/**
 * The prompt set for the PVC rack mover list, and a before/after dump.
 * YARD_ROOT points at the tree to build. Default is this repo.
 *
 *   YARD_ROOT=/path npx tsx --tsconfig tsconfig.json scripts/pvcRackMovers.ts prompts
 *   YARD_ROOT=/path npx tsx --tsconfig tsconfig.json scripts/pvcRackMovers.ts run out.json
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { corpus } from "./invariants-corpus.ts";
import { STRESS_PROMPTS } from "../src/lib/yard/stressPrompts.ts";
import { SWEEPS } from "./class-sweep-prompts.ts";
import { IDEAS } from "../src/lib/yard/ideas.ts";
import { DREAMS } from "../src/lib/yard/promptDreams.ts";
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { recipePrompt } from "../src/lib/yard/recipeIdeas.ts";
import { hunterCorpus } from "./hunter-lib.ts";
import { DECLARED_RACK_TYPES, declaredRack } from "../src/lib/yard/memberStock.ts";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { headerSize } from "../src/lib/yard/headerSize.ts";
import { isSeatedPipeFrame, railsMissUprights, uprightHeights } from "../src/lib/yard/pipeRackFrame.ts";
import { countsDropped, featureBuilt, featureNoted, typedFeatures } from "../src/lib/yard/typedFeatures.ts";

export type SweepPrompt = { prompt: string; material?: string };

export const PVC = "pvc-3-4-sch40";

const CONTROLS: SweepPrompt[] = [
  { prompt: "tv console" },
  { prompt: "tv console 70 wide 30 deep 16 tall", material: "pvc-3-4-sch40" },
  { prompt: "daybed", material: "pvc-3-4-sch40" },
  { prompt: "window seat", material: "pvc-3-4-sch40" },
  { prompt: "boot stand", material: "pvc-3-4-sch40" },
  { prompt: "ball rack", material: "pvc-3-4-sch40" },
  { prompt: "hat rack", material: "pvc-3-4-sch40" },
  { prompt: "tool rack", material: "pvc-3-4-sch40" },
  { prompt: "garment rack", material: "pvc-3-4-sch40" },
  { prompt: "coat rack", material: "pvc-3-4-sch40" },
  { prompt: "spice rack", material: "pvc-3-4-sch40" },
  { prompt: "bookcase", material: "pvc-3-4-sch40" },
  { prompt: "pantry", material: "pvc-3-4-sch40" },
  { prompt: "nightstand", material: "pvc-3-4-sch40" },
  { prompt: "kitchen base", material: "pvc-3-4-sch40" },
  { prompt: "sofa table", material: "pvc-3-4-sch40" },
  { prompt: "workbench", material: "pvc-3-4-sch40" },
  { prompt: "pvc cart" },
  { prompt: "drinking straw spice rack" },
  { prompt: "dowel shoe rack" },
  { prompt: "paper towel roll rack" },
  { prompt: "linen closet 31.5 wide 78 tall 16 deep" },
  { prompt: "pocket vanity" },
  { prompt: "big ben" },
  { prompt: "brooklyn bridge" },
  { prompt: "eiffel tower" },
  { prompt: "submarine" },
  { prompt: "trebuchet" },
  { prompt: "water wheel" },
  { prompt: "3 foot Eiffel Tower from popsicle sticks" },
  { prompt: "pvc fence 20 ft long" },
  { prompt: "fence" },
];

function walkStrings(x: unknown, into: Set<string>) {
  if (typeof x === "string") {
    if (x.length > 2 && x.length < 180) into.add(x.trim());
  } else if (Array.isArray(x)) x.forEach((v) => walkStrings(v, into));
  else if (x && typeof x === "object") for (const v of Object.values(x as Record<string, unknown>)) walkStrings(v, into);
}

function quotedRackPrompts(): string[] {
  const out: string[] = [];
  const roots = [new URL("../src/", import.meta.url), new URL("../scripts/", import.meta.url), new URL("../evals/", import.meta.url)];
  const files: string[] = [];
  const walkDir = (dir: URL) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(name.name + (name.isDirectory() ? "/" : ""), dir);
      if (name.isDirectory()) {
        if (name.name === "node_modules") continue;
        walkDir(url);
      } else if (/\.(ts|json)$/.test(name.name) && !name.name.startsWith("pvcRackMovers")) files.push(url.pathname);
    }
  };
  for (const root of roots) walkDir(root);
  const re = /"([^"\\\n]{3,160})"/g;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(re)) {
      const s = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
      if (declaredRack(s) && looksLikePrompt(s)) out.push(s);
    }
  }
  return out;
}

function looksLikePrompt(s: string): boolean {
  if (s.length > 140) return false;
  if (/[→\\]|want \d|Guidance only|class default|https?:|\/\//.test(s)) return false;
  if (/^(?:note|fail|assert|the |a |an )\b/i.test(s)) return false;
  if (/\b(?:go|will|never|means|stays|says|wins|divides|rip off)\b/i.test(s)) return false;
  return /^[\w\d"'“]/.test(s);
}

/** Every rack-type prompt in the corpora, the class sweeps, and the quoted prompt lists. */
export function corpusRackPrompts(): string[] {
  const all = new Set<string>();
  const add = (s: unknown) => { if (typeof s === "string") all.add(s.trim()); };
  for (const s of corpus()) add(s);
  for (const s of STRESS_PROMPTS) add(s);
  for (const sw of Object.values(SWEEPS)) for (const p of sw.prompts) add(p);
  for (const i of IDEAS) add(i.prompt);
  for (const d of DREAMS) add(d.prompt);
  for (const r of RECIPES.recipes) add(recipePrompt(r));
  for (const h of hunterCorpus()) add(h.prompt);
  for (const s of quotedRackPrompts()) add(s);
  const root = new URL("../", import.meta.url);
  for (const rel of ["evals/gate.json", "evals/prompts.json", "evals/hunter-corpus.json", "evals/corpus/answer-keys.json"]) {
    walkStrings(JSON.parse(readFileSync(new URL(rel, root), "utf8")), all);
  }
  for (const f of readdirSync(new URL("evals/corpus/", root))) {
    if (f.endsWith(".json")) walkStrings(JSON.parse(readFileSync(new URL(`evals/corpus/${f}`, root), "utf8")), all);
  }
  return [...all].filter((p) => declaredRack(p) && looksLikePrompt(p)).sort();
}

/**
 * The mover list: every corpus rack prompt, that prompt again in 3/4" PVC,
 * and the pvc / conduit / EMT / wood / straw wordings of those racks.
 */
export function sweepPrompts(): SweepPrompt[] {
  const rows: SweepPrompt[] = [];
  const seen = new Set<string>();
  const add = (prompt: string, material?: string) => {
    const text = prompt.replace(/\s+/g, " ").trim();
    if (!text || !declaredRack(text) && !CONTROLS.some((c) => c.prompt === text)) return;
    const key = `${text}\0${material ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(material ? { prompt: text, material } : { prompt: text });
  };
  for (const prompt of corpusRackPrompts()) {
    add(prompt);
    add(prompt, PVC);
    if (/\bpvc\b|conduit|\bemt\b|\bstraws?\b|\bdowels?\b/i.test(prompt)) continue;
    add(`${prompt} from pvc`);
    add(`pvc ${prompt}`);
    add(`pvc pipe ${prompt}`);
  }
  for (const stock of ["conduit", "EMT", "wood", "straw"]) {
    add(`${stock} shoe rack`, PVC);
    add(`${stock} shoe racks`, PVC);
  }
  for (const type of DECLARED_RACK_TYPES) {
    add(`${type} rack`);
    add(`${type} rack`, PVC);
    add(`${type} racks`);
    add(`pvc ${type} racks`);
    add(`3 tier pvc ${type} rack`);
    add(`pvc pipe ${type} rack`);
  }
  for (const row of CONTROLS) add(row.prompt, row.material);
  return rows;
}

export type SweepRow = {
  prompt: string;
  material: string | null;
  name: string;
  cost: number;
  pieces: number;
  hud: [number, number, number];
  buy: string;
  notes: string[];
  steps: string[];
  offers: string[];
};

function root(): string {
  return process.env.YARD_ROOT ?? new URL("..", import.meta.url).pathname;
}

async function engine() {
  const base = root().replace(/\/$/, "");
  const imp = (rel: string) => import(pathToFileURL(`${base}/${rel}`).href);
  const promptMain = await imp("src/lib/yard/promptMain.ts");
  const report = await imp("src/lib/yard/report.ts");
  const header = await imp("src/lib/yard/headerSize.ts");
  return {
    generateFromPrompt: promptMain.generateFromPrompt as (prompt: string, material?: string) => {
      name: string;
      notes?: string[];
      instances: unknown[];
    },
    buildPlan: report.buildPlan as (project: unknown) => {
      totals: { estCostUsd: number };
      bom: { name: string; quantity: number; offers?: { title: string }[] }[];
      instructions: { title: string; description?: string; tips?: string }[];
    },
    headerSize: header.headerSize as (project: unknown) => { width: number; depth: number; height: number },
  };
}

export async function sweepRows(): Promise<SweepRow[]> {
  const { generateFromPrompt, buildPlan, headerSize } = await engine();
  const out: SweepRow[] = [];
  for (const row of sweepPrompts()) {
    try {
      const project = row.material ? generateFromPrompt(row.prompt, row.material) : generateFromPrompt(row.prompt);
      const plan = buildPlan(project);
      const hud = headerSize(project);
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      out.push({
        prompt: row.prompt,
        material: row.material ?? null,
        name: project.name,
        cost: Math.round(plan.totals.estCostUsd * 100) / 100,
        pieces: project.instances.length,
        hud: [r3(hud.width), r3(hud.depth), r3(hud.height)],
        buy: plan.bom.map((b) => `${b.quantity} ${b.name}`).join("; "),
        notes: project.notes ?? [],
        steps: plan.instructions.map((s) => `${s.title} || ${s.description ?? ""} || ${s.tips ?? ""}`),
        offers: [...new Set(plan.bom.flatMap((b) => (b.offers ?? []).map((o) => o.title)))],
      });
    } catch (err) {
      out.push({
        prompt: row.prompt,
        material: row.material ?? null,
        name: `ERROR ${(err as Error).message}`,
        cost: -1,
        pieces: -1,
        hud: [0, 0, 0],
        buy: "",
        notes: [],
        steps: [],
        offers: [],
      });
    }
  }
  return out;
}

export type CurrentRow = {
  prompt: string;
  material: string | null;
  name: string;
  cost: number;
  pieces: number;
  hud: [number, number, number];
  buy: string;
  titles: string[];
  omitted: string[];
};

/** The build this tree produces for every sweep prompt. The results test diffs this. */
export function currentRows(): CurrentRow[] {
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return sweepPrompts().map((row) => {
    const project = row.material ? generateFromPrompt(row.prompt, row.material) : generateFromPrompt(row.prompt);
    const plan = buildPlan(project);
    const hud = headerSize(project);
    const omitted: string[] = [];
    if (isSeatedPipeFrame(project)) {
      if (uprightHeights(project.instances).length > 1) omitted.push("plumb-height");
      if (railsMissUprights(project.instances)) omitted.push("set-rails");
      const shelfGone = typedFeatures(row.prompt).includes("shelves") && !featureBuilt(project, "shelves") && !featureNoted(project, "shelves");
      const shelfCount = countsDropped(project, row.prompt).some(([f]) => f === "shelves");
      if (shelfGone || shelfCount) omitted.push("shelf-note");
    }
    return {
      prompt: row.prompt,
      material: row.material ?? null,
      name: project.name,
      cost: Math.round(plan.totals.estCostUsd * 100) / 100,
      pieces: project.instances.length + project.panels.length,
      hud: [r3(hud.width), r3(hud.depth), r3(hud.height)] as [number, number, number],
      buy: plan.bom.map((b) => `${b.quantity}×${b.name}=${Math.round((b.estimatedCost ?? 0) * 100) / 100}`).join("; "),
      titles: plan.instructions.map((s) => s.title),
      omitted,
    };
  });
}

const mode = process.argv[2];
if (mode === "prompts") {
  const body = { release: "645a038664c94050467197a13ade2e8798933995", prompts: sweepPrompts() };
  if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(body, null, 2)}\n`);
  else process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
} else if (mode === "write") {
  const fresh = currentRows();
  const beforePath = process.argv[3];
  const outPath = process.argv[4] ?? new URL("../evals/pvcRackMovers.results.json", import.meta.url).pathname;
  const before = beforePath ? JSON.parse(readFileSync(beforePath, "utf8")) as { prompt: string; material: string | null; name: string; cost: number; pieces: number; hud: [number, number, number]; buy: string }[] : [];
  const prior = new Map(before.map((r) => [`${r.prompt}\0${r.material ?? ""}`, r]));
  const rows = fresh.map((row) => {
    const b = prior.get(`${row.prompt}\0${row.material ?? ""}`);
    return {
      prompt: row.prompt,
      material: row.material,
      before: b ? { name: b.name, cost: b.cost, pieces: b.pieces, hud: b.hud, buy: b.buy } : { name: row.name, cost: row.cost, pieces: row.pieces, hud: row.hud, buy: row.buy },
      after: { name: row.name, cost: row.cost, pieces: row.pieces, hud: row.hud, buy: row.buy, titles: row.titles },
      omitted: row.omitted,
    };
  });
  const movers = rows.filter((r) => r.before.cost !== r.after.cost || r.before.buy !== r.after.buy || r.before.pieces !== r.after.pieces || JSON.stringify(r.before.hud) !== JSON.stringify(r.after.hud)).length;
  writeFileSync(outPath, `${JSON.stringify({ release: "645a038664c94050467197a13ade2e8798933995", prompts: rows.length, movers, rows }, null, 2)}\n`);
  process.stderr.write(`wrote ${rows.length} prompts, ${movers} movers\n`);
} else if (mode === "run") {
  const rows = await sweepRows();
  process.stdout.write(`${JSON.stringify(rows)}\n`);
}
