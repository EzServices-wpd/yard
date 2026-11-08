/** Engine output for a plan page: the drawing, a cut list summary and the steps. Loaded on demand. */
import { showcaseFor } from "./homeShowcase";
import { generateFromPrompt } from "./prompt";
import { buildPlan } from "./report";

export function planPageData(prompt: string) {
  const plan = buildPlan(generateFromPrompt(prompt));
  const show = showcaseFor(prompt, 640, 480);
  return {
    ...show,
    cuts: plan.cutList.map((c) => ({ n: c.quantity, name: c.name, size: `${c.lengthIn} × ${c.widthIn} × ${c.thicknessIn}″`, material: c.material })),
    steps: plan.instructions.map((s) => ({ title: s.title, text: s.description })),
  };
}
