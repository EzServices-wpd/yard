/**
 * UX Batch B (#38): every cut-list row and every sheet-layout piece names the 3D parts it covers, by the same ids the
 * model and planOverviewSvg use (`<g data-part="…">`, i.e. Panel.id / instance id). Additive only: no text, PDF or
 * canary reads these fields.
 */
import { partLetters } from "./pdfDraw";
import { cutListName } from "./shopPlural";
import type { NestResult, PlacedPart } from "./nesting";
import type { BuildPlan, CutLine, YardProject } from "./types";

const dims3 = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => y - x);
const near = (k: number[], m: number[], tol = 0.07) => k.every((v, i) => Math.abs(v - m[i]) < tol);
const base = (name: string) => name.toLowerCase().replace(/\s*·.*$/, "").replace(/\s+\d+$/, "").replace(/s$/, "").trim();

/**
 * The model part ids each cut-list row covers. Starts from the PDF's own letter match (partLetters), then fills any
 * row still short of its quantity from unclaimed parts of the same family or the same cut size, and gives strip rows
 * ("Wall panel A · right") the panel they are ripped from. Stick and dowel members go to the row of their stock whose
 * cut length is nearest, one member per piece.
 */
export function cutRowPartIds(project: YardProject, cutList: CutLine[]): Map<CutLine, string[]> {
  const letters = partLetters(project, cutList);
  const out = new Map<CutLine, string[]>(cutList.map((c) => [c, []]));
  const claimed = new Set<string>();
  const panels = project.panels ?? [];
  for (const c of cutList) {
    if (!c.label) continue;
    for (const p of panels) if (letters.get(p.id) === c.label) { out.get(c)!.push(p.id); claimed.add(p.id); }
  }
  const pdims = (p: (typeof panels)[number]) => (p.blank ? dims3(p.blank.lengthIn, p.blank.widthIn, p.blank.thicknessIn) : dims3(p.size.width, p.size.height, p.size.depth));
  for (const c of cutList) {
    const ids = out.get(c)!;
    const want = Math.max(1, Math.floor(c.quantity));
    const key = dims3(c.lengthIn, c.widthIn, c.thicknessIn);
    const fam = base(c.name);
    // Strip rows: the panel they are ripped from (it may also own its first strip's row).
    const famOf = (p: (typeof panels)[number]) => [base(p.name), base(cutListName(p.name, p.type))];
    if (/·/.test(c.name) && !ids.length) for (const p of panels) if (famOf(p).includes(fam)) ids.push(p.id);
    for (const p of panels) {
      if (ids.length >= want) break;
      if (claimed.has(p.id) || p.type === "drawer") continue;
      const same = near(pdims(p), key);
      if (same || (base(cutListName(p.name, p.type)) === fam && near(pdims(p).slice(2), key.slice(2), 0.2))) { ids.push(p.id); claimed.add(p.id); }
    }
  }
  // Rows still empty: drawer-box rows are cut for the drawers; spliced or laminated rows for the parts of their family.
  for (const c of cutList) {
    const ids = out.get(c)!;
    if (ids.length) continue;
    if (/^drawer (?:side|back|bottom|front)/i.test(c.name)) { for (const p of panels) if (p.type === "drawer") ids.push(p.id); continue; }
    const fam = base(c.name);
    for (const p of panels) if (p.type !== "drawer" && (base(p.name) === fam || base(cutListName(p.name, p.type)) === fam)) { ids.push(p.id); claimed.add(p.id); }
  }
  // Instances (sticks, dowels, lumber members): nearest cut length within the row's stock.
  const inst = [...(project.instances ?? [])].filter((i) => !claimed.has(i.id));
  for (const c of cutList) {
    const ids = out.get(c)!;
    const stock = c.id.split("|")[0];
    const want = Math.max(1, Math.floor(c.quantity)) - ids.length;
    if (want <= 0) continue;
    const pool = inst.filter((i) => !claimed.has(i.id) && (i.catalogId === stock || !c.id.includes("|")));
    pool.sort((a, b) => Math.abs((a.cutLength ?? c.lengthIn) - c.lengthIn) - Math.abs((b.cutLength ?? c.lengthIn) - c.lengthIn));
    for (const i of pool.slice(0, want)) { ids.push(i.id); claimed.add(i.id); }
  }
  return out;
}

function piecesWithIds(nest: NestResult | null, rows: CutLine[]): NestResult | null {
  if (!nest) return nest;
  const withIds = (p: PlacedPart): PlacedPart => {
    const row = rows.find((r) => p.id.startsWith(`${r.id || r.label || "p"}-`)) ?? rows.find((r) => r.label && r.label === p.label);
    const ids = row?.partIds ?? [];
    const i = Number(p.id.slice(p.id.lastIndexOf("-") + 1));
    // One sheet piece per model part when the counts line up; otherwise the piece is cut for all of the row's parts.
    const one = Number.isInteger(i) && ids.length === Math.max(1, Math.floor(row?.quantity ?? 0)) ? ids[i] : undefined;
    return { ...p, partIds: one ? [one] : ids };
  };
  return { ...nest, sheets: nest.sheets.map((s) => ({ ...s, parts: s.parts.map(withIds) })) };
}

/** Adds partIds to every cut-list row and every sheet-layout piece. */
export function withPartIds(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!plan.cutList.length) return plan;
  const ids = cutRowPartIds(project, plan.cutList);
  const cutList = plan.cutList.map((c) => ({ ...c, partIds: ids.get(c) ?? [] }));
  const sheetNest = plan.sheetNest ? { sheets: piecesWithIds(plan.sheetNest.sheets, cutList), backer: piecesWithIds(plan.sheetNest.backer, cutList) } : plan.sheetNest;
  return { ...plan, cutList, ...(plan.sheetNest !== undefined ? { sheetNest } : {}) };
}
