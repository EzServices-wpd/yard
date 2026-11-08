/** Report-only run of the I37 hunter: counts per sub-check with example prompts. `npx tsx scripts/hunter-report.ts` */
import { hunterCorpus, hunterHits } from "./hunter-lib.ts";

const rows = hunterCorpus();
const hits = hunterHits(rows);
const by = new Map<string, Set<string>>();
const ex = new Map<string, string[]>();
for (const [k, h] of hits) {
  const [cw, prompt] = [k.slice(0, k.indexOf("|")), k.slice(k.indexOf("|") + 1)];
  const check = cw.split(":")[0];
  (by.get(check) ?? by.set(check, new Set()).get(check)!).add(prompt);
  const l = ex.get(cw) ?? ex.set(cw, []).get(cw)!;
  if (l.length < 3) l.push(`${prompt} [${h.src} · ${h.where}: ${h.match}]`);
}
console.log(`${rows.length} prompts, ${new Set([...hits.keys()].map((k) => k.slice(k.indexOf("|") + 1))).size} with hits, ${hits.size} hits`);
for (const [c, ps] of by) {
  console.log(`\n${c}: ${ps.size} prompts`);
  for (const [cw, l] of ex) if (cw.startsWith(`${c}:`)) { console.log(`  ${cw}`); for (const e of l) console.log(`    ${e}`); }
}
