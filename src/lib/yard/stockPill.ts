import { getCatalogItem } from "./catalog";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { honestNestSheetStockName } from "./report";
import { isWireStock } from "./promptHelpers";
import type { YardProject } from "./types";

/** What the material pill says when nothing is cut or bought (a refused build). */
export const NOTHING_BUILT_STOCK = "Nothing built";

/**
 * The material pill names the stock the build is really cut from and bought: the nested sheet when that differs,
 * the stock the maker named, else the build's main stock. A refused build cuts and buys nothing, so it names no stock.
 */
export function stockPillLabel(project: YardProject, plan: Parameters<typeof honestNestSheetStockName>[1]): { label: string; wire: boolean } {
  if (project.refused && !project.panels.length) return { label: NOTHING_BUILT_STOCK, wire: false };
  const material = getCatalogItem(project.primaryMaterialId);
  const wire = isWireStock(material);
  const nest = honestNestSheetStockName(project, plan);
  const named = namedStockDisplayName(project.prompt ?? "", material);
  const label = project.displayOnly ? "Not learned yet" : wire ? "Choose stock" : nest ? nest : named !== "stock" ? named : material?.name ?? "No stock";
  return { label, wire };
}
