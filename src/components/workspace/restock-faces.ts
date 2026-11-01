import { hasOperableFaces, operateFaceKinds } from "@/lib/yard/operateFaces";
import { useYard } from "@/lib/yard/store";

/** A stock or thickness switch rebuilds the same piece, and generate() shuts every face on any build. So a restock
 * puts open doors / drawers / lids back open, but only when the new build still has some (never open with none). */
export function restockKeepingFaces(rebuild: () => void): void {
  const open = useYard.getState().facesOpen;
  rebuild();
  if (open && hasOperableFaces(operateFaceKinds(useYard.getState().project.panels))) useYard.getState().setFacesOpen(true);
}
