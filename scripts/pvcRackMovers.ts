/**
 * The prompt set for the PVC rack mover list, and a before/after dump.
 * YARD_ROOT points at the tree to build. Default is this repo.
 *
 *   YARD_ROOT=/path npx tsx --tsconfig tsconfig.json scripts/pvcRackMovers.ts prompts
 *   YARD_ROOT=/path npx tsx --tsconfig tsconfig.json scripts/pvcRackMovers.ts run out.json
 */
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { corpus } from "./invariants-corpus.ts";
import { STRESS_PROMPTS } from "../src/lib/yard/stressPrompts.ts";

export type SweepPrompt = { prompt: string; material?: string };

const TYPES = ["shoe", "bike", "towel", "wine", "spice", "drying", "magazine", "dish", "plate", "kayak", "firewood", "spool"];
const SIZES = ["", " 24 wide", " 12 wide", " 36 wide 12 deep 30 tall", " 96 wide 48 tall"];
const GATE = /\b(?:shoe|bike|towel|wine|spice|drying|magazine|dish|plate|kayak|firewood|spool)\s+racks?\b/i;

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

function corpusPrompts(): string[] {
  const all = new Set<string>([...corpus(), ...STRESS_PROMPTS]);
  for (const f of readdirSync(new URL("../evals/corpus/", import.meta.url))) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(readFileSync(new URL(`../evals/corpus/${f}`, import.meta.url), "utf8"));
    const walk = (x: unknown) => {
      if (typeof x === "string") all.add(x);
      else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === "object") for (const v of Object.values(x as Record<string, unknown>)) walk(v);
    };
    walk(j);
  }
  try {
    const hunter = JSON.parse(readFileSync(new URL("../evals/hunter-corpus.json", import.meta.url), "utf8")).prompts as string[];
    for (const p of hunter) all.add(p);
  } catch { /* hunter file is optional */ }
  return [...all];
}

/** Every prompt the mover list is built from. Corpus racks, a size grid, and the critic's examples. */
export function sweepPrompts(): SweepPrompt[] {
  const rows: SweepPrompt[] = [];
  const seen = new Set<string>();
  const add = (prompt: string, material?: string) => {
    const key = `${prompt}\0${material ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(material ? { prompt, material } : { prompt });
  };
  for (const prompt of corpusPrompts()) {
    if (!GATE.test(prompt) || /\b(?:peg|hook)s?\b/i.test(prompt)) continue;
    add(prompt);
    add(prompt, "pvc-3-4-sch40");
  }
  for (const type of TYPES) {
    for (const size of SIZES) {
      add(`${type} rack${size}`);
      add(`pvc ${type} rack${size}`);
      add(`${type} racks${size}`, "pvc-3-4-sch40");
    }
    add(`pvc ${type} racks rail`);
    add(`dowel ${type} rack`);
    add(`dowel ${type} rack 12 wide`);
    add(`pvc dowel ${type} rack 12 wide`);
    add(`${type} rack wall mounted`, "pvc-3-4-sch40");
  }
  add("PVC shoe rack 36 wide 12 deep 30 tall");
  add("pvc shoe racks rail");
  add("pvc dowel drying rack 12 wide");
  add("pvc bike rack");
  add("something to hold my firewood", "pvc-3-4-sch40");
  add("firewood rack 96 wide 48 tall", "pvc-3-4-sch40");
  add("drying rack 6 wide", "pvc-3-4-sch40");
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

const mode = process.argv[2];
if (mode === "prompts") {
  process.stdout.write(`${JSON.stringify({ release: "645a038664c94050467197a13ade2e8798933995", prompts: sweepPrompts() }, null, 2)}\n`);
} else if (mode === "run") {
  const rows = await sweepRows();
  process.stdout.write(`${JSON.stringify(rows)}\n`);
}
