import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import { namedStockDisplayName } from "@/lib/yard/weekendStockHonesty";
import { honestNestSheetStockName } from "@/lib/yard/report";
import { isWireStock } from "@/lib/yard/promptHelpers";

/** The material name shown on the bar and at the top of the menu (same words as the HUD card). */
export function useStockLabel(): { label: string; wire: boolean } {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  const material = getCatalogItem(project.primaryMaterialId);
  const wire = isWireStock(material);
  const nest = honestNestSheetStockName(project, plan);
  const named = namedStockDisplayName(project.prompt ?? "", material);
  const label = wire ? "Choose stock" : nest ? nest : named !== "stock" ? named : material?.name ?? "No stock";
  return { label, wire };
}
