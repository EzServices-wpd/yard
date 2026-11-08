/**
 * Weekend canaries: landmark and machine builds whose geometry must not move.
 * `npx tsx scripts/weekend-canaries.ts` prints the snapshot; `--write` rewrites evals/weekend-canaries.json
 * (only on purpose, with Critic's approval). scripts/weekend-canaries.test.ts fails on any difference.
 */
import { writeFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { offline } from "./eval-lib.ts";

export const CANARIES = ["big ben", "eiffel tower", "brooklyn bridge", "trebuchet", "submarine", "water wheel"];

const r = (n: number) => Math.round(n * 1000) / 1000 + 0; // +0: JSON has no -0
type V = { x: number; y: number; z: number };
const v = (p?: Partial<V>) => (p ? [r(p.x ?? 0), r(p.y ?? 0), r(p.z ?? 0)] : null);

export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  offline(() => {
    for (const q of CANARIES) {
      const p = generateFromPrompt(q);
      const parts = p.panels.map((x) => ({ name: x.name, type: x.type, mat: x.materialId, pos: v(x.position), size: [r(x.size.width), r(x.size.height), r(x.size.depth)] }));
      const inst = (p.instances ?? []).map((i: { name?: string; position?: V; size?: { width: number; height: number; depth: number } }) => ({ name: i.name ?? null, pos: v(i.position), size: i.size ? [r(i.size.width), r(i.size.height), r(i.size.depth)] : null }));
      out[q] = { name: p.name, overall: [r(p.overall.width), r(p.overall.height), r(p.overall.depth)], partCount: parts.length + inst.length, parts, instances: inst };
    }
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = JSON.stringify(snapshot(), null, 1) + "\n";
  if (process.argv.includes("--write")) writeFileSync(new URL("../evals/weekend-canaries.json", import.meta.url), s);
  else process.stdout.write(s);
}
