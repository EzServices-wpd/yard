import { useYard } from "@/lib/yard/store";
import { stockPillLabel } from "@/lib/yard/stockPill";

/** The material name shown on the bar and at the top of the menu (same words as the HUD card). */
export function useStockLabel(): { label: string; wire: boolean } {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  return stockPillLabel(project, plan);
}
