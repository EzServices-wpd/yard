/**
 * Build type per Ideas card: the engine's own result key for the card's prompt (the same key the visitor log
 * stores), so log rows fold into the curated card. Writes src/lib/ideas/types.json; /ideas never runs the engine.
 * Run: npx tsx scripts/gen-idea-types.ts   (re-run with gen-idea-drawings when an idea changes)
 */
import fs from "fs";
import { IDEAS } from "../src/lib/yard/ideas";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { typeKey } from "../src/lib/ideas/liveFeed";
import RECIPES from "../src/lib/ideas/recipes.json";

/** The resultKey base ideaLog.server.recordFromPrompt stores. */
export const nameBase = (n: string) => n.replace(/[\d'"″′×x./\s]+$/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ideaTypes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of [...IDEAS, ...RECIPES.popular, ...RECIPES.fresh]) out[d.id] = typeKey(`builtin:${nameBase(generateFromPrompt(d.prompt).name)}`);
  return out;
}

if (process.argv[1]?.endsWith("gen-idea-types.ts")) {
  fs.writeFileSync("src/lib/ideas/types.json", JSON.stringify(ideaTypes(), null, 1) + "\n");
  console.log("wrote src/lib/ideas/types.json");
}
