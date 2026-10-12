/**
 * Linen-closet exactness: "linen closet 31.5 wide 78 tall 16 deep" must print byte-for-byte the committed
 * baseline (name, size, parts, Buy, steps). A hard stop for every push and every recipe-bot PR.
 */
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";

const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
const pl = buildPlan(p);
const now = [
  `${p.name} ${JSON.stringify((p as { overall: unknown }).overall)} ${p.panels.map((x) => x.name).join("; ")}`,
  pl.bom.map((b) => b.name).join(", "),
  pl.instructions.map((s) => `${s.title}: ${s.description}`).join("\n"),
].join("\n") + "\n";
const base = readFileSync(new URL("./baselines/linen-closet.txt", import.meta.url), "utf8");
if (now !== base) {
  console.error("FAIL linen closet changed");
  process.exit(1);
}
console.log("PASS linen closet exact");
