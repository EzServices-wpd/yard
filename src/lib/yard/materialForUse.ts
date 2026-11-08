/**
 * C16 (material for use). What a build touches decides its stock:
 * - food, skin and nest contact (a bird feeder holds seed, a hive holds honey, a sandbox or seat holds a child, a
 *   birdhouse holds a nest) is never pressure-treated: it is untreated, rot-resistant cedar;
 * - an outdoor build has no interior sheet goods: interior plywood becomes BC exterior-glue plywood.
 * Prices come from checked listings only (checkedStock.ts). A species the person typed is kept as typed.
 */
import type { BomLine, YardProject } from "./types";
import { CEDAR, EXTERIOR_PLY, checkedOffer, type Checked } from "./checkedStock";
import { getCatalogItem } from "./catalog";

/** Builds that hold food, a child, a sitter or a nest. */
export const CONTACT =
  /\b(?:bird\s*feeders?|feeders?|bird\s*baths?|bee\s*hives?|beehives?|hive\s+box(?:es)?|sand\s*box(?:es)?|play\s*(?:house|set|ground)s?|bird\s*houses?|birdhouses?|nest(?:ing)?\s+box(?:es)?|bat\s+houses?|wren\s+houses?|bluebird\s+houses?|cutting\s+boards?|serving\s+trays?)\b/i;

/** True when the build touches food, skin or a nest. */
export function contactBuild(project: Pick<YardProject, "name" | "prompt" | "typedPrompt">): boolean {
  return CONTACT.test(`${project.typedPrompt ?? project.prompt ?? ""} ${project.name}`);
}

/** Why the stock was chosen, said once on the row. */
export const CEDAR_WHY = "Untreated cedar: it touches food, skin or a nest, so no pressure-treated wood; cedar is naturally rot-resistant outdoors.";
const PLY_WHY = "BC exterior-glue plywood: an outdoor build has no interior sheet goods.";

/** Interior sheet rows (plain plywood, MDF, hardboard). Exterior, CDX, BC and pressure-treated sheets are fine. */
export const interiorSheet = (b: Pick<BomLine, "name" | "catalogId">) =>
  (/^plywood-/.test(b.catalogId ?? "") || /\bplywood\b|\bmdf\b|hardboard/i.test(b.name)) && !/exterior|\bcdx\b|\bbc\b|pressure|marine|\bacx\b/i.test(b.name);

function swapRow(b: BomLine, c: Checked, why: string): BomLine {
  const { offers, lineTotal } = checkedOffer(c, b.quantity);
  const olds = [b.name, getCatalogItem(b.catalogId ?? "")?.name].filter((n): n is string => !!n);
  const said = olds.reduce((t, n) => t.split(n).join(c.name), (b.notes ?? "").replace(/\s*Pressure-treated for outdoors[^.]*\.[^.]*\./, ""));
  return { ...b, name: c.name, searchQuery: undefined, asin: undefined, estimatedCost: lineTotal, offers, notes: `${said} ${why}`.trim() };
}

/** The rows to swap for this build, with the name each had: cedar for contact, exterior plywood outdoors. */
export function materialSwaps(project: YardProject, bom: BomLine[], outdoor: boolean, typedSpecies: string | null): { bom: BomLine[]; renamed: [string, string][] } {
  const contact = outdoor && contactBuild(project) && !typedSpecies;
  const renamed: [string, string][] = [];
  const out = bom.map((b) => {
    const id = b.catalogId ?? "";
    if (contact && CEDAR[id] && !/\b(?:walnut|oak|maple|cherry|redwood|cypress|teak|pine)\b/i.test(b.name)) {
      renamed.push([b.name, CEDAR[id].name]);
      return swapRow(b, CEDAR[id], CEDAR_WHY);
    }
    if (outdoor && EXTERIOR_PLY[id] && interiorSheet(b)) {
      renamed.push([b.name, EXTERIOR_PLY[id].name]);
      return swapRow(b, EXTERIOR_PLY[id], PLY_WHY);
    }
    return b;
  });
  return { bom: out, renamed };
}
