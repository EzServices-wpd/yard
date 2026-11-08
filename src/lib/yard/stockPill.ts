import { getCatalogItem } from "./catalog";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { honestNestSheetStockName } from "./report";
import { isWireStock } from "./promptHelpers";
import type { YardProject } from "./types";

/** What the material pill says when nothing is cut or bought (a refused build). */
export const NOTHING_BUILT_STOCK = "Nothing built";

/** A refusal: nothing was cut or bought, so there is no stock to choose and nothing to save. */
export const nothingBuilt = (project: Pick<YardProject, "refused" | "panels">): boolean => !!project.refused && !project.panels.length;

/**
 * The material pill names the stock the build is really cut from and bought: the nested sheet when that differs,
 * the stock the maker named, else the build's main stock. A refused build cuts and buys nothing, so it names no stock.
 */
export function stockPillLabel(project: YardProject, plan: Parameters<typeof honestNestSheetStockName>[1]): { label: string; wire: boolean; offersStock: boolean } {
  // A refusal offers no stock action (no "Choose stock", no picker): there is nothing to restock.
  if (nothingBuilt(project)) return { label: NOTHING_BUILT_STOCK, wire: false, offersStock: false };
  const material = getCatalogItem(project.primaryMaterialId);
  const wire = isWireStock(material);
  const nest = honestNestSheetStockName(project, plan);
  const named = namedStockDisplayName(project.prompt ?? "", material);
  const label = project.displayOnly ? "Not learned yet" : wire ? "Choose stock" : nest ? nest : named !== "stock" ? named : material?.name ?? "No stock";
  return { label, wire, offersStock: true };
}
