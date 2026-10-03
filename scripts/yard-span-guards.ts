/**
 * Universal span rule guard: no seat spans farther than its stock holds unless the user asked
 * for it open ("no middle leg"); dividers count as supports; center supports ride the one model.
 *
 *   npx tsx scripts/yard-span-guards.ts
 */
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { spanFindings, bearingCenters } from "../src/lib/yard/spanCheck";
import { buildPlan } from "../src/lib/yard/report";
import { uniqueSteps } from "../src/lib/yard/steps";

let failed = 0;
const ok = (id: string, msg: string) => console.log(`PASS span ${id}  ${msg}`);
const fail = (id: string, msg: string) => {
  failed++;
  console.log(`FAIL span ${id}  ${msg}`);
};
const seatSpans = (p: ReturnType<typeof generateFromPrompt>) => spanFindings(p).filter((f) => f.load === "person");
const supports = (p: ReturnType<typeof generateFromPrompt>) => p.panels.filter((q) => q.name.startsWith("Center support"));

{
  const p = generateFromPrompt("pine porch bench");
  const seat = p.panels.find((q) => /seat/i.test(q.name) && (q.type === "top" || q.type === "deck"));
  const held = seat ? bearingCenters(seat, p.panels).length + supports(p).length : 0;
  if (!seat) fail("porch-bench", "no seat panel");
  else if (seatSpans(p).length) fail("porch-bench", `seat still over its span: ${seatSpans(p)[0].message}`);
  else if (held < 1) fail("porch-bench", "47\" seat has nothing under it between the ends");
  else ok("porch-bench", `seat held by ${held} support(s) under it, no span warning`);
}
{
  const p = generateFromPrompt("pine porch bench, no middle leg");
  if (!seatSpans(p).length) fail("porch-bench-open", "the warning is gone although the seat is open underneath");
  else if (supports(p).length) fail("porch-bench-open", "a center support was added against 'no middle leg'");
  else if (!p.notes.some((n) => /Open underneath, as asked/.test(n))) fail("porch-bench-open", "no note saying it stays open");
  else ok("porch-bench-open", seatSpans(p)[0].message);
}
{
  const p = generateFromPrompt("picnic table");
  const s = supports(p);
  const plan = buildPlan(p);
  const cut = plan.cutList.filter((c) => /Center support/.test(c.name)).reduce((n, c) => n + c.quantity, 0);
  const steps = uniqueSteps(p).some((st) => /divider|support/i.test(`${st.title} ${st.description}`));
  if (!s.length) fail("picnic-seats", "68\" bench seats got no center support");
  else if (seatSpans(p).length) fail("picnic-seats", `still over: ${seatSpans(p)[0].message}`);
  else if (cut !== s.length) fail("picnic-seats", `cut list has ${cut} center supports, model has ${s.length}`);
  else if (!steps) fail("picnic-seats", "steps never set the supports");
  else if (!p.notes.some((n) => /^Center support under/.test(n))) fail("picnic-seats", "no note explaining the support");
  else ok("picnic-seats", `${s.length} center supports in model, cut list and steps`);
}
for (const [prompt, id] of [
  ["entry bench 42 wide with shoe shelf", "entry-bench-42"],
  ["mudroom cubbies", "mudroom-cubbies"],
  ["desk 60 wide 30 deep 29 tall with a 24 inch knee", "desk-knee"],
  ["bunk bed twin over twin", "bunk"],
] as const) {
  const p = generateFromPrompt(prompt);
  if (supports(p).length) fail(id, `added ${supports(p).length} center support(s) where dividers/knee space already decide`);
  else ok(id, "unchanged — no center support added");
}
if (failed) {
  console.log(`span guards: ${failed} FAIL`);
  process.exit(1);
}
console.log("span guards: all PASS");
