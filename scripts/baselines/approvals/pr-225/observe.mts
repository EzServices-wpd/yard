/**
 * NR-1 mover generator, part 2: build every prompt on THIS checkout and write one JSON line each.
 * Resumes: prompts already in out.jsonl are skipped. Run from the repo root of the checkout to measure:  npx tsx <path>/observe.ts prompts.json out.jsonl
 * Network is off; nothing calls Grok.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

globalThis.fetch = (async () => { throw new Error("network is off"); }) as typeof fetch;
const root = process.cwd();
const { generateFromPrompt } = await import(pathToFileURL(path.join(root, "src/lib/yard/promptMain.ts")).href);
const { buildPlan } = await import(pathToFileURL(path.join(root, "src/lib/yard/report.ts")).href);
const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 10);
const prompts: string[] = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const done = new Set(fs.existsSync(process.argv[3]) ? fs.readFileSync(process.argv[3], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).prompt) : []);
const out = fs.openSync(process.argv[3], "a");
for (const prompt of prompts) {
  if (done.has(prompt)) continue;
  let o: Record<string, unknown>;
  try {
    const p = generateFromPrompt(prompt);
    const pl = buildPlan(p);
    o = {
      prompt, name: p.name, W: p.overall.width, D: p.overall.depth, H: p.overall.height, refused: p.refused ?? null,
      usd: p.refused ? 0 : pl.totals.estCostUsd, pieces: pl.totals.pieces,
      cut: h(pl.cutList.map((c: any) => [c.name, c.lengthIn, c.widthIn, c.thicknessIn, c.quantity, c.material])),
    };
  } catch (e) {
    o = { prompt, name: `THREW ${(e as Error).message}`, W: -1, D: -1, H: -1, refused: null, usd: -1, pieces: -1, cut: "" };
  }
  fs.writeSync(out, JSON.stringify(o) + "\n");
}
