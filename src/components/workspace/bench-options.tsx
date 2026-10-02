"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile } from "@/lib/yard/ghost";
import { hasOperableFaces, operateFaceKinds, operateFacesLabel } from "@/lib/yard/operateFaces";
import { pieceControls, promptNamingFace, promptNamingHooks, promptWithDrawers } from "@/lib/yard/face";
import { MeasureFields } from "./measure-overlay";
import { YardsMenu } from "./yards-menu";
import { useBenchToolsShown } from "./bench-tools";
import { useStockLabel } from "./use-stock-label";
import type { WorkMode } from "@/lib/yard/types";

/** The one toggle on the bar. Shows the chosen material under "Options" so nobody misses it. */
export function BenchOptionsToggle({
  open,
  onToggle,
  panelId,
  buttonRef,
}: {
  open: boolean;
  onToggle: () => void;
  panelId: string;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { label, wire } = useStockLabel();
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      aria-haspopup="true"
      aria-label={`Options. Material: ${label}`}
      data-yard-options-toggle
      className={`inline-flex h-11 max-w-[7.5rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-left sm:max-w-[15rem] ${
        open ? "border-fg/30 bg-elevated text-fg" : "border-border text-fg hover:border-fg/30"
      }`}
    >
      <SlidersHorizontal className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-xs font-medium sm:text-sm">Options</span>
        <span className={`truncate text-[10px] sm:text-[11px] ${wire ? "text-accent" : "text-muted"}`} data-yard-stock-label>
          {label}
        </span>
      </span>
      <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

/**
 * Everything that used to sit loose under the bar or on the bench: material, size, view, build
 * options, examples, saved yards, clear bench. Escape or a click outside closes it.
 */
export function BenchOptionsPanel({
  open,
  onClose,
  panelId,
  toggleRef,
  onStock,
  onMeasure,
}: {
  open: boolean;
  onClose: (focusToggle?: boolean) => void;
  panelId: string;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  onStock: () => void;
  onMeasure: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const project = useYard((s) => s.project);
  const explode = useYard((s) => s.explode);
  const setExplode = useYard((s) => s.setExplode);
  const facesOpen = useYard((s) => s.facesOpen);
  const setFacesOpen = useYard((s) => s.setFacesOpen);
  const camera = useYard((s) => s.camera);
  const setCamera = useYard((s) => s.setCamera);
  const workMode = useYard((s) => s.workMode);
  const setWorkMode = useYard((s) => s.setWorkMode);
  const detail = useYard((s) => s.detail);
  const setDetail = useYard((s) => s.setDetail);
  const buildScale = useYard((s) => s.buildScale);
  const setBuildScale = useYard((s) => s.setBuildScale);
  const cutMode = useYard((s) => s.cutMode);
  const setCutMode = useYard((s) => s.setCutMode);
  const showLoad = useYard((s) => s.showLoad);
  const setShowLoad = useYard((s) => s.setShowLoad);
  const showHistoric = useYard((s) => s.showHistoric);
  const setShowHistoric = useYard((s) => s.setShowHistoric);
  const measureOpen = useYard((s) => s.measureOpen);
  const setMeasureOpen = useYard((s) => s.setMeasureOpen);
  const reset = useYard((s) => s.reset);
  const plan = useYard((s) => s.plan);
  const { label: stockLabel, wire } = useStockLabel();
  const [toolsShown] = useBenchToolsShown();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t) || toggleRef.current?.contains(t)) return;
      onClose(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, toggleRef]);

  if (!open) return null;

  const housePath = project.kind === "closet" || project.kind === "opening" || Boolean(project.fitted);
  const built = project.panels.length > 0 || project.instances.length > 0;
  // Dock already has stock, size, see-inside, and open doors. Options keeps what the dock does not.
  const dockHasTools = built && workMode !== "walk" && toolsShown;
  const paperCraft = Boolean(project.flat && !project.flat.lifted);
  const sizeable = built && !paperCraft;
  const canWalk = Boolean(project.traverse) && !housePath;
  const stickModel = !housePath && (project.instances.some((i) => i.role === "skin") || project.instances.length > 40);
  const makerJob = !housePath && project.instances.length > 0;
  const showLoadBtn = !housePath && Boolean(project.traverse && project.traverse.kind !== "around");
  const historicOk = hasHistoricProfile(project.kind) || !!project.historic;
  const faceKinds = operateFaceKinds(project.panels);
  const hasFaces = hasOperableFaces(faceKinds);
  const sheetOnly = project.panels.length > 0 && project.instances.length === 0;
  const cutChoice = !housePath && (paperCraft || project.instances.length > 0 || sheetOnly);
  const wholeOn =
    paperCraft ||
    (!sheetOnly &&
      (cutMode === "whole" ||
        (cutMode === "auto" && project.instances.length > 0 && project.instances.every((i) => i.cutLength == null))));
  const pieces = plan?.totals.pieces;
  const face = pieceControls(project);
  const showFace = face.headboard || face.fronts || face.base;
  const rebuild = (nextPrompt: string) => {
    if (nextPrompt.trim() === project.prompt.trim()) return;
    const api = useYard.getState();
    const materialId = project.primaryMaterialId;
    const spine = project.supportOffer?.included;
    api.beginBuild();
    window.setTimeout(() => {
      try {
        api.generate(nextPrompt, materialId, undefined, { includeSpine: spine, fresh: true });
        api.makePlan();
      } finally {
        api.revealBench();
      }
    }, 48);
  };
  const modes: { id: WorkMode; label: string }[] = [
    { id: "look", label: "Look" },
    ...(canWalk ? [{ id: "walk" as const, label: "Walk" }] : []),
    { id: "free", label: "Free" },
  ];

  return (
    <div
      ref={panelRef}
      id={panelId}
      role="region"
      aria-label="Bench options"
      tabIndex={-1}
      data-yard-options-panel
      className="absolute inset-x-2 top-full z-40 mt-1 max-h-[calc(100dvh-8.5rem)] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface p-3 text-sm shadow-xl outline-none sm:left-auto sm:right-4 sm:w-[26rem]"
    >
      {!dockHasTools && (
      <Section id="material" title="Material">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0">
            <span className={`block truncate ${wire ? "text-accent" : "text-fg"}`}>{wire ? "No real stock yet" : stockLabel}</span>
            {pieces ? <span className="block text-xs text-muted">{pieces} pieces</span> : null}
          </p>
          <button
            type="button"
            data-yard-stock
            onClick={() => {
              onStock();
              onClose(false);
            }}
            className="shrink-0 rounded-md border border-border px-3 py-2 text-xs text-fg hover:bg-elevated"
          >
            Choose stock
          </button>
        </div>
      </Section>
      )}

      {sizeable && built && !dockHasTools && (
        <Section id="size" title={project.pocket ? "The hole" : "Size"}>
          <MeasureFields />
          {(housePath || project.pocket) && (
            <button
              type="button"
              onClick={() => {
                onMeasure();
                onClose(false);
              }}
              className="mt-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              {project.pocket ? "The hole and the shelves" : "Edit the size"}
            </button>
          )}
        </Section>
      )}

      {built && (
        <Section id="view" title="View">
          <div className="flex flex-wrap gap-1.5">
            {!dockHasTools && <Toggle on={explode} onClick={() => setExplode(!explode)} label="See inside" />}
            {!dockHasTools && hasFaces && (
              <Toggle on={facesOpen} onClick={() => setFacesOpen(!facesOpen)} label={operateFacesLabel(facesOpen, faceKinds)} plain />
            )}
            {(housePath || project.pocket) && <Toggle on={measureOpen} onClick={() => setMeasureOpen(!measureOpen)} label="Opening outline" />}
            {historicOk && !housePath && <Toggle on={showHistoric} onClick={() => setShowHistoric(!showHistoric)} label="Form" />}
            {showLoadBtn && <Toggle on={showLoad} onClick={() => setShowLoad(!showLoad)} label="Load" />}
          </div>
          {!housePath && (
            <Row label="Move">
              <Seg items={modes.map((m) => ({ id: m.id, label: m.label }))} value={workMode} onChange={(v) => setWorkMode(v as WorkMode)} />
            </Row>
          )}
          <Row label="Camera">
            <Seg
              items={(["iso", "front", "side", "top"] as const).map((c) => ({ id: c, label: c === "iso" ? "3/4" : c[0].toUpperCase() + c.slice(1) }))}
              value={camera}
              onChange={(v) => setCamera(v as typeof camera)}
            />
          </Row>
          {stickModel && (
            <Row label="Detail">
              <Seg
                items={[
                  { id: "frame", label: "Frame" },
                  { id: "full", label: "Full" },
                  { id: "fill", label: "Fill" },
                ]}
                value={detail}
                onChange={(v) => setDetail(v as typeof detail)}
              />
            </Row>
          )}
        </Section>
      )}

      {built && (showFace || face.drawers != null || face.hooks) && (
        <Section id="face" title={showFace ? "Face" : face.drawers != null ? "Drawers" : "Hooks"}>
          {face.hooks && (
            <Row label="Hooks">
              <Seg
                items={[
                  { id: "adult", label: "Adult" },
                  { id: "kids", label: "Kids" },
                  { id: "both", label: "Both" },
                ]}
                value={face.hooks}
                onChange={(v) => rebuild(promptNamingHooks(project.prompt, v as NonNullable<typeof face.hooks>))}
              />
            </Row>
          )}
          {face.drawers != null && (
            <Row label="Drawers">
              <div className="flex overflow-hidden rounded-md border border-border text-xs" role="group" aria-label="Drawers">
                <button
                  type="button"
                  data-yard-drawers="less"
                  disabled={face.drawers <= 0}
                  aria-label="Remove a drawer"
                  onClick={() => rebuild(promptWithDrawers(project.prompt, face.drawers! - 1))}
                  className="h-9 min-w-11 text-muted hover:text-fg disabled:opacity-30"
                >
                  −
                </button>
                <span className="flex h-9 min-w-8 items-center justify-center text-fg" data-yard-drawer-count>
                  {face.drawers}
                </span>
                <button
                  type="button"
                  data-yard-drawers="more"
                  disabled={face.drawers >= 8}
                  aria-label="Add a drawer"
                  onClick={() => rebuild(promptWithDrawers(project.prompt, face.drawers! + 1))}
                  className="h-9 min-w-11 text-muted hover:text-fg disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </Row>
          )}
          {face.headboard && (
            <Row label="Headboard">
              <Seg
                items={[
                  { id: "plain", label: "Plain" },
                  { id: "slats", label: "Slats" },
                  { id: "framed", label: "Framed" },
                ]}
                value={face.headboardMode}
                onChange={(v) => rebuild(promptNamingFace(project.prompt, { headboard: v as typeof face.headboardMode }))}
              />
            </Row>
          )}
          {face.fronts && (
            <Row label="Front">
              <Seg
                items={[
                  { id: "flat", label: "Flat" },
                  { id: "shaker", label: "Shaker" },
                ]}
                value={face.frontMode}
                onChange={(v) => rebuild(promptNamingFace(project.prompt, { fronts: v as "flat" | "shaker" }))}
              />
            </Row>
          )}
          {face.base && (
            <Row label="Base">
              <Seg
                items={[
                  { id: "none", label: "None" },
                  { id: "molding", label: "Strip" },
                ]}
                value={face.baseMode}
                onChange={(v) => rebuild(promptNamingFace(project.prompt, { base: v as "none" | "molding" }))}
              />
            </Row>
          )}
        </Section>
      )}

      {built && (makerJob || cutChoice) && (
        <Section id="build" title="Build">
          {makerJob && (
            <Row label="Scale">
              <Seg
                items={[
                  { id: "tabletop", label: "Tabletop" },
                  { id: "weekend", label: "Weekend" },
                  { id: "full", label: "Full" },
                ]}
                value={buildScale}
                onChange={(v) => setBuildScale(v as typeof buildScale)}
              />
            </Row>
          )}
          {cutChoice && (
            <Row label="Stock">
              <Seg
                items={[
                  { id: "cut", label: "Cut", disabled: paperCraft },
                  { id: "whole", label: "Don't cut", disabled: sheetOnly },
                ]}
                value={wholeOn ? "whole" : "cut"}
                onChange={(v) => setCutMode(v as "cut" | "whole")}
              />
            </Row>
          )}
        </Section>
      )}

      <Section id="saved" title="Saved yards">
        <YardsMenu inline onOpened={() => onClose(false)} />
      </Section>

      {built && (
        <div className="border-t border-border/70 pt-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose(true);
            }}
            className="text-xs text-faint hover:text-muted"
          >
            Clear bench
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const h = useId();
  return (
    <section data-yard-options-section={id} aria-labelledby={h} className="mb-3 border-b border-border/70 pb-3 last:mb-0 last:border-0 last:pb-0">
      <h3 id={h} className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, label, plain }: { on: boolean; onClick: () => void; label: string; plain?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={plain ? undefined : on}
      className={`rounded-md border px-3 py-2 text-xs ${on && !plain ? "border-fg/30 bg-elevated text-fg" : "border-border text-fg hover:bg-elevated"}`}
    >
      {label}
    </button>
  );
}

function Seg({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border text-xs" role="group">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          disabled={it.disabled}
          aria-pressed={value === it.id}
          onClick={() => onChange(it.id)}
          className={`h-9 min-w-11 px-2.5 disabled:opacity-30 ${value === it.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
