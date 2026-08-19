/**
 * Stage 1 exit: any prompt builds, and a stranger can print a plan.
 * Local only. Does not call Grok.
 */
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { classifyAnatomy } from "../src/lib/yard/anatomy";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf, slugPlan } from "../src/lib/yard/pdf";
import { writeFileSync, mkdirSync } from "node:fs";

let failed = 0;
function check(name: string, ok: boolean, extra: Record<string, unknown> = {}) {
  if (!ok) failed += 1;
  console.log(JSON.stringify({ name, ok, ...extra }));
}

const wild = [
  { prompt: "Sydney Opera House from popsicle sticks", want: "shell" as const },
  { prompt: "3 foot Godzilla from toothpicks", want: "figure" as const },
  { prompt: "4 foot workbench from 2x4s, 24 inches deep, 36 high", want: "fitted" as const },
];

for (const w of wild) {
  const cls = classifyAnatomy(w.prompt);
  const project = generateFromPrompt(w.prompt);
  const pieces = project.instances.length + project.panels.length;
  const stats = project.buildStats;
  const connected =
    project.panels.length > 0 ||
    (!!stats && stats.components <= 2 && stats.loose / Math.max(stats.pieces, 1) <= 0.05);
  check(`any:${w.prompt.slice(0, 28)}`, pieces > 4 && connected && cls.anatomy === w.want, {
    anatomy: cls.anatomy,
    kind: project.kind,
    pieces,
    components: stats?.components ?? 1,
    loose: stats?.loose ?? 0,
  });
}

const prints = [
  "3 foot Eiffel Tower from popsicle sticks",
  "3 foot giraffe from popsicle sticks",
  "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
];

mkdirSync("/workspace/artifacts/plans", { recursive: true });

for (const prompt of prints) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const hasCuts = plan.cutList.length > 0;
  const hasBom = plan.bom.length > 0;
  const hasSteps = plan.instructions.length >= 3;
  let pdfBytes = 0;
  try {
    const doc = buildPlanPdf(project, plan);
    const buf = Buffer.from(doc.output("arraybuffer"));
    pdfBytes = buf.byteLength;
    writeFileSync(`/workspace/artifacts/plans/${slugPlan(project.name)}.pdf`, buf);
  } catch (err) {
    console.log(JSON.stringify({ name: `pdf-error:${prompt}`, error: String(err) }));
  }
  check(`print:${project.kind}`, hasCuts && hasBom && hasSteps && pdfBytes > 2000 && plan.instructions.length >= 8, {
    cuts: plan.cutList.length,
    bom: plan.bom.length,
    steps: plan.instructions.length,
    pdfBytes,
    status: plan.feasibility.status,
  });
}

console.log(JSON.stringify({ failed }));
if (failed) process.exit(1);
