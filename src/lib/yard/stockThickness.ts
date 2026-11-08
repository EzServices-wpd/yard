/**
 * I28 (F32) stock thickness never scales: every sheet or board part is as thick as the stock it is cut from,
 * or a whole number of layers of it glued face to face, with a glue-up step and a cut-list note that say so
 * (the layer count × the stock's thickness). Lengths and widths scale with the build; thickness never does.
 */
import { getCatalogItem } from "./catalog";
import { isBoughtHardwareName } from "./boughtHardware";
import type { BuildPlan, Panel, YardProject } from "./types";

export const THICK_TOL = 1 / 32;

/** The stock's real thickness: a sheet's, or a board's smaller face (1 1/2" for a 2x4). Undefined for round or bought stock. */
export function stockThickness(materialId: string): number | undefined {
  const it = getCatalogItem(materialId);
  if (!it || /^dowel-/.test(materialId)) return undefined;
  if (it.formFactor === "sheet") return it.dims.thickness;
  if (it.category === "lumber" && it.dims.width && it.dims.height) return Math.min(it.dims.width, it.dims.height);
  return undefined;
}

/** A part's thickness: a turned board's blank, else its smallest side. */
export function partThickness(p: Panel): number {
  if (p.blank) return p.blank.thicknessIn;
  return Math.min(p.size.width, p.size.height, p.size.depth);
}

/** Wood and card parts cut from a stock: not glass or a mirror, not a drawer's bounding box, not a framed opening. */
const GLAZING = /\b(?:mirror|glass|glazing|crystal|acrylic|lens|window pane)s?\b/i;
const checked = (p: Panel) =>
  !p.strut && !p.form && !p.outline && p.materialId !== "hardware" && !isBoughtHardwareName(p.name) && p.type !== "drawer" && p.type !== "mirror" &&
  !/\bdrawer(?: \d+)?$/i.test(p.name) && !GLAZING.test(p.name) && partThickness(p) > 0.02 && stockThickness(p.materialId) != null;

const family = (p: Panel) => p.name.replace(/ \d+$/, "");

/** I28 messages: parts whose thickness is not a whole number of stock layers, or a glue-up nothing says. */
export function thicknessFailures(project: Pick<YardProject, "panels"> & Partial<Pick<YardProject, "kind" | "windowPkg">>, plan?: Pick<BuildPlan, "instructions" | "cutList">): string[] {
  const out: string[] = [];
  // A framed opening's built-up header (two 2x plies and a spacer) has its own framing rule.
  if (project.kind === "opening" || project.windowPkg) return out;
  const glue = plan?.instructions.find((s) => s.title === "Glue up the thick parts")?.description ?? "";
  const seen = new Set<string>();
  for (const p of project.panels.filter(checked)) {
    const T = stockThickness(p.materialId)!, t = partThickness(p);
    const k = Math.round(t / T);
    const key = `${family(p)}|${t.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = getCatalogItem(p.materialId)?.name ?? p.materialId;
    if (k < 1 || Math.abs(t - k * T) > THICK_TOL) {
      out.push(`${p.name} is ${t.toFixed(2)}" thick, not a whole number of ${T}" ${name} layers`);
      continue;
    }
    if (k >= 2 && plan) {
      const fam = family(p);
      const said = new RegExp(`\\b${fam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: ${k} layers\\b`, "i").test(glue);
      const row = plan.cutList.find((c) => c.name.toLowerCase() === fam.toLowerCase() || c.name.toLowerCase() === fam.replace(/^(?:left|right|front|back|top|bottom) /i, "").toLowerCase());
      const noted = row ? new RegExp(`Glue up ${k} layers`).test(row.notes ?? "") : true;
      if (!said || !noted) out.push(`${p.name} is ${k} layers of ${name} but ${!said ? "no glue-up step says so" : "its cut-list row doesn't say so"}`);
    }
  }
  return out;
}
