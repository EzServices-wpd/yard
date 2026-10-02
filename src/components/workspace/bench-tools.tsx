"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, DoorClosed, DoorOpen, Eye, Layers, PanelTopOpen, Rotate3d, RotateCcw, Ruler, SlidersHorizontal } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { hasOperableFaces, operateFaceKinds, operateFacesLabel } from "@/lib/yard/operateFaces";
import { useStockLabel } from "./use-stock-label";

const PREF_KEY = "yard.benchTools";

/** Shown / hidden, remembered on this device. Defaults to shown. */
export function useBenchToolsShown(): [boolean, (v: boolean) => void] {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PREF_KEY) === "hidden") setShown(false);
    } catch {
      /* private mode: keep the default */
    }
  }, []);
  const set = (v: boolean) => {
    setShown(v);
    try {
      window.localStorage.setItem(PREF_KEY, v ? "shown" : "hidden");
    } catch {
      /* ignore */
    }
  };
  return [shown, set];
}

const CAMERA_ORDER = ["iso", "front", "side", "top"] as const;
const CAMERA_NAME: Record<(typeof CAMERA_ORDER)[number], string> = { iso: "3/4", front: "Front", side: "Side", top: "Top" };

/**
 * Quick tools that sit right on the bench: stock, see inside, open doors/drawers/lids, measure and
 * camera. Same store/state as the Options menu — this is a shortcut row, not a second copy.
 */
export function BenchTools({
  side,
  onStock,
  onMeasure,
  bare = false,
}: {
  side: "catalog" | "measure" | null;
  onStock: () => void;
  onMeasure: () => void;
  /** Sit inside the bench dock, with no card of its own. */
  bare?: boolean;
}) {
  const project = useYard((s) => s.project);
  const explode = useYard((s) => s.explode);
  const setExplode = useYard((s) => s.setExplode);
  const facesOpen = useYard((s) => s.facesOpen);
  const setFacesOpen = useYard((s) => s.setFacesOpen);
  const camera = useYard((s) => s.camera);
  const setCamera = useYard((s) => s.setCamera);
  const orbited = useYard((s) => s.orbited);
  const resetView = useYard((s) => s.resetView);
  const { label: stockLabel, wire } = useStockLabel();
  const [shown, setShown] = useBenchToolsShown();

  const faceKinds = operateFaceKinds(project.panels);
  const hasFaces = hasOperableFaces(faceKinds);
  const operateLabel = operateFacesLabel(facesOpen, faceKinds);
  const doorsOnly = faceKinds.doors > 0 && faceKinds.drawers === 0 && faceKinds.lids === 0;
  const camIdx = Math.max(0, CAMERA_ORDER.indexOf(camera));
  const nextCam = CAMERA_ORDER[(camIdx + 1) % CAMERA_ORDER.length];
  const built = project.panels.length > 0 || project.instances.length > 0;
  const sizeLabel = project.pocket ? "The hole" : built ? "Size" : "Measure";

  if (!shown) {
    return (
      <div data-yard-bench-tools="hidden" className="pointer-events-none flex justify-end px-1.5 py-1">
        <button
          type="button"
          data-bench-overlay="tools"
          data-yard-tools-show
          onClick={() => setShown(true)}
          aria-label="Show quick tools"
          title="Show quick tools"
          aria-expanded={false}
          className={`pointer-events-auto grid place-items-center text-muted hover:text-fg ${
            bare ? "size-9" : "size-11 rounded-full border border-border bg-surface/95 shadow-lg backdrop-blur"
          }`}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div data-yard-bench-tools="shown" className="pointer-events-none flex justify-center">
      <div
        role="toolbar"
        aria-label="Quick tools"
        data-bench-overlay="tools"
        className={`pointer-events-auto flex max-w-full items-stretch gap-0.5 ${
          bare ? "w-full justify-center px-1 py-1" : "rounded-xl border border-border bg-surface/95 p-1 shadow-lg backdrop-blur sm:gap-1"
        }`}
      >
        <ToolBtn
          icon={<Layers className="size-4" aria-hidden />}
          label={wire ? "Pick stock" : "Stock"}
          ariaLabel={wire ? "Pick stock" : `Stock: ${stockLabel}. Choose stock`}
          title={wire ? "Pick a real stock" : `Stock: ${stockLabel}`}
          on={side === "catalog"}
          accent={wire}
          onClick={onStock}
          tool="stock"
        />
        <ToolBtn
          icon={<Eye className="size-4" aria-hidden />}
          label="See inside"
          on={explode}
          pressed={explode}
          onClick={() => setExplode(!explode)}
          tool="inside"
        />
        {hasFaces && (
          <ToolBtn
            icon={
              doorsOnly ? (
                facesOpen ? <DoorClosed className="size-4" aria-hidden /> : <DoorOpen className="size-4" aria-hidden />
              ) : (
                <PanelTopOpen className="size-4" aria-hidden />
              )
            }
            label={operateLabel}
            on={facesOpen}
            onClick={() => setFacesOpen(!facesOpen)}
            tool="operate"
          />
        )}
        <ToolBtn
          icon={<Ruler className="size-4" aria-hidden />}
          label={sizeLabel}
          ariaLabel={project.pocket ? "Edit the hole, how much of it, and the shelves" : "Edit the size"}
          title={project.pocket ? "The hole, the share, and the shelves" : "Edit wide, tall, and deep"}
          on={side === "measure"}
          onClick={onMeasure}
          tool="measure"
        />
        {orbited ? (
          <ToolBtn
            icon={<RotateCcw className="size-4" aria-hidden />}
            label="Reset view"
            ariaLabel={`Reset view to ${CAMERA_NAME[CAMERA_ORDER[camIdx]]}`}
            title="Frame the whole model again"
            onClick={() => resetView()}
            tool="view"
          />
        ) : (
          <ToolBtn
            icon={<Rotate3d className="size-4" aria-hidden />}
            label={`${CAMERA_NAME[CAMERA_ORDER[camIdx]]} view`}
            ariaLabel={`View: ${CAMERA_NAME[CAMERA_ORDER[camIdx]]}. Next: ${CAMERA_NAME[nextCam]}. Drag the model to turn it, pinch or scroll to zoom.`}
            title={`Next: ${CAMERA_NAME[nextCam]} view · drag to turn, pinch or scroll to zoom`}
            onClick={() => setCamera(nextCam)}
            tool="view"
          />
        )}
        <span aria-hidden className="mx-0.5 my-1.5 w-px bg-border" />
        <button
          type="button"
          data-yard-tools-hide
          onClick={() => setShown(false)}
          aria-label="Hide quick tools"
          title="Hide quick tools"
          aria-expanded
          className="grid min-h-11 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg sm:w-11"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  ariaLabel,
  title,
  on,
  pressed,
  accent,
  onClick,
  tool,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel?: string;
  title?: string;
  on?: boolean;
  pressed?: boolean;
  accent?: boolean;
  onClick: () => void;
  tool: string;
}) {
  return (
    <button
      type="button"
      data-yard-tool={tool}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      className={`flex min-h-11 min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-[10px] leading-tight sm:min-w-0 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-xs ${
        on ? "bg-elevated text-fg ring-1 ring-fg/25" : accent ? "text-accent hover:bg-elevated" : "text-muted hover:bg-elevated hover:text-fg"
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
