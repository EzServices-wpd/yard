"use client";
import { userText } from "@/lib/yard/userText";
import { headerTitle } from "@/lib/yard/pdf";
import { NOTHING_BUILT_STOCK } from "@/lib/yard/stockPill";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PromptBar } from "@/components/workspace/prompt-bar";
import { RefineBox } from "@/components/workspace/refine-box";
import { DecisionLine } from "@/components/workspace/decision-line";
import { priceReason, type PriceReason } from "@/components/workspace/price-reason";
import { MorphButton } from "@/components/workspace/morph-button";
import { RevealStatus } from "@/components/workspace/reveal-status";
import { BuildInfoPanel } from "@/components/workspace/build-info";
import { ShopFeedback } from "@/components/workspace/shop-feedback";
import { DockFrame } from "@/components/workspace/dock-frame";
import { CatalogPanel } from "@/components/workspace/catalog-panel";
import { MeasurePanel } from "@/components/workspace/measure-panel";
import { PlanDrawer } from "@/components/workspace/plan-drawer";
import { ExportDialog } from "@/components/workspace/export-dialog";
import { WorkspaceCanvas } from "@/components/workspace/canvas";
import { LavaLamp } from "@/components/workspace/lava-lamp";
import { BenchTools } from "@/components/workspace/bench-tools";
import { hydrateYard, useYard } from "@/lib/yard/store";
import { decodeShare, loadSaved } from "@/lib/yard/shareBuild";
import { applyInsideCount } from "@/lib/yard/insideCount";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCatalogItem } from "@/lib/yard/catalog";
import { namedStockDisplayName } from "@/lib/yard/weekendStockHonesty";
import { honestNestSheetStockName } from "@/lib/yard/report";
import { woodCutPieceCount } from "@/lib/yard/shopPlural";
import { isWireStock } from "@/lib/yard/promptHelpers";
import { inches } from "@/lib/utils";
import { inchDims, inchFrac, partCardDims } from "@/lib/yard/inchText";
import { MeasureReadout } from "@/components/workspace/measure-readout";
import { runYardPrompt } from "@/components/workspace/run-prompt";
import { loadIssues } from "@/lib/yard/function";
import { withSupports } from "@/lib/yard/spanCheck";
import { holdWalkKey } from "@/components/workspace/walk-rig";

/** (b) A build still pending after this long stops the lamp and offers builds that always work. */
export const STALL_MS = 45_000;
const STALL_IDEAS = ["linen closet 31.5 wide 78 tall 16 deep", "bookcase 36 wide", "nightstand with 2 drawers"];

export function WorkspaceApp({ initialPrompt, shareToken }: { initialPrompt?: string; shareToken?: string }) {
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState<"catalog" | "measure" | null>(null);
  // The span/spine offer: dismissible per build; on a phone it lives in the Edit sheet, never over the model.
  const [offerDismissed, setOfferDismissed] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [promptDirty, setPromptDirty] = useState(true);
  const [trayOpen, setTrayOpen] = useState(false);
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
  // From the press (yard-build-start) until the build is under way, the old title must not show for
  // the new build: the solve runs in the same task, so `building` alone paints a beat too late.
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const on = () => setStarting(true);
    window.addEventListener("yard-build-start", on);
    return () => window.removeEventListener("yard-build-start", on);
  }, []);
  useEffect(() => {
    if (!starting) return;
    if (building || grokBusy) return setStarting(false);
    const t = window.setTimeout(() => setStarting(false), 3000);
    return () => window.clearTimeout(t);
  }, [starting, building, grokBusy]);
  const titlePending = pending || starting;
  // Chief's item: why this build's price differs from the plain build. Worked out at idle (never
  // before the model) into a line slot the card always keeps, so it never pushes the card (CLS 0).
  const [priceWhy, setPriceWhy] = useState<PriceReason | null>(null);
  useEffect(() => {
    setPriceWhy(null);
    if (!plan) return;
    const forPlan = plan;
    const run = () => setPriceWhy(priceReason(useYard.getState().project, forPlan));
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 50);
    return () => { if (w.cancelIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id); };
  }, [plan]);

  const orbited = useYard((s) => s.orbited);
  // A fresh lamp (new nearby preview) per build; it stays mounted briefly after to crossfade out.
  const [lampKey, setLampKey] = useState(0);
  const [wasPending, setWasPending] = useState(pending);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (pending) setLampKey((k) => k + 1);
  }
  // Quick win (a): the lamp covers the bench only while the engine solves. An AI check over a priced model is a
  // small chip, never a veil over parts and a price. (b): a build still pending after STALL_MS fades the lamp and
  // says so, with three builds to try, instead of an endless "Building".
  const benchPieces = plan?.totals.pieces ?? woodCutPieceCount(project);
  const priced = ready && benchPieces > 0 && !project.displayOnly;
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    if (!pending) return;
    const t = window.setTimeout(() => setStalled(true), STALL_MS);
    return () => window.clearTimeout(t);
  }, [pending, lampKey]);
  const lampOn = pending && !stalled && (building || !priced);
  const aiChip = grokBusy && !building && priced && !stalled;
  // Full tab titles: the tab says the header the page shows (never the terse "Build 48x36" from the URL). A refused
  // build has no pieces but still names itself: "Abacus · nothing built · Yard", not "Workspace · Yard".
  useEffect(() => {
    if (titlePending || (benchPieces <= 0 && !project.refused)) return;
    document.title = `${headerTitle(project)} · Yard`;
  }, [titlePending, benchPieces, project]);

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
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const token = shareToken || params?.get("y");
    const shared = token ? decodeShare(token) : null;
    const fromUrl = params?.get("q");
    const prompt = (shared?.prompt || initialPrompt || fromUrl || "").trim();
    if (prompt) {
      void (async () => {
        try {
          const live = await runYardPrompt(prompt, { fresh: true });
          // A newer prompt typed while the link's build was still looking up owns the bench now.
          if (shared && live) {
            useYard.getState().setMeasure(shared.measure);
            let next = useYard.getState().project;
            if (shared.stockId || shared.join) next = { ...next, primaryMaterialId: shared.stockId ?? next.primaryMaterialId, shopJoin: (shared.join as never) ?? next.shopJoin };
            if (shared.shelves != null || shared.cubbies != null || shared.drawers != null) {
              next = applyInsideCount({ ...next, primaryMaterialId: shared.stockId ?? next.primaryMaterialId }, { shelves: shared.shelves, cubbies: shared.cubbies, drawers: shared.drawers });
              if (shared.join) next = { ...next, shopJoin: shared.join as never };
            }
            useYard.getState().commit(next);
            useYard.getState().applyMeasure(true);
          }
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
    const saved = loadSaved();
    if (saved) useYard.getState().setMeasure(saved.measure);
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
    // Read the live project: the URL build runs in an earlier effect in this same pass, so the
    // render-time project can be the empty starter — writing its 36" box would wipe the real card.
    const live = useYard.getState().project;
    const house = live.kind === "closet" || live.kind === "opening" || Boolean(live.pocket) || Boolean(live.fitted);
    setMeasureOpen(house);
    if (!house && !live.recastFrom && live.overall.width > 1 && live.overall.height > 1) {
      const n = inchFrac;
      setMeasure({ width: n(live.overall.width), height: n(live.overall.height), depth: n(live.overall.depth) });
    }
    // Unit is the hero. Do not steal the bench with the measure sidebar.
    // Measure button still opens the full card (pocket walls, kind, example pocket).
    // A live refit from the Size card keeps the card open so the next number can be typed;
    // a new build from the prompt bar closes it (onBuilt below).
    setSide((s) => (s === "measure" ? s : null));
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
          ? `${inchDims(sec.width, sec.height)}${len ? ` · ${inches(len)} long` : ""}`
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
          dim: partCardDims(pickedPanel.size),
          canLock: false,
        }
      : null;

  const showOffer = !!project.supportOffer?.needed && !project.supportOffer.included && !activeStep && !pending && offerDismissed !== project.id;
  const offerButtons = (
    <>
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
      <button type="button" aria-label="Dismiss" data-yard-offer-dismiss="1" className="shrink-0 rounded-sm px-1.5 py-1 text-muted hover:text-fg" onClick={() => setOfferDismissed(project.id)}>
        ✕
      </button>
    </>
  );
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2 sm:h-14 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <span className="hidden truncate font-display text-sm text-muted md:inline" data-yard-workbench-title>
            {/* With a build, the title is the plan's header itself (same as the PDF); a refused build names what was asked
                for and says nothing was built; a not-learned placeholder names the typed object; "Workbench" only on an empty bench. */}
            {pieceCount > 0 || project.refused
              ? headerTitle(project)
              : project.displayOnly // the typed object, as the tab names it (route buildTitle's noun): never "Workbench"
                ? `${project.name.split(/[,\d]/)[0].trim() || project.name} · not learned yet`
                : "Workbench"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link to="/ideas" className="hidden px-2 text-sm text-muted hover:text-fg sm:inline">
            Ideas
          </Link>
          <MorphButton
            pending={pending}
            built={pieceCount > 0}
            dirty={promptDirty}
            onPlan={() => {
              makePlan();
              setPlanOpen(true);
            }}
          />
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
                <MoreItem
                  label="Save the plan as PDF"
                  disabled={pieceCount === 0}
                  onClick={() => {
                    makePlan();
                    setExportOpen(true);
                    setMoreOpen(false);
                  }}
                />
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
        onBuilt={() => {
          // An open plan stays open across a new submit: it holds the last plan until the new build
          // (and any house brief) lands, then swaps in place. Closing it here was the 0.33 s close.
          setSide(null);
        }}
        onStock={() => setSide("catalog")}
        onMeasure={() => setSide("measure")}
        onDirty={setPromptDirty}
      />

      <div className="relative flex min-h-0 flex-1">
        {side && (
          <>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setSide(null)}
              className={`absolute z-10 md:hidden ${side === "measure" ? "inset-x-0 top-0 h-[50vh] bg-transparent" : "inset-0 bg-bg/50"}`}
            />
            <aside className={`absolute z-20 overflow-y-auto border-border bg-surface md:static md:inset-y-0 md:left-0 md:w-80 md:shrink-0 md:border-r ${side === "measure" ? "inset-x-0 bottom-0 top-auto h-[50vh] w-full border-t md:h-auto md:w-80" : "inset-y-0 left-0 w-[min(20rem,92vw)] border-r"}`} data-yard-panel={side === "measure" ? "half" : "side"}>
              {side === "catalog" ? <CatalogPanel /> : <MeasurePanel onBuilt={() => setPlanOpen(false)} />}
            </aside>
          </>
        )}

        <div className="relative min-w-0 flex-1" data-bench-host>
          <WorkspaceCanvas />
          <RevealStatus />
          <LavaLamp key={lampKey} show={lampOn} prompt={initialPrompt ?? project.prompt} caption="Building" />
          {aiChip && (
            <p data-yard-ai-chip="1" className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-border/70 bg-surface/85 px-3 py-1 text-[11px] text-muted backdrop-blur">
              Checking the fit…
            </p>
          )}
          {stalled && (
            <div data-yard-stalled="1" data-bench-overlay="stalled" className="absolute left-1/2 top-3 z-20 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-border bg-surface/95 px-4 py-3 text-center text-sm text-fg shadow-lg backdrop-blur">
              <p>Yard couldn&apos;t finish this build. Try one of these, or change a word and build again.</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {STALL_IDEAS.map((q) => (
                  <a key={q} href={`/workspace?q=${encodeURIComponent(q)}`} className="rounded-full border border-border px-3 py-1 text-xs text-fg hover:bg-bg">
                    {q[0].toUpperCase() + q.slice(1)}
                  </a>
                ))}
              </div>
            </div>
          )}
          {showOffer && (
            <div
              data-bench-overlay="offer"
              className={`absolute left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs text-fg shadow-lg max-md:hidden ${
                grokBusy ? "top-14" : "top-4"
              }`}
            >
              <span className="min-w-0 leading-snug">{project.supportOffer!.reason}</span>
              {offerButtons}
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
                {userText(steps.find((s) => s.step === activeStep)?.description)}
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
          {ready && /^Unverified:/.test(project.notes?.[0] ?? "") && (
            <p data-yard-unverified="1" className="pointer-events-none absolute left-1/2 top-3 z-10 max-w-md -translate-x-1/2 rounded-xl border border-border bg-surface/90 px-4 py-2 text-center text-sm text-fg backdrop-blur">
              {userText(project.notes[0].replace(/^Unverified:\s*/, ""))}
            </p>
          )}
          {ready && project.displayOnly && (
            <p data-yard-not-learned={/^Yard is learning/.test(project.notes?.[0] ?? "") ? "learning" : "1"} className="pointer-events-none absolute left-1/2 top-3 z-10 max-w-md -translate-x-1/2 rounded-xl border border-border bg-surface/90 px-4 py-2 text-center text-sm text-fg backdrop-blur">
              {/^Yard is learning/.test(project.notes?.[0] ?? "")
                ? `Yard is learning the ${project.name.toLowerCase()}. The real parts appear here in a minute or two; keep this page open.`
                : `Yard couldn't learn the ${project.name.toLowerCase()} yet. The grey block is a placeholder: no parts, price or stock.`}
            </p>
          )}
          {ready && pieceCount === 0 && project.refused && !pending && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <div data-yard-refused="1" role="status" className="max-w-md text-center">
                <p className="font-display text-2xl text-fg">Nothing built</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{project.refused}</p>
              </div>
            </div>
          )}
          {ready && pieceCount === 0 && !project.refused && !project.displayOnly && !side && !pending && (
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
          {/* LCP + CLS 0: the card's text (name, Refine input) paints at first render, even while the build runs;
              only the tray waits for the build, so the card never grows in place. Motion is gated on the reveal, content never. */}
          {(pieceCount > 0 || (pending && Boolean(initialPrompt?.trim()))) && (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 sm:bottom-4 ${
              planOpen ? "max-xl:hidden xl:pr-[36rem]" : ""
            }`}
          >
            <div className="relative w-[min(35rem,100%)]">
            {/* Price reason: rides above the card (out of flow), so it never makes a card taller and never
                shifts it (CLS 0). Opacity/transform only; present only when there is a reason. */}
            {workMode !== "walk" && priceWhy && (
              <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-center">
                <p
                  data-yard-price-why={pending ? "0" : "1"}
                  title={priceWhy.text}
                  className="yard-price-why yard-glass pointer-events-auto max-w-full truncate rounded-full border border-border/70 bg-surface/90 px-3 py-1 text-[12px] tabular-nums text-muted"
                  style={{ opacity: pending ? 0 : 1, transform: pending ? "translateY(4px)" : "none" }}
                  aria-hidden={pending}
                >
                  {priceWhy.text}
                </p>
              </div>
            )}
            <DockFrame className="yard-glass pointer-events-auto w-full overflow-y-auto overscroll-contain max-sm:max-h-[40dvh] rounded-2xl border border-border/80 bg-surface/90 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
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
              {showOffer && (
                <div data-bench-overlay="offer-sheet" className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-fg md:hidden">
                  <span className="line-clamp-3 min-w-0 flex-1 leading-snug">{project.supportOffer!.reason}</span>
                  {offerButtons}
                </div>
              )}
              {/* Item 2: the result card. Row 1 says what it is and what it costs, row 2 is the one
                  decision (Refine or open the plan), everything else waits behind "More". */}
              {workMode !== "walk" && (
                <div data-yard-result-card="1" className="flex items-baseline justify-between gap-3 px-3.5 pt-2.5">
                  {/* The title lands with the model: a same-height skeleton holds its place while the lamp is up (CLS 0). */}
                  <p className="min-w-0 truncate font-display text-[15px] text-fg">
                    {titlePending ? (
                      <><span aria-hidden className="inline-block h-[0.8em] w-[11ch] rounded-sm bg-fg/10 align-[-0.05em]" /><span className="sr-only">Building</span></>
                    ) : headerTitle(project, { features: false })}
                  </p>
                  <DecisionLine />
                </div>
              )}
              {/* I32: what the build changed from the ask, in plain words, on the card itself (not only in the plan). */}
              {workMode !== "walk" && !titlePending && project.cardNote && (
                <p data-yard-card-note="1" className="px-3.5 pt-1 text-[12px] leading-snug text-muted">
                  {project.cardNote}
                </p>
              )}
              {workMode !== "walk" && (
                project.displayOnly ? null : (
                  <RefineBox
                    showChips={trayOpen}
                    trailing={
                      <>
                        <button
                          type="button"
                          onClick={() => { makePlan(); setPlanOpen(true); }}
                          disabled={pending}
                          data-yard-open-plan="1"
                          className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full border border-border px-3.5 text-sm text-fg hover:bg-elevated disabled:opacity-50 sm:flex-none"
                        >
                          Open the plan <ChevronRight className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-expanded={trayOpen}
                          aria-controls="yard-tray"
                          onClick={() => setTrayOpen((v) => !v)}
                          data-yard-more="1"
                          className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-full px-2.5 text-sm text-muted hover:text-fg"
                        >
                          More <ChevronDown className={`size-4 transition-transform ${trayOpen ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                      </>
                    }
                  />
                )
              )}
              <div id="yard-tray" hidden={pending || (workMode !== "walk" && pieceCount > 0 && !trayOpen)} className={trayOpen ? "yard-tray" : ""}>
              {steps.length > 0 && !pending && (
                <div
                  data-bench-overlay="step-pill"
                  className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1 text-xs"
                >
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-muted hover:text-fg disabled:opacity-30"
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
                    className="min-h-11 min-w-0 flex-1 truncate text-left"
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
                    className="grid size-11 place-items-center text-muted hover:text-fg disabled:opacity-30"
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
              {pieceCount > 0 && !pending && workMode !== "walk" && (
                <BenchTools
                  side={side}
                  onStock={() => setSide((s) => (s === "catalog" ? null : "catalog"))}
                  onMeasure={() => setSide((s) => (s === "measure" ? null : "measure"))}
                  bare
                />
              )}
              {!pending && workMode !== "walk" && <BuildInfoPanel />}
              {!pending && workMode !== "walk" && <ShopFeedback />}
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
                    : project.refused && !project.panels.length
                      ? NOTHING_BUILT_STOCK
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
                  className="min-h-11 shrink-0 font-mono text-[11px] text-faint hover:text-fg"
                  aria-label={project.pocket ?? project.recastFrom?.pocket ? "Measure the hole, the piece, and the shelves" : "Measure this build"}
                  title="Measure"
                  data-yard-measure-readout
                >
                  <MeasureReadout project={project} wire={wire} workMode={workMode} />
                </button>
              </div>
              </div>
            </DockFrame>
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
