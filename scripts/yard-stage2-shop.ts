import {
  affiliateUrl,
  amazonAssociateTag,
  amazonProductUrl,
  amazonSearchUrl,
  homeDepotSearchUrl,
  lowesSearchUrl,
  shopLinks,
  shopSearchUrl,
  stampAmazon,
} from "../src/lib/yard/shop";
import { offersFor } from "../src/lib/yard/listings";
import { generateFromPrompt, DREAMS } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { stepInstanceIds } from "../src/lib/yard/assembly";
import { buildPlanPdf } from "../src/lib/yard/pdf";

let failed = 0;
function check(name: string, ok: boolean, extra: Record<string, unknown> = {}) {
  if (!ok) failed += 1;
  console.log(JSON.stringify({ name, ok, ...extra }));
}

const q = "standard 4.5 inch popsicle sticks bulk";
check("hd", homeDepotSearchUrl(q).includes("homedepot.com"));
check("lowes", lowesSearchUrl(q).includes("lowes.com"));
check("amazon-search", amazonSearchUrl(q).includes("amazon.com/s"));
check("amazon-tag-off", !amazonSearchUrl(q, "").includes("tag="));
check("stamp-on", stampAmazon("https://www.amazon.com/dp/B0931TYTN4", "yard0c-20").includes("tag=yard0c-20"));
check("product-tag", amazonProductUrl("B0931TYTN4", "yard0c-20").includes("tag=yard0c-20"));
check("asin-path", affiliateUrl({ query: q, asin: "B0931TYTN4", retailer: "amazon" }).includes("/dp/B0931TYTN4"));
check("links", shopLinks(q).length >= 4);

const pops = offersFor("popsicle-standard", 416, { lengthIn: 4.5, widthIn: 0.375, thickIn: 0.08 });
check("pops-sorted", pops.length >= 2 && pops[0].best && pops[0].unitPrice <= pops[1].unitPrice, {
  best: pops[0]?.title,
});

const extras = [
  ...DREAMS.map((d) => d.prompt),
  "3 foot Godzilla from toothpicks",
  "Sydney Opera House from popsicle sticks",
  "4 foot workbench from 2x4s, 24 inches deep, 36 high",
];

for (const prompt of extras) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const missing = plan.bom.filter((b) => !b.offers?.length || !b.offers[0]?.href);
  const steps = plan.instructions.length;
  const plates = plan.instructions.filter((s) => stepInstanceIds(project, s).length > 0 || (s.partsUsed ?? []).includes("*")).length;
  let pdfOk = false;
  try {
    pdfOk = buildPlanPdf(project, plan).output("arraybuffer").byteLength > 3000;
  } catch (err) {
    console.log(JSON.stringify({ name: `pdf:${project.kind}`, error: String(err) }));
  }
  check(`cover:${project.kind}:${prompt.slice(0, 22)}`, missing.length === 0 && steps >= 6 && pdfOk, {
    bom: plan.bom.length,
    missing: missing.map((b) => b.name),
    steps,
    plates,
    pieces: project.instances.length + project.panels.length,
  });
}

console.log(JSON.stringify({ failed, tag: amazonAssociateTag() || null }));
if (failed) process.exit(1);
