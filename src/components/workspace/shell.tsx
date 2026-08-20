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
import { MeasureOverlay } from "@/components/workspace/measure-overlay";
import { PlanDrawer } from "@/components/workspace/plan-drawer";
import { WorkspaceCanvas } from "@/components/workspace/canvas";
import { hydrateYard, useYard } from "@/lib/yard/store";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCatalogItem } from "@/lib/yard/catalog";
import { hintSubject, interpretPrompt } from "@/lib/ai/grok";
import { inches } from "@/lib/utils";
import { hasHistoricProfile } from "@/lib/yard/ghost";
import { recipeFromAnatomy } from "@/lib/yard/form";
import type { WorkMode } from "@/lib/yard/types";

export function WorkspaceApp({ initialPrompt }: { initialPrompt?: string }) {
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState<"catalog" | "measure" | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, isPending } = useCurrentUserState();
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const undo = useYard((s) => s.undo);
  const redo = useYard((s) => s.redo);
  const reset = useYard((s) => s.reset);
  const explode = useYard((s) => s.explode);
  const setExplode = useYard((s) => s.setExplode);
  const camera = useYard((s) => s.camera);
  const setCamera = useYard((s) => s.setCamera);
  const deleteSelected = useYard((s) => s.deleteSelected);
  const selectedId = useYard((s) => s.selectedId);
  const history = useYard((s) => s.history);
  const future = useYard((s) => s.future);
  const workMode = useYard((s) => s.workMode);
  const setWorkMode = useYard((s) => s.setWorkMode);
  const showHull = useYard((s) => s.showHull);
  const showHistoric = useYard((s) => s.showHistoric);
  const setShowHull = useYard((s) => s.setShowHull);
  const setShowHistoric = useYard((s) => s.setShowHistoric);
  const toggleLockSelected = useYard((s) => s.toggleLockSelected);
  const lockedIds = useYard((s) => s.lockedIds);
  const plan = useYard((s) => s.plan);
  const grokBusy = useYard((s) => s.grokBusy);
  const activeStep = useYard((s) => s.activeStep);
  const setActiveStep = useYard((s) => s.setActiveStep);

  useEffect(() => {
    const fromUrl =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") : null;
    const prompt = (initialPrompt || fromUrl || "").trim();
    if (prompt) {
      try {
        generate(prompt);
        makePlan();
      } catch (err) {
        useYard.setState({
          grokError: err instanceof Error ? err.message : "Could not generate that structure.",
        });
      }
    } else {
      hydrateYard();
    }
    setReady(true);
    if (!prompt) return;
    const seeded = useYard.getState().project;
    if (seeded.kind === "closet" || seeded.kind === "opening") return;
    const offline =
      typeof window !== "undefined" &&
      /(?:^|[?&])(?:local|offline)=1/.test(window.location.search);
    void (async () => {
      try {
        const hint = await hintSubject({ data: { prompt } });
        if (hint.summary && hint.summary !== hint.subject) {
          const form = recipeFromAnatomy(`${prompt} ${hint.summary}`, seeded.overall);
          generate(prompt, undefined, form);
          makePlan();
        }
      } catch {
        /* local classify already on the bench */
      }
      if (offline) return;
      useYard.setState({ grokBusy: true, grokError: null });
      const timeout = window.setTimeout(() => useYard.setState({ grokBusy: false }), 22000);
      try {
        const interp = await interpretPrompt({
          data: { prompt, heightIn: seeded.overall.height, widthIn: seeded.overall.width },
        });
        const after = useYard.getState().project;
        if (
          interp.ok &&
          interp.form &&
          after.kind !== "eiffel" &&
          after.kind !== "closet" &&
          after.kind !== "opening"
        ) {
          generate(prompt, interp.materialId ?? undefined, interp.form);
          makePlan();
        } else if (interp.ok && interp.materialId && interp.materialId !== after.primaryMaterialId) {
          generate(prompt, interp.materialId);
          makePlan();
        }
        if (interp.ok && (interp.real || interp.notes)) {
          const live = useYard.getState().project;
          const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
          useYard.getState().setProject({
            ...live,
            notes: [...live.notes, ...extra.filter((n) => !live.notes.includes(n))],
          });
        }
      } catch {
        /* deterministic already on the bench */
      } finally {
        window.clearTimeout(timeout);
        useYard.setState({ grokBusy: false });
      }
    })();
  }, [initialPrompt, generate, makePlan]);

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
    if (workMode === "build") setWorkMode("look");
  }, [workMode, setWorkMode]);

  const material = getCatalogItem(project.primaryMaterialId);
  const pieceCount = project.instances.length + project.panels.length;
  const historicOk = hasHistoricProfile(project.kind) || !!project.historic;
  const locked = selectedId ? lockedIds.includes(selectedId) : false;
  const steps = plan?.instructions ?? [];
  const stepIndex = steps.findIndex((s) => s.step === activeStep);

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
            <span className="hidden xs:inline sm:inline">Measure</span>
          </button>
          <button
            type="button"
            onClick={() => {
              makePlan();
              setPlanOpen(true);
            }}
            className="inline-flex h-11 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg sm:h-9"
          >
            Build plan
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
                <MoreItem
                  label={explode ? "Collapse" : "Explode"}
                  onClick={() => {
                    setExplode(!explode);
                    setMoreOpen(false);
                  }}
                />
                <MoreItem
                  label="Stock"
                  onClick={() => {
                    setSide((s) => (s === "catalog" ? null : "catalog"));
                    setMoreOpen(false);
                  }}
                />
                {(["iso", "front", "side", "top"] as const).map((c) => (
                  <MoreItem
                    key={c}
                    label={`Camera ${c}`}
                    onClick={() => {
                      setCamera(c);
                      setMoreOpen(false);
                    }}
                  />
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

      <PromptBar onBuilt={() => setPlanOpen(false)} />

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

        <div className="relative min-w-0 flex-1">
          <WorkspaceCanvas />
          <MeasureOverlay />
          {grokBusy && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted">
              Querying the true form — then mapping your stock onto that wire
            </div>
          )}
          {project.supportOffer?.needed && !project.supportOffer.included && !activeStep && (
            <div
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
            >
              <p className="font-mono text-[11px] text-faint">
                Viewing step {String(activeStep).padStart(2, "0")} of {String(steps.length).padStart(2, "0")}
              </p>
              <p className="mt-0.5 font-medium text-fg">
                {steps.find((s) => s.step === activeStep)?.title}
              </p>
              <p className="mt-1 hidden text-xs leading-relaxed text-muted sm:block">
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
          {ready && pieceCount === 0 && !side && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <div className="max-w-sm text-center">
                <p className="font-display text-2xl text-fg">Empty bench</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Type a dream above. Every piece Yard places is something you can actually buy.
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2 sm:left-4">
            <ModeSwitch value={workMode} onChange={setWorkMode} />
            <div className="pointer-events-auto flex overflow-hidden rounded-md border border-border bg-surface/90 text-xs backdrop-blur">
              <GhostBtn
                on={showHull}
                onClick={() => setShowHull(!showHull)}
                label="Hull"
                title="Parametric envelope of this build"
              />
              <GhostBtn
                on={showHistoric}
                onClick={() => historicOk && setShowHistoric(!showHistoric)}
                label="Form"
                title={historicOk ? "Published monument proportions" : "No historic profile for this build"}
                disabled={!historicOk}
              />
            </div>
          </div>

          {steps.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-3 sm:bottom-20">
              <div className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-md border border-border bg-surface/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
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

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-xs text-muted">
            <div
              data-yard-pieces={pieceCount}
              data-yard-kind={project.kind}
              data-yard-mode={workMode}
              data-yard-hull={showHull ? "1" : "0"}
              data-yard-joints={project.buildStats?.joints ?? 0}
              data-yard-loose={project.buildStats?.loose ?? 0}
              data-yard-components={project.buildStats?.components ?? 0}
              data-yard-form={showHistoric ? "1" : "0"}
              className="pointer-events-auto rounded-md border border-border bg-surface/90 px-3 py-2 backdrop-blur"
            >
              <p>
                {material?.name ?? "No stock"}
                {pieceCount ? ` · ${pieceCount} pieces` : ""}
              </p>
              <p className="mt-0.5 text-faint">
                {inches(project.overall.width)} × {inches(project.overall.height)} × {inches(project.overall.depth)}
                {" · "}
                {workMode === "look" ? "Orbit" : workMode === "build" ? "Snap to the glow" : "Drag · snap home"}
              </p>
            </div>
            <button type="button" onClick={reset} className="pointer-events-auto text-faint hover:text-muted">
              Clear bench
            </button>
          </div>
        </div>
      </div>

      <PlanDrawer open={planOpen} onClose={() => setPlanOpen(false)} />
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

function ModeSwitch({ value, onChange }: { value: WorkMode; onChange: (v: WorkMode) => void }) {
  const modes: { id: WorkMode; label: string }[] = [
    { id: "look", label: "Look" },
    { id: "free", label: "Free" },
  ];
  return (
    <div className="pointer-events-auto flex overflow-hidden rounded-md border border-border bg-surface/90 text-xs backdrop-blur">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`h-11 min-w-11 px-3 sm:h-8 sm:px-2.5 ${value === m.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function GhostBtn({
  on,
  onClick,
  label,
  title,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`h-11 px-3 disabled:opacity-30 sm:h-8 sm:px-2.5 ${on ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}
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
