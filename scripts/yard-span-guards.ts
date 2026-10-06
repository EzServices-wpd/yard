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
  // The seat boards span frame to frame: the table carries a middle A-frame when the span asks for one.
  const p = generateFromPrompt("picnic table");
  const mids = p.panels.filter((x) => /^Seat support middle/.test(x.name)).length;
  const plan = buildPlan(p);
  const cut = plan.cutList.filter((c) => /Seat support middle/.test(c.name)).reduce((n, c) => n + c.quantity, 0);
  const steps = uniqueSteps(p).some((st) => /Seat support middle/i.test(`${st.title} ${st.description}`));
  if (seatSpans(p).length) fail("picnic-seats", `still over: ${seatSpans(p)[0].message}`);
  else if (!mids) fail("picnic-seats", "72\" seat boards got no middle frame");
  else if (cut !== mids) fail("picnic-seats", `cut list has ${cut} middle seat supports, model has ${mids}`);
  else if (!steps) fail("picnic-seats", "steps never set the middle frame");
  else if (!p.notes.some((n) => /middle frame keeps every seat span/.test(n))) fail("picnic-seats", "no note explaining the middle frame");
  else ok("picnic-seats", `${mids} middle frame in model, cut list and steps; every seat span within the stock`);
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
