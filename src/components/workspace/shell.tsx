"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Box, ChevronLeft, ChevronRight, Lock, RotateCcw, RotateCw, Ruler, Trash2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PromptBar } from "@/components/workspace/prompt-bar";
import { CatalogPanel } from "@/components/workspace/catalog-panel";
import { MeasurePanel } from "@/components/workspace/measure-panel";
import { MeasureOverlay } from "@/components/workspace/measure-overlay";
import { PlanDrawer } from "@/components/workspace/plan-drawer";
import { WorkspaceCanvas } from "@/components/workspace/canvas";
import { hydrateYard, useYard } from "@/lib/yard/store";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCatalogItem } from "@/lib/yard/catalog";
import { interpretPrompt } from "@/lib/ai/grok";
import { inches } from "@/lib/utils";
import { hasHistoricProfile } from "@/lib/yard/ghost";
import type { WorkMode } from "@/lib/yard/types";

export function WorkspaceApp({ initialPrompt }: { initialPrompt?: string }) {
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState<"catalog" | "measure" | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
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
    const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") : null;
    const prompt = (initialPrompt || fromUrl || "").trim();
    if (prompt) {
      try { generate(prompt); makePlan(); }
      catch (err) { useYard.setState({ grokError: err instanceof Error ? err.message : "Could not generate that structure." }); }
    } else {
      hydrateYard();
    }
    setReady(true);
    if (!prompt) return;
    const seeded = useYard.getState().project;
    if (seeded.kind === "closet" || seeded.kind === "opening") return;
    void (async () => {
      useYard.setState({ grokBusy: true, grokError: null });
      const timeout = window.setTimeout(() => useYard.setState({ grokBusy: false }), 22000);
      try {
        const interp = await interpretPrompt({ data: { prompt, heightIn: seeded.overall.height, widthIn: seeded.overall.width } });
        const after = useYard.getState().project;
        if (interp.ok && interp.form && after.kind !== "eiffel" && after.kind !== "closet" && after.kind !== "opening") {
          generate(prompt, interp.materialId ?? undefined, interp.form);
          makePlan();
        } else if (interp.ok && interp.materialId && interp.materialId !== after.primaryMaterialId) {
          generate(prompt, interp.materialId);
          makePlan();
        }
        if (interp.ok && (interp.real || interp.notes)) {
          const live = useYard.getState().project;
          const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
          useYard.getState().setProject({ ...live, notes: [...live.notes, ...extra.filter((n) => !live.notes.includes(n))] });
        }
      } catch { /* deterministic already on the bench */ }
      finally { window.clearTimeout(timeout); useYard.setState({ grokBusy: false }); }
    })();
  }, [initialPrompt, generate, makePlan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  const material = getCatalogItem(project.primaryMaterialId);
  const pieceCount = project.instances.length + project.panels.length;
  const historicOk = hasHistoricProfile(project.kind) || !!project.historic;
  const locked = selectedId ? lockedIds.includes(selectedId) : false;
  const steps = plan?.instructions ?? [];
  const stepIndex = steps.findIndex((s) => s.step === activeStep);

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="shrink-0"><Logo /></Link>
          <span className="hidden truncate text-sm text-muted md:inline">{project.name}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <IconBtn label="Undo" disabled={!history.length} onClick={undo}><RotateCcw className="size-4" /></IconBtn>
          <IconBtn label="Redo" disabled={!future.length} onClick={redo}><RotateCw className="size-4" /></IconBtn>
          <IconBtn label="Delete" disabled={!selectedId} onClick={deleteSelected}><Trash2 className="size-4" /></IconBtn>
          <IconBtn label={locked ? "Unlock piece" : "Lock piece"} disabled={!selectedId} onClick={toggleLockSelected}><Lock className={`size-4 ${locked ? "text-fg" : ""}`} /></IconBtn>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {(["iso", "front", "side", "top"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCamera(c)} className={`hidden h-8 rounded-sm px-2 text-xs sm:inline-flex sm:items-center ${camera === c ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}>{c}</button>
          ))}
          <IconBtn label="Explode" onClick={() => setExplode(!explode)}><Box className={`size-4 ${explode ? "text-fg" : ""}`} /></IconBtn>
          <button type="button" onClick={() => setSide((s) => (s === "catalog" ? null : "catalog"))} className={`inline-flex h-8 items-center rounded-sm px-2 text-xs ${side === "catalog" ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}>Stock</button>
          <button type="button" onClick={() => setSide((s) => (s === "measure" ? null : "measure"))} className={`inline-flex h-8 items-center rounded-sm px-2 text-xs ${side === "measure" ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}><Ruler className="size-3.5" /> Measure</button>
          <button type="button" onClick={() => { makePlan(); setPlanOpen(true); }} className="ml-1 inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg">Build plan</button>
          {isPending ? <div className="ml-1 h-8 w-8 animate-pulse rounded-full bg-elevated" /> : user ? <SignedIn><UserButton /></SignedIn> : <SignedOut><Link to="/login" className="hidden text-xs text-muted hover:text-fg sm:inline">Sign in</Link></SignedOut>}
        </div>
      </header>
      <PromptBar onBuilt={() => setPlanOpen(false)} />
      <div className="relative flex min-h-0 flex-1">
        {side && (
          <>
            <button type="button" aria-label="Close panel" onClick={() => setSide(null)} className="absolute inset-0 z-10 bg-bg/50 md:hidden" />
            <aside className="absolute inset-y-0 left-0 z-20 w-[min(20rem,92vw)] overflow-y-auto border-r border-border bg-surface md:static md:w-80 md:shrink-0">
              {side === "catalog" ? <CatalogPanel /> : <MeasurePanel onBuilt={() => setPlanOpen(false)} />}
            </aside>
          </>
        )}
        <div className="relative min-w-0 flex-1">
          <WorkspaceCanvas />
          <MeasureOverlay />
          {grokBusy && <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted">Querying the true form — then mapping your stock onto that wire</div>}
          {ready && pieceCount === 0 && !side && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <div className="max-w-sm text-center">
                <p className="font-display text-2xl text-fg">Empty bench</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">Type a dream above. Every piece Yard places is something you can actually buy.</p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2 sm:left-4">
            <ModeSwitch value={workMode} onChange={setWorkMode} />
            <div className="pointer-events-auto flex overflow-hidden rounded-md border border-border bg-surface/90 text-xs backdrop-blur">
              <GhostBtn on={showHull} onClick={() => setShowHull(!showHull)} label="Hull" title="Parametric envelope" />
              <GhostBtn on={showHistoric} onClick={() => historicOk && setShowHistoric(!showHistoric)} label="Form" title={historicOk ? "Published monument proportions" : "No historic profile"} disabled={!historicOk} />
            </div>
          </div>
          {steps.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-3 sm:bottom-20">
              <div className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-md border border-border bg-surface/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
                <button type="button" className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" onClick={() => { const i = stepIndex < 0 ? 0 : Math.max(0, stepIndex - 1); setActiveStep(steps[i].step); }} aria-label="Previous step"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={() => setPlanOpen(true)} className="min-w-0 flex-1 text-left">
                  <span className="font-mono text-faint">{activeStep ? String(activeStep).padStart(2, "0") : "—"} / {String(steps.length).padStart(2, "0")}</span>
                  <span className="ml-2 truncate text-fg">{activeStep ? steps.find((s) => s.step === activeStep)?.title : "Step through the build"}</span>
                </button>
                <button type="button" className="grid size-8 place-items-center text-muted hover:text-fg" onClick={() => { const i = stepIndex < 0 ? 0 : Math.min(steps.length - 1, stepIndex + 1); setActiveStep(steps[i].step); }} aria-label="Next step"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-xs text-muted">
            <div data-yard-pieces={pieceCount} data-yard-kind={project.kind} data-yard-mode={workMode} data-yard-hull={showHull ? "1" : "0"} data-yard-form={showHistoric ? "1" : "0"} className="pointer-events-auto rounded-md border border-border bg-surface/90 px-3 py-2 backdrop-blur">
              <p>{material?.name ?? "No stock"}{pieceCount ? ` · ${pieceCount} pieces` : ""}</p>
              <p className="mt-0.5 text-faint">{inches(project.overall.width)} × {inches(project.overall.height)} × {inches(project.overall.depth)}{" · "}{workMode === "look" ? "Orbit" : workMode === "build" ? "Snap to the glow" : "Drag · snap home"}</p>
            </div>
            <button type="button" onClick={reset} className="pointer-events-auto text-faint hover:text-muted">Clear bench</button>
          </div>
        </div>
      </div>
      <PlanDrawer open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}

function ModeSwitch({ value, onChange }: { value: WorkMode; onChange: (v: WorkMode) => void }) {
  const modes: { id: WorkMode; label: string }[] = [{ id: "look", label: "Look" }, { id: "free", label: "Free" }, { id: "build", label: "Build" }];
  return (
    <div className="pointer-events-auto flex overflow-hidden rounded-md border border-border bg-surface/90 text-xs backdrop-blur">
      {modes.map((m) => <button key={m.id} type="button" onClick={() => onChange(m.id)} className={`h-8 px-2.5 ${value === m.id ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}>{m.label}</button>)}
    </div>
  );
}
function GhostBtn({ on, onClick, label, title, disabled }: { on: boolean; onClick: () => void; label: string; title: string; disabled?: boolean }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`h-8 px-2.5 disabled:opacity-30 ${on ? "bg-elevated text-fg" : "text-muted hover:text-fg"}`}>{label}</button>;
}
function IconBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-elevated hover:text-fg disabled:opacity-30">{children}</button>;
}
