"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Ruler,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PromptBar } from "@/components/workspace/prompt-bar";
import { CatalogPanel } from "@/components/workspace/catalog-panel";
import { MeasurePanel } from "@/components/workspace/measure-panel";
import { PlanDrawer } from "@/components/workspace/plan-drawer";
import { ExportDialog } from "@/components/workspace/export-dialog";
import { WorkspaceCanvas } from "@/components/workspace/canvas";
import { LavaLamp } from "@/components/workspace/lava-lamp";
import { hydrateYard, useYard } from "@/lib/yard/store";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCatalogItem } from "@/lib/yard/catalog";
import { namedStockDisplayName } from "@/lib/yard/weekendStockHonesty";
import { honestNestSheetStockName } from "@/lib/yard/report";
import { woodCutPieceCount } from "@/lib/yard/shopPlural";
import { isWireStock } from "@/lib/yard/promptHelpers";
import { inches } from "@/lib/utils";
import { fmtUnitEnvelopeInches, openingStorageMeasureEmptyTalk } from "@/lib/yard/voiceHonesty";
import { modelProudTalk } from "@/lib/yard/modelSize";
import { isLockedForm } from "@/lib/yard/form";
import { detectWeekendMech } from "@/lib/yard/weekendFamily";
import { runYardPrompt } from "@/components/workspace/run-prompt";
import { loadIssues } from "@/lib/yard/function";
import { holdWalkKey } from "@/components/workspace/walk-rig";

export function WorkspaceApp({ initialPrompt }: { initialPrompt?: string }) {
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState<"catalog" | "measure" | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, isPending } = useCurrentUserState();
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const undo = useYard((s) => s.undo);
  const redo = useYard((s) => s.redo);
  const deleteSelected = useYard((s) => s.deleteSelected);
  const selectedId = useYard((s) => s.selectedId);
  const history = useYard((s) => s.history);
  const future = useYard((s) => s.future);
  const workMode = useYard((s) => s.workMode);
  const setWorkMode = useYard((s) => s.setWorkMode);
  const detail = useYard((s) => s.detail);
  const buildScale = useYard((s) => s.buildScale);
  const showLoad = useYard((s) => s.showLoad);
  const showHull = useYard((s) => s.showHull);
  const showHistoric = useYard((s) => s.showHistoric);
  const setShowHull = useYard((s) => s.setShowHull);
  const toggleLockSelected = useYard((s) => s.toggleLockSelected);
  const lockedIds = useYard((s) => s.lockedIds);
  const plan = useYard((s) => s.plan);
  const grokBusy = useYard((s) => s.grokBusy);
  const building = useYard((s) => s.building);
  const revealBench = useYard((s) => s.revealBench);
  const activeStep = useYard((s) => s.activeStep);
  const setActiveStep = useYard((s) => s.setActiveStep);
  const setMeasureOpen = useYard((s) => s.setMeasureOpen);
  const setMeasure = useYard((s) => s.setMeasure);
  const pending = building || grokBusy || (Boolean(initialPrompt?.trim()) && !ready);

  useEffect(() => {
    const fromUrl =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") : null;
    const prompt = (initialPrompt || fromUrl || "").trim();
    if (prompt) {
      void (async () => {
        try {
          await runYardPrompt(prompt, { fresh: true });
        } catch (err) {
          useYard.setState({
            grokError: err instanceof Error ? err.message : "Could not generate that structure.",
          });
        } finally {
          setReady(true);
        }
      })();
      return;
    }
    hydrateYard();
    setReady(true);
  }, [initialPrompt, generate, makePlan, revealBench]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  useEffect(() => {
    const house = project.kind === "closet" || project.kind === "opening" || Boolean(project.pocket) || Boolean(project.fitted);
    setMeasureOpen(house);
    if (!house && project.overall.width > 1 && project.overall.height > 1) {
      const n = (v: number) => String(Math.round(v * 10) / 10);
      setMeasure({ width: n(project.overall.width), height: n(project.overall.height), depth: n(project.overall.depth) });
    }
    // Unit is the hero. Do not steal the bench with the measure sidebar.
    // Measure button still opens the full card (pocket walls, kind, example pocket).
    setSide(null);
  }, [project.id, setMeasureOpen, setMeasure, project.kind, project.pocket, project.fitted, project.overall.width, project.overall.height, project.overall.depth]);

  useEffect(() => {
    if (workMode === "build") setWorkMode("look");
    const house = project.kind === "closet" || project.kind === "opening" || Boolean(project.fitted);
    if (house && workMode !== "look") setWorkMode("look");
    else if (workMode === "walk" && !project.traverse) setWorkMode("look");
  }, [workMode, setWorkMode, project.traverse, project.kind, project.fitted]);

  const housePath = project.kind === "closet" || project.kind === "opening" || Boolean(project.fitted);
  const material = getCatalogItem(project.primaryMaterialId);
  const stockLabel = namedStockDisplayName(project.prompt ?? "", material);
  // Sheet-chip honesty: nest/Buy 4×10 must surface on the HUD chip (not stuck primary 4×8).
  const nestSheetLabel = honestNestSheetStockName(project, plan);
  const wire = isWireStock(material);
  const paperCraft = Boolean(project.flat && !project.flat.lifted);
  // Soft leftover: drawer furniture HUD chip counted bounding type=drawer envelopes
  // (carcase + box + front) while cut list explodes each box → sides/back/bottom.
  // Prefer plan.totals.pieces when built (includes splice); else woodCutPieceCount
  // (instances + exploded panels + laminated plies). Buy-only hardware stays BOM.
  const pieceCount = plan?.totals.pieces ?? woodCutPieceCount(project);
  const locked = selectedId ? lockedIds.includes(selectedId) : false;
  const steps = plan?.instructions ?? [];
  const stepIndex = steps.findIndex((s) => s.step === activeStep);
  const showLoadBtn = !housePath && Boolean(project.traverse && project.traverse.kind !== "around");
  const loadNote = showLoadBtn ? loadIssues(project) : [];

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-2 sm:h-14 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <span className="hidden truncate text-sm text-muted md:inline">{project.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSide((s) => (s === "measure" ? null : "measure"))}
            className={`inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-xs sm:h-8 ${
              side === "measure" ? "bg-elevated text-fg" : "text-muted hover:text-fg"
            }`}
          >
            <Ruler className="size-4" />
            <span>Measure</span>
          </button>
          <button
            type="button"
            onClick={() => {
              makePlan();
              setPlanOpen(true);
            }}
            className="inline-flex h-11 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg sm:h-9"
          >
            Get the plan
          </button>
          <button
            type="button"
            onClick={() => {
              makePlan();
              setExportOpen(true);
            }}
            className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm text-fg sm:h-9"
          >
            Print
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="More tools"
              onClick={() => setMoreOpen((v) => !v)}
              className="grid size-11 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg sm:size-8"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-40 mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-lg">
                <MoreItem
                  label="Undo"
                  disabled={!history.length}
                  onClick={() => {
                    undo();
                    setMoreOpen(false);
                  }}
                />
                <MoreItem
                  label="Redo"
                  disabled={!future.length}
                  onClick={() => {
                    redo();
                    setMoreOpen(false);
                  }}
                />
                {!housePath && (
                  <>
                    <MoreItem
                      label="Delete piece"
                      disabled={!selectedId}
                      onClick={() => {
                        deleteSelected();
                        setMoreOpen(false);
                      }}
                    />
                    <MoreItem
                      label={locked ? "Unlock piece" : "Lock piece"}
                      disabled={!selectedId}
                      onClick={() => {
                        toggleLockSelected();
                        setMoreOpen(false);
                      }}
                    />
                  </>
                )}
                <div className="my-1 border-t border-border/70" />
                {(
                  [
                    ["/gallery", "Gallery"],
                    ["/about", "About"],
                    ["/privacy", "Privacy"],
                  ] as const
                ).map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    className="block rounded-sm px-3 py-2.5 text-sm text-muted hover:bg-elevated hover:text-fg"
                    onClick={() => setMoreOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
                {authEnabled && !user && !isPending && (
                  <Link to="/login" className="block rounded-sm px-3 py-2.5 text-sm text-muted hover:bg-elevated hover:text-fg" onClick={() => setMoreOpen(false)}>
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
          {authEnabled && user ? (
            <SignedIn>
              <UserButton />
            </SignedIn>
          ) : null}
        </div>
      </header>

      <PromptBar
        onBuilt={() => setPlanOpen(false)}
        onStock={() => setSide("catalog")}
        onMeasure={() => setSide("measure")}
      />

      <div className="relative flex min-h-0 flex-1">
        {side && (
          <>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setSide(null)}
              className="absolute inset-0 z-10 bg-bg/50 md:hidden"
            />
            <aside className="absolute inset-y-0 left-0 z-20 w-[min(20rem,92vw)] overflow-y-auto border-r border-border bg-surface md:static md:w-80 md:shrink-0">
              {side === "catalog" ? <CatalogPanel /> : <MeasurePanel onBuilt={() => setPlanOpen(false)} />}
            </aside>
          </>
        )}

        <div className="relative min-w-0 flex-1" data-bench-host>
          <WorkspaceCanvas />
          {pending && <LavaLamp caption={grokBusy ? "Fitting the opening" : "Building"} />}
          {project.supportOffer?.needed && !project.supportOffer.included && !activeStep && !pending && (
            <div
              data-bench-overlay="offer"
              className={`absolute left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs text-fg shadow-lg ${
                grokBusy ? "top-14" : "top-4"
              }`}
            >
              <span className="min-w-0 leading-snug">{project.supportOffer.reason}</span>
              <button
                type="button"
                className="shrink-0 rounded-sm bg-accent px-2 py-1 font-medium text-accent-fg"
                onClick={() => {
                  generate(project.prompt, project.primaryMaterialId, undefined, { includeSpine: true });
                  makePlan();
                  revealBench();
                }}
              >
                Add spine
              </button>
            </div>
          )}
          {activeStep != null && steps.length > 0 && (
            <div
              className="absolute left-1/2 top-3 z-20 w-[min(32rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-md border border-border bg-surface/95 px-3 py-2 shadow-lg sm:top-4 sm:px-4 sm:py-3"
              data-yard-step-view={activeStep}
              data-bench-overlay="step-card"
            >
              <p className="font-mono text-[11px] text-faint">
                Viewing step {String(activeStep).padStart(2, "0")} of {String(steps.length).padStart(2, "0")}
              </p>
              <p className="mt-0.5 font-medium text-fg">
                {steps.find((s) => s.step === activeStep)?.title}
              </p>
              <p className="mt-1 max-h-28 overflow-y-auto text-xs leading-relaxed text-muted">
                {steps.find((s) => s.step === activeStep)?.description}
              </p>
              <p className="mt-1 text-[11px] text-faint sm:mt-2">
                Lit pieces are this step.
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
                onClick={() => setActiveStep(null)}
              >
                Exit step view
              </button>
            </div>
          )}
          {ready && pieceCount === 0 && !side && !pending && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <div className="max-w-sm text-center">
                <p className="font-display text-2xl text-fg">Empty bench</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Type a dream above. Every piece Yard places is something you can actually buy.
                </p>
              </div>
            </div>
          )}

          {showLoad && showLoadBtn && !pending && (
            <div
              data-yard-load-panel="1"
              data-bench-overlay="load"
              className="absolute left-3 top-3 z-20 w-[min(18rem,calc(100%-1.5rem))] rounded-md border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg sm:left-4"
            >
              <p className="font-medium text-fg">
                {project.assumptions.use === "person"
                  ? "Person load"
                  : project.assumptions.use === "toy"
                    ? "Toy load"
                    : "Display load"}
              </p>
              <ul className="mt-1 space-y-1 text-muted">
                {loadNote.map((issue, i) => (
                  <li key={i}>
                    {issue.message}
                    {issue.suggestion ? ` ${issue.suggestion}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {workMode === "walk" && !pending && (
            <>
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <div className="relative size-4">
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-fg/70" />
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-fg/70" />
                </div>
              </div>
              <p
                data-yard-walk-hint="1"
                className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur"
              >
                Click the bench · WASD · look up
              </p>
              <div className="pointer-events-auto absolute bottom-20 right-3 z-20 grid grid-cols-3 gap-1 sm:bottom-24 sm:right-4">
                <span />
                <WalkKey code="KeyW" label="W" />
                <span />
                <WalkKey code="KeyA" label="A" />
                <WalkKey code="KeyS" label="S" />
                <WalkKey code="KeyD" label="D" />
              </div>
            </>
          )}

          {/* Bottom cards: on phones the step pill stacks above the size card instead of covering it. */}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 text-xs text-muted sm:block">
            {steps.length > 0 && !pending && (
              <div className="pointer-events-none z-10 flex justify-center sm:absolute sm:inset-x-0 sm:bottom-16 sm:px-3">
                <div data-bench-overlay="step-pill" className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-md border border-border bg-surface/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-muted hover:text-fg disabled:opacity-30 sm:size-8"
                    disabled={!steps.length}
                    onClick={() => {
                      const i = stepIndex < 0 ? 0 : Math.max(0, stepIndex - 1);
                      setActiveStep(steps[i].step);
                    }}
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanOpen(true)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-mono text-faint">
                      {activeStep ? String(activeStep).padStart(2, "0") : "—"} / {String(steps.length).padStart(2, "0")}
                    </span>
                    <span className="ml-2 truncate text-fg">
                      {activeStep
                        ? steps.find((s) => s.step === activeStep)?.title
                        : "Step through the build"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="grid size-8 place-items-center text-muted hover:text-fg"
                    onClick={() => {
                      const i = stepIndex < 0 ? 0 : Math.min(steps.length - 1, stepIndex + 1);
                      setActiveStep(steps[i].step);
                    }}
                    aria-label="Next step"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div
                data-yard-house={housePath ? "1" : "0"}
                data-yard-pieces={pieceCount}
                data-yard-kind={project.kind}
                data-yard-mode={workMode}
                data-yard-hull={showHull ? "1" : "0"}
                data-yard-joints={project.buildStats?.joints ?? 0}
                data-yard-loose={project.buildStats?.loose ?? 0}
                data-yard-components={project.buildStats?.components ?? 0}
                data-yard-form={showHistoric ? "1" : "0"}
                data-yard-detail={detail}
                data-yard-scale={buildScale}
                data-yard-join={project.joinMethod ?? material?.preferredJoins?.[0] ?? ""}
                data-yard-traverse={project.traverse?.kind ?? ""}
                data-yard-load={project.assumptions.use ?? ""}
                data-yard-deck={project.panels.some((p) => p.type === "deck") ? "1" : "0"}
                data-yard-wire={wire ? "1" : "0"}
                data-yard-flat={paperCraft ? "1" : "0"}
                data-bench-overlay="hud"
                className="pointer-events-auto rounded-md border border-border bg-surface/90 px-3 py-2 backdrop-blur"
              >
                <p>
                  {wire
                    ? "Choose stock · Options, then Material"
                    : nestSheetLabel
                      ? nestSheetLabel
                      : stockLabel !== "stock"
                        ? stockLabel
                        : material?.name ?? "No stock"}
                  {pieceCount
                    ? paperCraft
                      ? ` · ${pieceCount} whole sticks · glue ends`
                      : ` · ${pieceCount} pieces`
                    : ""}
                </p>
                <p className="mt-0.5 text-faint">
                  {(() => {
                    const envelope = fmtUnitEnvelopeInches(project.overall.width, project.overall.height, project.overall.depth, {
                      shape: project.fitted?.unit?.shape,
                      prompt: project.prompt,
                      name: project.name,
                      legs: project.fitted?.unit?.legs,
                    });
                    const emptyTalk = openingStorageMeasureEmptyTalk(project.prompt);
                    // Bare opening-storage HUD: keep dash honesty; companion must not say "the unit".
                    const companion = emptyTalk
                      ? emptyTalk.hudCompanion
                      : housePath
                        ? " · the unit"
                        : wire
                          ? " · Skeleton only — pick a real material to densify"
                          : workMode === "look"
                            ? (() => {
                                const mech = detectWeekendMech(project.prompt ?? "");
                                // Launcher / media-hold / climb / pot-hold (stand): dims are the envelope, not Orbit chrome.
                                return (
                                  mech === "launcher" ||
                                  mech === "media-hold" ||
                                  mech === "climb" ||
                                  mech === "pot-hold"
                                )
                                  ? ""
                                  : " · Orbit";
                              })()
                            : workMode === "walk"
                              ? " · On the road"
                              : workMode === "build"
                                ? " · Snap to the glow"
                                : " · Drag · snap home";
                    return (
                      <>
                        {envelope}
                        {(() => {
                          // Same model-derived depth as the PDF cover: doors / drawer fronts proud of the box.
                          const proud = modelProudTalk(project.panels, project.overall.depth);
                          return proud ? ` · ${proud}` : "";
                        })()}
                        {companion}
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlanDrawer open={planOpen} onClose={() => setPlanOpen(false)} />
      {exportOpen && plan && (
        <ExportDialog project={project} plan={plan} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}

function MoreItem({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full rounded-sm px-3 py-2.5 text-left text-sm text-fg hover:bg-elevated disabled:opacity-30"
    >
      {label}
    </button>
  );
}

function WalkKey({ code, label }: { code: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-11 place-items-center rounded-md border border-border bg-surface/90 text-xs font-medium text-fg backdrop-blur sm:size-11"
      onPointerDown={(e) => {
        e.preventDefault();
        holdWalkKey(code, true);
      }}
      onPointerUp={() => holdWalkKey(code, false)}
      onPointerCancel={() => holdWalkKey(code, false)}
      onPointerLeave={() => holdWalkKey(code, false)}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-sm text-muted hover:bg-elevated hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}
