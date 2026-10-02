"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PromptBar } from "@/components/workspace/prompt-bar";
import { CatalogPanel } from "@/components/workspace/catalog-panel";
import { MeasurePanel } from "@/components/workspace/measure-panel";
import { PlanDrawer } from "@/components/workspace/plan-drawer";
import { ExportDialog } from "@/components/workspace/export-dialog";
import { WorkspaceCanvas } from "@/components/workspace/canvas";
import { LavaLamp } from "@/components/workspace/lava-lamp";
import { BenchTools } from "@/components/workspace/bench-tools";
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
import { inchFrac } from "@/lib/yard/inchText";
import { fmtUnitEnvelopeInches, openingStorageMeasureEmptyTalk } from "@/lib/yard/voiceHonesty";
import { modelFinishedDepth, modelProudNote, stampFinishedDepth } from "@/lib/yard/modelSize";
import { runYardPrompt } from "@/components/workspace/run-prompt";
import { loadIssues } from "@/lib/yard/function";
import { withSupports } from "@/lib/yard/spanCheck";
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
  const commit = useYard((s) => s.commit);
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
  const orbited = useYard((s) => s.orbited);
  const [orbitHint, setOrbitHint] = useState(false);
  useEffect(() => {
    try {
      if (orbited) {
        window.localStorage.setItem("yard.orbitHint", "seen");
        setOrbitHint(false);
      } else if (window.localStorage.getItem("yard.orbitHint") !== "seen") {
        setOrbitHint(true);
      }
    } catch {
      setOrbitHint(false);
    }
  }, [orbited]);

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
    if (!house && !project.recastFrom && project.overall.width > 1 && project.overall.height > 1) {
      const n = inchFrac;
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
  const pickedInst = selectedId ? project.instances.find((i) => i.id === selectedId) : undefined;
  const pickedPanel = !pickedInst && selectedId ? project.panels.find((p) => p.id === selectedId) : undefined;
  const picked = pickedInst
    ? (() => {
        const item = getCatalogItem(pickedInst.catalogId);
        const len = pickedInst.cutLength ?? item?.dims.length;
        const dia = item?.dims.diameter;
        const sec = pickedInst.section;
        const dim = sec
          ? `${inches(sec.width)} × ${inches(sec.height)}${len ? ` · ${inches(len)} long` : ""}`
          : dia
            ? `${len ? `${inches(len)} long · ` : ""}⌀ ${inches(dia)}`
            : len
              ? `${inches(len)} long`
              : "";
        return { name: item?.name ?? "Piece", dim, canLock: true };
      })()
    : pickedPanel
      ? {
          name: pickedPanel.name || getCatalogItem(pickedPanel.materialId)?.name || "Piece",
          dim: `${inches(pickedPanel.size.width)} × ${inches(pickedPanel.size.height)} × ${inches(pickedPanel.size.depth)}`,
          canLock: false,
        }
      : null;

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2 sm:h-14 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <span className="hidden truncate font-display text-sm text-muted md:inline">
            {stampFinishedDepth(project.name, project.overall.depth, modelFinishedDepth(project.panels, project.overall.depth))}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link to="/ideas" className="hidden px-2 text-sm text-muted hover:text-fg sm:inline">
            Ideas
          </Link>
          <button
            type="button"
            onClick={() => {
              makePlan();
              setPlanOpen(true);
            }}
            className="inline-flex h-9 items-center rounded-full bg-accent px-3.5 text-sm font-medium text-accent-fg"
          >
            Get the plan
          </button>
          <button
            type="button"
            onClick={() => {
              makePlan();
              setExportOpen(true);
            }}
            className="inline-flex h-9 items-center rounded-full px-3 text-sm text-muted hover:text-fg"
            aria-label="Save the plan as PDF"
            title="Save the plan as PDF"
          >
            PDF
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
                <Link
                  to="/ideas"
                  className="block rounded-sm px-3 py-2.5 text-sm text-muted hover:bg-elevated hover:text-fg"
                  onClick={() => setMoreOpen(false)}
                >
                  Ideas
                </Link>
                {(
                  [
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
                  if (project.supportOffer?.kind === "span") {
                    commit(withSupports(project));
                    makePlan();
                    return;
                  }
                  generate(project.prompt, project.primaryMaterialId, undefined, { includeSpine: true });
                  makePlan();
                  revealBench();
                }}
              >
                {project.supportOffer?.kind === "span" ? "Add support" : "Add spine"}
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
          {orbitHint && pieceCount > 0 && !pending && activeStep == null && workMode !== "walk" && (
            <p
              data-yard-orbit-hint="1"
              className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/70 bg-surface/85 px-3 py-1 text-[11px] text-muted backdrop-blur"
            >
              Drag to turn it · pinch or scroll to zoom
            </p>
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

          {/* One dock: tools, the step, and the size. The model stays clear above it. */}
          {pieceCount > 0 && (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 sm:bottom-4 ${
              planOpen ? "max-xl:hidden xl:pr-[36rem]" : ""
            }`}
          >
            <div data-bench-overlay="dock" className="pointer-events-auto w-[min(34rem,100%)] overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
              {picked && !pending && (
                <div data-bench-overlay="piece" className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{picked.name}</p>
                    {picked.dim ? <p className="font-mono text-[11px] text-faint">{picked.dim}</p> : null}
                  </div>
                  {picked.canLock && (
                    <button
                      type="button"
                      onClick={() => toggleLockSelected()}
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs text-muted hover:bg-elevated hover:text-fg"
                    >
                      {locked ? "Unlock" : "Lock"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteSelected()}
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs text-danger hover:bg-elevated"
                  >
                    Remove
                  </button>
                </div>
              )}
              {pieceCount > 0 && !pending && workMode !== "walk" && (
                <BenchTools
                  side={side}
                  onStock={() => setSide((s) => (s === "catalog" ? null : "catalog"))}
                  onMeasure={() => setSide((s) => (s === "measure" ? null : "measure"))}
                  bare
                />
              )}
              {steps.length > 0 && !pending && (
                <div
                  data-bench-overlay="step-pill"
                  className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1 text-xs"
                >
                  <button
                    type="button"
                    className="grid size-9 place-items-center text-muted hover:text-fg disabled:opacity-30"
                    disabled={stepIndex <= 0}
                    onClick={() => {
                      if (stepIndex <= 0) return;
                      setActiveStep(steps[stepIndex - 1].step);
                    }}
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanOpen(true)}
                    className="min-w-0 flex-1 truncate text-left"
                    aria-label={
                      activeStep
                        ? `Open the plan, step ${activeStep} of ${steps.length}`
                        : `Open the plan, ${steps.length} steps`
                    }
                  >
                    <span className="font-mono text-faint">
                      {activeStep
                        ? `${String(activeStep).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`
                        : `${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
                    </span>{" "}
                    <span className="text-fg">
                      {activeStep ? steps.find((s) => s.step === activeStep)?.title : "Open the plan"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="grid size-9 place-items-center text-muted hover:text-fg disabled:opacity-30"
                    disabled={stepIndex >= steps.length - 1 && stepIndex >= 0}
                    onClick={() => {
                      const i = stepIndex < 0 ? 0 : Math.min(steps.length - 1, stepIndex + 1);
                      setActiveStep(steps[i].step);
                    }}
                    aria-label={stepIndex < 0 ? "Start step 1" : "Next step"}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
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
                className="flex items-baseline justify-between gap-3 border-t border-border/60 px-3.5 py-2 text-xs"
              >
                <p className="min-w-0 truncate text-muted">
                  {pieceCount > 0 && !pending && workMode !== "walk" && !wire
                    ? paperCraft
                      ? `${pieceCount} whole sticks`
                      : `${pieceCount} ${pieceCount === 1 ? "piece" : "pieces"}`
                    : wire
                      ? "Pick a real stock"
                      : nestSheetLabel
                        ? nestSheetLabel
                        : stockLabel !== "stock"
                          ? stockLabel
                          : material?.name ?? "No stock"}
                  {pieceCount && (wire || pending || workMode === "walk")
                    ? paperCraft
                      ? ` · ${pieceCount} whole sticks`
                      : ` · ${pieceCount} pieces`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setSide((s) => (s === "measure" ? null : "measure"))}
                  className="shrink-0 font-mono text-[11px] text-faint hover:text-fg"
                  aria-label={project.pocket ?? project.recastFrom?.pocket ? "Edit the hole (size, shape, notch), how much of it, and the shelves" : "Edit the size"}
                  title={project.pocket ?? project.recastFrom?.pocket ? "The hole: size, shape, notch, the share, and the shelves" : "Edit wide, tall, and deep"}
                >
                  {(() => {
                    const pocketUnit = (project.pocket ?? project.recastFrom?.pocket)?.unit;
                    const inch = inchFrac;
                    const proud = pocketUnit ? "" : modelProudNote(project.panels, project.overall.depth);
                    const finished = pocketUnit
                      ? pocketUnit.depth
                      : modelFinishedDepth(project.panels, project.overall.depth);
                    const envelope = pocketUnit
                      ? `${inch(pocketUnit.width)}" × ${inch(pocketUnit.height)}" × ${inch(pocketUnit.depth)}"`
                      : fmtUnitEnvelopeInches(project.overall.width, project.overall.height, finished, {
                          shape: project.fitted?.unit?.shape,
                          prompt: project.prompt,
                          name: project.name,
                          legs: project.fitted?.unit?.legs,
                        });
                    const emptyTalk = pocketUnit ? null : openingStorageMeasureEmptyTalk(project.prompt);
                    const companion = emptyTalk
                      ? emptyTalk.hudCompanion
                      : wire
                        ? ""
                        : workMode === "walk"
                          ? " · on the road"
                          : workMode === "build"
                            ? " · snap to the glow"
                            : "";
                    return (
                      <>
                        {envelope}
                        {proud ? ` · ${proud}` : ""}
                        {companion}
                      </>
                    );
                  })()}
                </button>
              </div>
            </div>
          </div>
          )}
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
