"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { fitBadge } from "@/lib/yard/fitBadge";
import { saveBuild, shareUrl } from "@/lib/yard/shareBuild";
import type { JoinMethod, SpaceKind } from "@/lib/yard/types";
import { STOCK_WINDOWS, windowLabel } from "@/lib/yard/windows";
import { POCKET_DREAM } from "@/lib/yard/pocket";
import { isRoundUnitEnvelope, measureChipAxisLabels, openingStorageMeasureEmptyTalk, measureRefitTalk } from "@/lib/yard/voiceHonesty";
import { parseInch, fieldInch } from "@/lib/yard/inchText";
import { getCatalogItem, FORGE_CATALOG } from "@/lib/yard/catalog";
import { planDiffLine } from "@/lib/yard/shopJoin";
import { applySpaceCuts, type SpaceAsk } from "@/lib/yard/spaceCuts";
import { applyInsideCount } from "@/lib/yard/insideCount";
import type { ShopJoin } from "@/lib/yard/shopJoin";
import {
  bayClearTalk,
  classSizeWarning,
  commitInch,
  stockFitsClass,
  changeLine,
  classPresets,
  pieceFromOpening,
  clearanceTalk,
  clearOpening,
  factsFromProject,
  measureTabs,
  measureWarnings,
  sheetCountOf,
  stampCount,
  yardsPick,
  type ChangeSnap,
  type MeasureTabId,
} from "@/lib/yard/measureTabs";

export function MeasurePanel({ onBuilt }: { onBuilt: () => void }) {
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
  const measureNote = useYard((s) => s.measureNote);
  const setMeasureOpen = useYard((s) => s.setMeasureOpen);
  const generate = useYard((s) => s.generate);
  const project = useYard((s) => s.project);
  const makePlan = useYard((s) => s.makePlan);
  const undo = useYard((s) => s.undo);
  const undoTick = useYard((s) => s.undoTick);
  const setJoinMethod = useYard((s) => s.setJoinMethod);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phone, setPhone] = useState(false);
  const [tab, setTab] = useState<MeasureTabId>("piece");
  const [step, setStep] = useState(0);
  const [lock, setLock] = useState(false);
  const [touched, setTouched] = useState<{ width?: boolean; height?: boolean; depth?: boolean }>({});
  const [summary, setSummary] = useState("");
  const [spacing, setSpacing] = useState<"even" | "each">("even");
  const tabSnap = useRef<Record<string, string>>({});

  useEffect(() => {
    setSummary("");
  }, [undoTick]);

  useEffect(() => {
    setMeasureOpen(true);
    return () => setMeasureOpen(false);
  }, [setMeasureOpen]);

  useEffect(() => {
    const q = window.matchMedia("(max-width: 720px)");
    const apply = () => setPhone(q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);

  const facts = factsFromProject(project);
  const tabs = measureTabs(facts);
  const active = tabs[Math.min(step, tabs.length - 1)]?.id ?? tabs[0]?.id ?? "piece";
  const shown = phone ? active : tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id ?? "piece";

  useEffect(() => {
    tabSnap.current[shown] = JSON.stringify(measure);
  }, [shown]); // snapshot when the tab opens, not on every keystroke

  function snap(): ChangeSnap {
    const live = useYard.getState();
    return {
      shelves: live.project.panels.filter((p) => p.type === "shelf").length,
      sheets: sheetCountOf(live.plan?.sheetNest),
      steps: live.plan?.instructions.length ?? 0,
    };
  }

  function liveIfFitted(delay = 800) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const before = snap();
      applyMeasure();
      makePlan();
      const after = snap();
      const line = changeLine(before, after);
      if (line) setSummary(line);
    }, delay);
  }

  function apply() {
    const before = snap();
    applyMeasure(true);
    makePlan();
    const line = changeLine(before, snap());
    if (line) setSummary(line);
    onBuilt();
  }

  const pocketSrc = project.pocket ?? project.recastFrom?.pocket;
  const isPocket = Boolean(pocketSrc);
  const flaredNow = pocketSrc ? Math.abs(pocketSrc.walls.leftAngleDeg) > 0.05 || Math.abs(pocketSrc.walls.rightAngleDeg) > 0.05 : false;
  const shape = measure.pocketShape ?? (flaredNow ? "flared" : "straight");
  const notchSide = measure.notchSide ?? pocketSrc?.walls.notch?.side ?? "none";
  const isCorner = Boolean(project.fitted?.unit?.corner) || project.fitted?.unit?.odd?.kind === "angled-corner";
  const isSlope = project.fitted?.unit?.odd?.kind === "sloped";
  const slopeDeg = isSlope ? (project.fitted?.unit?.odd?.params as { angle?: number } | undefined)?.angle : undefined;
  const wNum = parseInch(measure.width);
  const hNum = parseInch(measure.height);
  const dNum = parseInch(measure.depth);
  const envOpts = {
    width: Number.isFinite(wNum) ? wNum : project.overall.width,
    height: Number.isFinite(hNum) ? hNum : project.overall.height,
    depth: Number.isFinite(dNum) ? dNum : project.overall.depth,
    shape: project.fitted?.unit?.shape,
    prompt: project.prompt,
    name: project.name,
  };
  const roundUnit = measureChipAxisLabels(envOpts).mode === "round" || isRoundUnitEnvelope(envOpts);
  const openingW = pocketSrc?.walls.backWidth ?? project.fitted?.opening.width ?? project.opening?.width;
  const pieceW = Number.isFinite(wNum) ? wNum : project.overall.width;
  const clearance = parseInch(measure.clearance ?? "") || 0.125;
  const typedOpening = parseInch(measure.openingWidth ?? "");
  const openingForTalk = Number.isFinite(typedOpening) ? typedOpening : (openingW ?? pieceW) + clearance * 2;
  const spare = clearanceTalk(isPocket ? (openingW ?? NaN) : openingForTalk, pieceW, clearance);
  const shelfSpan = Math.max(0, ...project.panels.filter((p) => p.type === "shelf").map((p) => Math.max(p.size.width, p.size.depth)));
  const classWarn = classSizeWarning(facts, pieceW, Number.isFinite(dNum) ? dNum : project.overall.depth);
  const warnings = [
    ...measureWarnings({
      shelfSpan,
      hasDivider: project.panels.some((p) => p.type === "divider") || Boolean(project.supportOffer?.included),
      openingW: isPocket ? openingW : openingForTalk,
      pieceW,
      clearance,
    }),
    ...(classWarn ? [classWarn] : []),
  ];
  const fit = fitBadge({ warnings, hasSpace: tabs.some((tab) => tab.id === "space"), depth: Number.isFinite(dNum) ? dNum : project.overall.depth, width: pieceW });
  const presets = classPresets(facts);
  const stock = getCatalogItem(project.primaryMaterialId);
  const thickness = stock?.dims.thickness ?? stock?.dims.diameter ?? stock?.dims.height;

  function scaleLocked(axis: "width" | "height" | "depth", raw: string) {
    const next = parseInch(raw);
    const cur = axis === "width" ? wNum : axis === "height" ? hNum : dNum;
    setTouched((t) => ({ ...t, [axis]: true }));
    if (!lock || !Number.isFinite(next) || !Number.isFinite(cur) || cur <= 0) {
      setMeasure({ [axis]: raw });
      return;
    }
    const ratio = next / cur;
    const patch: Partial<typeof measure> = { [axis]: raw };
    if (axis !== "width" && Number.isFinite(wNum)) patch.width = fieldInch(wNum * ratio);
    if (axis !== "height" && Number.isFinite(hNum)) patch.height = fieldInch(hNum * ratio);
    if (axis !== "depth" && Number.isFinite(dNum)) patch.depth = fieldInch(dNum * ratio);
    setMeasure(patch);
    const nextW = parseInch(String(patch.width ?? measure.width));
    const nextD = parseInch(String(patch.depth ?? measure.depth));
    const warn = classSizeWarning(facts, Number.isFinite(nextW) ? nextW : pieceW, Number.isFinite(nextD) ? nextD : project.overall.depth);
    if (warn) setSummary(warn.text);
  }

  function resetTab() {
    const raw = tabSnap.current[shown];
    if (!raw) return;
    setMeasure(JSON.parse(raw));
    liveIfFitted(0);
  }

  function applyInside(patch: { shelves?: number; cubbies?: number; drawers?: number }) {
    const before = snap();
    const next = applyInsideCount(project, patch);
    useYard.getState().commit(next);
    makePlan();
    const line = changeLine(before, snap());
    setSummary(line || "Inside updated");
  }

  function placeShelves(raw: string[]) {
    const ys = raw.map((v) => parseInch(v)).filter((n) => Number.isFinite(n));
    if (!ys.length) return;
    const shelves = project.panels.filter((p) => p.type === "shelf");
    if (!shelves.length) return;
    const next = {
      ...project,
      panels: project.panels.map((p) => {
        if (p.type !== "shelf") return p;
        const i = shelves.indexOf(p);
        const y = ys[Math.min(i, ys.length - 1)];
        return { ...p, position: { ...p.position, y } };
      }),
    };
    useYard.getState().commit(next);
    makePlan();
  }

  function applyOpening(patch: Partial<typeof measure>) {
    setMeasure(patch);
    const next = { ...useYard.getState().measure, ...patch };
    const rise = parseInch(next.archRise ?? "") || 4;
    const low = parseInch(next.lowSide ?? "") || project.overall.height * 0.66;
    const ask: SpaceAsk = {
      shape: next.spaceShape ?? "rectangle",
      archRise: rise,
      lowSide: low,
      outlet: next.outletOn
        ? { x: parseInch(next.outletX ?? "") || 6, y: parseInch(next.outletY ?? "") || 12, width: parseInch(next.outletW ?? "") || 4.5, height: parseInch(next.outletH ?? "") || 2.75 }
        : null,
      baseboard: next.baseboardOn
        ? { height: parseInch(next.baseboardH ?? "") || 3.5, depth: parseInch(next.baseboardD ?? "") || 0.5 }
        : null,
    };
    const before = snap();
    useYard.getState().commit(applySpaceCuts(project, ask));
    makePlan();
    setSummary(changeLine(before, snap()) || "Opening cut updated");
  }

  function addSupport() {
    const before = snap();
    generate(`${project.prompt} with a center divider`, project.primaryMaterialId, undefined, { restock: true });
    makePlan();
    setSummary(changeLine(before, snap()) || "middle support added");
  }

  function shrinkToFit() {
    const typed = parseInch(measure.openingWidth ?? "");
    const opening = Number.isFinite(typed) ? typed : openingW;
    if (!opening || !Number.isFinite(opening)) return;
    const c = parseInch(measure.clearance ?? "");
    const clearanceIn = Number.isFinite(c) ? c : 0.125;
    const next = pieceFromOpening(opening, clearanceIn);
    setMeasure({ width: fieldInch(next), clearance: fieldInch(clearanceIn), openingWidth: fieldInch(opening) });
    liveIfFitted(0);
    setSummary(`Piece is ${fieldInch(next)}" wide, ${fieldInch(clearanceIn)}" clear a side`);
  }

  const shelfN = facts.shelves ?? 0;
  const cubbyN = facts.cubbies ?? 0;
  const drawerN = facts.drawers ?? 0;
  const dividers = project.panels.filter((p) => p.type === "divider").length;
  const thick = stock?.dims.thickness ?? 0.75;
  const inner = cubbyN > 1 ? clearOpening(pieceW, thick, Math.max(0, cubbyN - 1)) / cubbyN : clearOpening(pieceW, thick, dividers);
  const clearH = shelfN > 0 ? ((Number.isFinite(hNum) ? hNum : project.overall.height) - thick * (shelfN + 2)) / Math.max(1, shelfN + 1) : NaN;
  const shoe = /\bshoes?\b/i.test(project.prompt || project.name);

  const thicknessChoices = useMemo(() => {
    if (!stock) return [];
    const seen = new Set<number>();
    return FORGE_CATALOG.filter((item) => {
      if (!item.canCut || item.formFactor !== stock.formFactor || item.category !== stock.category) return false;
      const thick = item.dims.thickness ?? item.dims.diameter;
      if (!thick || seen.has(thick)) return false;
      seen.add(thick);
      return true;
    }).sort((a, b) => (a.dims.thickness ?? a.dims.diameter ?? 0) - (b.dims.thickness ?? b.dims.diameter ?? 0));
  }, [stock]);

  const stockChoices = useMemo(() => {
    const seen = new Set<string>();
    return FORGE_CATALOG.filter((item) => {
      if (!item.canCut || item.id === "wire-frame") return false;
      if (!stockFitsClass(`${item.name} ${item.id}`, facts)) return false;
      if (seen.has(item.formFactor)) return false;
      seen.add(item.formFactor);
      return true;
    }).slice(0, 8);
  }, []);

  return (
    <div className={`p-4 ${phone ? "max-h-[50vh] overflow-y-auto" : ""}`} style={phone ? { maxHeight: "50vh" } : undefined} data-yard-measure-panel="1" data-yard-measure-tabs={tabs.map((t) => t.id).join(",")} data-yard-measure-phone={phone ? "1" : "0"}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-fg">Measure</h2>
        <button type="button" onClick={() => { undo(); makePlan(); setSummary(""); }} className="inline-flex h-11 min-h-11 min-w-11 items-center px-3 text-sm text-muted hover:text-fg">
          Undo
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{blurb({ isPocket, isCorner, isSlope, slopeDeg, project, envOpts })}</p>

      {phone ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" disabled={step === 0} onClick={() => setStep((n) => Math.max(0, n - 1))} className="h-12 min-w-16 rounded-md border border-border px-3 text-sm disabled:opacity-40">
            Back
          </button>
          <p className="text-sm text-fg">{tabs[step]?.label}</p>
          <button type="button" disabled={step >= tabs.length - 1} onClick={() => setStep((n) => Math.min(tabs.length - 1, n + 1))} className="h-12 min-w-16 rounded-md border border-border px-3 text-sm disabled:opacity-40">
            Next
          </button>
        </div>
      ) : (
        <div role="tablist" aria-label="Measure" className="mt-3 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={shown === t.id}
              data-yard-measure-tab={t.id}
              onClick={() => setTab(t.id)}
              className={`h-9 rounded-full border px-3 text-xs ${shown === t.id ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {summary ? <p className="mt-3 text-sm text-fg" data-yard-measure-summary="1">{summary}</p> : null}
      {measureNote ? <p className="mt-2 text-sm leading-relaxed text-fg">{measureNote}</p> : null}

      {shown === "space" && (
        <section className="mt-4" data-yard-measure-section="space">
          <Sketch openingW={openingW} pieceW={pieceW} height={Number.isFinite(hNum) ? hNum : project.overall.height} depth={Number.isFinite(dNum) ? dNum : project.overall.depth} shape={isCorner ? "corner" : measure.spaceShape === "arch" ? "arch" : measure.spaceShape === "slope" || isSlope ? "sloped" : shape === "flared" ? "flared" : "rectangle"} notch={notchSide} outlet={Boolean(measure.outletOn)} baseboard={Boolean(measure.baseboardOn)} />
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">Top and front</p>
          {spare.line ? <p className="mt-1 text-[11px] text-muted">{spare.line}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Inch label={isPocket ? "Back wall" : "Opening wide"} value={isPocket ? measure.backWidth ?? "" : measure.openingWidth ?? fieldInch(openingW)} onChange={(v) => { setMeasure(isPocket ? { backWidth: v } : { openingWidth: v }); }} onCommit={() => liveIfFitted(0)} />
            <Inch label={isPocket ? "Ceiling" : "Opening tall"} value={isPocket ? measure.ceiling ?? measure.height : measure.openingHeight ?? measure.height} onChange={(v) => { setMeasure(isPocket ? { ceiling: v } : { openingHeight: v }); }} onCommit={() => liveIfFitted(0)} />
            {isPocket ? (
              <>
                <Inch label="Left depth" value={measure.leftDepth ?? ""} onChange={(v) => setMeasure({ leftDepth: v })} onCommit={() => liveIfFitted(0)} />
                <Inch label="Right depth" value={measure.rightDepth ?? ""} onChange={(v) => setMeasure({ rightDepth: v })} onCommit={() => liveIfFitted(0)} />
              </>
            ) : (
              <Inch label="Opening deep" value={measure.openingDepth ?? measure.depth} onChange={(v) => setMeasure({ openingDepth: v })} />
            )}
            <Inch label="Clearance a side" value={measure.clearance ?? "1/8"} onChange={(v) => setMeasure({ clearance: v })} />
          </div>
          <button type="button" className="mt-2 inline-flex h-11 min-h-11 items-center text-xs text-fg underline" onClick={() => {
            const ow = parseInch(measure.openingWidth ?? "");
            const oh = parseInch(measure.openingHeight ?? "");
            const od = parseInch(measure.openingDepth ?? "");
            const c = parseInch(measure.clearance ?? "") || 0.125;
            setMeasure({
              ...(Number.isFinite(ow) ? { width: fieldInch(Math.max(1, ow - c * 2)) } : {}),
              ...(Number.isFinite(oh) ? { height: fieldInch(Math.max(1, oh - c * 2)) } : {}),
              ...(Number.isFinite(od) ? { depth: fieldInch(Math.max(1, od - c * 2)) } : {}),
            });
            liveIfFitted(0);
          }}>Fit the piece inside the opening</button>
          {isPocket && (
            <>
              <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">Shape of the hole</p>
              <Segmented
                label="Shape of the hole"
                value={shape}
                options={[["straight", "Straight"], ["flared", "Flared"]]}
                onChange={(v) => {
                  const flared = v === "flared";
                  const keep = flared && pocketSrc && !flaredNow;
                  setMeasure({
                    pocketShape: v as "straight" | "flared",
                    ...(keep ? { leftAngle: measure.leftAngle && measure.leftAngle !== "0" ? measure.leftAngle : "10", rightAngle: measure.rightAngle && measure.rightAngle !== "0" ? measure.rightAngle : "5" } : {}),
                  });
                  liveIfFitted(0);
                }}
              />
              {shape === "flared" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Inch label="Left flare" unit="°" value={measure.leftAngle ?? ""} onChange={(v) => setMeasure({ leftAngle: v })} onCommit={() => liveIfFitted(0)} />
                  <Inch label="Right flare" unit="°" value={measure.rightAngle ?? ""} onChange={(v) => setMeasure({ rightAngle: v })} onCommit={() => liveIfFitted(0)} />
                </div>
              )}
            </>
          )}
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">Opening cut</p>
          <Segmented
            label="Opening cut"
            value={measure.spaceShape ?? "rectangle"}
            options={[["rectangle", "Rectangle"], ["arch", "Arch"], ["slope", "Slope"]]}
            onChange={(v) => applyOpening({ spaceShape: v as "rectangle" | "arch" | "slope", archRise: measure.archRise || "4", lowSide: measure.lowSide || fieldInch(project.overall.height * 0.66) })}
          />
          {measure.spaceShape === "arch" && (
            <Inch label="Arch rise" value={measure.archRise ?? "4"} onChange={(v) => setMeasure({ archRise: v })} onCommit={() => applyOpening({ archRise: measure.archRise })} />
          )}
          {measure.spaceShape === "slope" && (
            <Inch label="Low side" value={measure.lowSide ?? ""} onChange={(v) => setMeasure({ lowSide: v })} onCommit={() => applyOpening({ lowSide: measure.lowSide })} />
          )}
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">In the way</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <button type="button" className={`h-12 rounded-full border px-3 text-xs ${measure.outletOn ? "border-fg/40 text-fg" : "border-border text-muted"}`} onClick={() => applyOpening({ outletOn: !measure.outletOn, outletX: measure.outletX || "6", outletY: measure.outletY || "12", outletW: measure.outletW || "4 1/2", outletH: measure.outletH || "2 3/4" })}>Outlet</button>
            <button type="button" className={`h-12 rounded-full border px-3 text-xs ${measure.baseboardOn ? "border-fg/40 text-fg" : "border-border text-muted"}`} onClick={() => applyOpening({ baseboardOn: !measure.baseboardOn, baseboardH: measure.baseboardH || "3 1/2", baseboardD: measure.baseboardD || "1/2" })}>Baseboard</button>
          </div>
          {measure.outletOn && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Inch label="Outlet from left" value={measure.outletX ?? "6"} onChange={(v) => setMeasure({ outletX: v })} onCommit={() => applyOpening({})} />
              <Inch label="Outlet up" value={measure.outletY ?? "12"} onChange={(v) => setMeasure({ outletY: v })} onCommit={() => applyOpening({})} />
              <Inch label="Outlet wide" value={measure.outletW ?? "4 1/2"} onChange={(v) => setMeasure({ outletW: v })} onCommit={() => applyOpening({})} />
              <Inch label="Outlet tall" value={measure.outletH ?? "2 3/4"} onChange={(v) => setMeasure({ outletH: v })} onCommit={() => applyOpening({})} />
            </div>
          )}
          {measure.baseboardOn && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Inch label="Baseboard tall" value={measure.baseboardH ?? "3 1/2"} onChange={(v) => setMeasure({ baseboardH: v })} onCommit={() => applyOpening({})} />
              <Inch label="Baseboard deep" value={measure.baseboardD ?? "1/2"} onChange={(v) => setMeasure({ baseboardD: v })} onCommit={() => applyOpening({})} />
            </div>
          )}
          {isPocket && (
            <Segmented
              label="Notch in the hole"
              value={notchSide}
              options={[["none", "None"], ["left", "Left corner"], ["right", "Right corner"], ["back", "Along back"]]}
              onChange={(v) => {
                const side = v as "none" | "left" | "right" | "back";
                setMeasure({
                  notchSide: side,
                  ...(side !== "none" && !measure.notchWidth ? { notchWidth: "6" } : {}),
                  ...(side !== "none" && !measure.notchDepth ? { notchDepth: "4" } : {}),
                  ...(side !== "none" && !measure.notchHeight ? { notchHeight: side === "back" ? "36" : String(pocketSrc?.walls.height ?? 96) } : {}),
                });
                liveIfFitted(0);
              }}
            />
          )}
          {notchSide !== "none" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Inch label="Notch wide" value={measure.notchWidth ?? ""} onChange={(v) => setMeasure({ notchWidth: v })} onCommit={() => liveIfFitted(0)} />
              <Inch label="Notch deep" value={measure.notchDepth ?? ""} onChange={(v) => setMeasure({ notchDepth: v })} onCommit={() => liveIfFitted(0)} />
              <Inch label="From the floor" value={measure.notchHeight ?? ""} onChange={(v) => setMeasure({ notchHeight: v })} onCommit={() => liveIfFitted(0)} />
              <Inch label="From the left" value={measure.leftBay ?? ""} onChange={(v) => setMeasure({ leftBay: v })} onCommit={() => liveIfFitted(0)} />
            </div>
          )}
          {measure.kind === "window_rough_opening" && (
            <label className="mt-3 block text-xs text-muted">
              Stock window
              <select
                value={measure.windowId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const unit = STOCK_WINDOWS.find((w) => w.id === id);
                  setMeasure({
                    windowId: id || undefined,
                    width: unit ? String(unit.roW) : measure.width,
                    height: unit ? String(unit.roH) : measure.height,
                    depth: unit ? String(unit.jambDepth) : measure.depth,
                  });
                  liveIfFitted();
                }}
                className="mt-1 h-12 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg"
              >
                <option value="">Match by RO size…</option>
                {STOCK_WINDOWS.map((w) => (
                  <option key={w.id} value={w.id}>{windowLabel(w)} — RO {w.roW}×{w.roH}</option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {shown === "piece" && (
        <section className="mt-4" data-yard-measure-section="piece">
          <button
            type="button"
            data-yard-fit={fit.tone}
            onClick={() => document.querySelector(`[data-yard-field="${fit.field}"]`)?.scrollIntoView({ block: "center" })}
            className={`mb-2 inline-flex min-h-11 items-center rounded-full border px-3 text-left text-xs ${fit.tone === "green" ? "border-emerald-700/50 text-emerald-300" : "border-amber-600/50 text-amber-200"}`}
          >
            {fit.text}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <Inch
              field="width"
              label={roundUnit ? "Across" : isPocket ? "Along the back" : isCorner ? "Wall A" : "Wide"}
              value={measure.width}
              hint={yardsPick(facts.typed?.width, Boolean(touched.width)) ? "Yard's pick" : undefined}
              onChange={(v) => { scaleLocked(roundUnit ? "width" : "width", v); if (roundUnit) setMeasure({ width: v, depth: v }); }}
              onCommit={() => liveIfFitted(0)}
            />
            <Inch
              field="height"
              label={isSlope ? "High" : "Tall"}
              value={measure.height}
              hint={yardsPick(facts.typed?.height, Boolean(touched.height)) ? "Yard's pick" : undefined}
              onChange={(v) => { scaleLocked("height", v); }}
              onCommit={() => liveIfFitted(0)}
            />
            {!roundUnit && (
              <Inch
                field="depth"
                label={isPocket ? "Comes out" : isCorner ? "Wall B" : "Deep"}
                value={measure.depth}
                hint={yardsPick(facts.typed?.depth, Boolean(touched.depth)) ? "Yard's pick" : undefined}
                onChange={(v) => { scaleLocked("depth", v); }}
                onCommit={() => liveIfFitted(0)}
              />
            )}
          </div>
          <button type="button" onClick={() => setLock((v) => !v)} className={`mt-3 h-12 rounded-full border px-3 text-xs ${lock ? "border-fg/40 text-fg" : "border-border text-muted"}`}>
            {lock ? "Proportions locked" : "Lock proportions"}
          </button>
          {presets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="h-12 rounded-full border border-border px-3 text-xs text-muted hover:text-fg"
                  onClick={() => {
                    setMeasure({
                      ...(p.width != null ? { width: fieldInch(p.width) } : {}),
                      ...(p.height != null ? { height: fieldInch(p.height) } : {}),
                      ...(p.depth != null ? { depth: fieldInch(p.depth) } : {}),
                    });
                    setTouched({ width: p.width != null, height: p.height != null, depth: p.depth != null });
                    liveIfFitted(0);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {isCorner && <Inch label="Angle" unit="°" value={measure.angle ?? ""} onChange={(v) => setMeasure({ angle: v })} />}
          {isSlope && <Inch label="Low" value={measure.lowSide ?? ""} onChange={(v) => setMeasure({ lowSide: v })} />}
          {!isPocket && (
            <label className="mt-3 block text-xs text-muted">
              This is a
              <select value={measure.kind} onChange={(e) => { setMeasure({ kind: e.target.value as SpaceKind }); }} className="mt-1 h-12 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg">
                <option value="closet_niche">Closet / alcove</option>
                <option value="window_rough_opening">Window rough opening</option>
                <option value="desk">Desk</option>
                <option value="workbench">Workbench</option>
                <option value="media">Media / TV</option>
                <option value="table">Table</option>
                <option value="bench">Bench</option>
                <option value="lounge_chair">Lounge chair</option>
                <option value="ottoman">Ottoman</option>
                <option value="rocking_chair">Rocking chair</option>
                <option value="shoe_rack">Shoe rack</option>
                <option value="bookcase">Bookcase</option>
                <option value="wall_cabinet">Wall cabinet</option>
                <option value="shelving_alcove">Shelving niche</option>
                <option value="general_volume">General volume</option>
              </select>
            </label>
          )}
        </section>
      )}

      {shown === "inside" && (
        <section className="mt-4" data-yard-measure-section="inside">
          <p className="text-[11px] text-muted">{bayClearTalk(inner, clearH, shoe) || "Count what is inside. Even spacing splits the opening."}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Count label="Shelves" value={shelfN} onChange={(n) => applyInside({ shelves: n })} />
            <Count label="Cubbies" value={cubbyN} onChange={(n) => applyInside({ cubbies: n })} />
            <Count label="Drawers" value={drawerN} onChange={(n) => applyInside({ drawers: n })} />
          </div>
          <Segmented label="Spacing" value={spacing} options={[["even", "Even"], ["each", "Set each"]]} onChange={(v) => setSpacing(v as "even" | "each")} />
          {spacing === "each" && shelfN > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Array.from({ length: Math.min(shelfN, 6) }, (_, i) => (
                <Inch key={i} label={`Shelf ${i + 1} up`} value={measure.shelfAt?.[i] ?? ""} onChange={(v) => {
                  const shelfAt = [...(measure.shelfAt ?? [])];
                  shelfAt[i] = v;
                  setMeasure({ shelfAt });
                  placeShelves(shelfAt);
                }} />
              ))}
            </div>
          )}
          {isPocket && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Inch label="Left shelves" value={measure.leftBay ?? ""} onChange={(v) => setMeasure({ leftBay: v })} onCommit={() => liveIfFitted(0)} />
              <Inch label="Right shelves" value={measure.rightBay ?? ""} onChange={(v) => setMeasure({ rightBay: v })} onCommit={() => liveIfFitted(0)} />
            </div>
          )}
        </section>
      )}

      {shown === "stock" && (
        <section className="mt-4" data-yard-measure-section="stock">
          <p className="text-sm text-fg">{stock?.name ?? "Stock"}{thickness ? ` · ${fieldInch(thickness)} thick` : ""}</p>
          <p className="mt-1 text-[11px] text-muted">Pick a class. The build keeps its size and its noun.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {stockChoices.map((item) => (
              <button
                key={item.id}
                type="button"
                data-yard-stock={item.id}
                onClick={() => {
                  const before = snap();
                  generate(project.prompt || project.name, item.id, undefined, { restock: true, keepView: true });
                  makePlan();
                  setSummary(changeLine(before, snap()) || `Stock is ${item.name}`);
                }}
                className={`h-12 rounded-full border px-3 text-xs ${item.id === project.primaryMaterialId ? "border-fg/40 text-fg" : "border-border text-muted"}`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">Thickness</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {thicknessChoices.map((item) => (
              <button key={item.id} type="button" data-yard-thickness={item.id} className={`h-11 min-h-11 rounded-full border px-3 text-xs ${item.id === project.primaryMaterialId ? "border-fg/40 text-fg" : "border-border text-muted"}`} onClick={() => {
                const before = snap();
                generate(project.prompt || project.name, item.id, undefined, { restock: true, keepView: true });
                makePlan();
                setSummary(changeLine(before, snap()) || `Thickness is ${fieldInch(item.dims.thickness ?? item.dims.diameter ?? 0)}`);
              }}>
                {fieldInch(item.dims.thickness ?? item.dims.diameter ?? 0)}"
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">Joints</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(["screw", "pocket", "dowel", "biscuit", "glue"] as ShopJoin[]).map((id) => (
              <button key={id} type="button" onClick={() => pickJoin(id)} className={`h-12 min-h-11 rounded-full border px-3 text-xs ${project.shopJoin === id ? "border-fg/40 text-fg" : "border-border text-muted"}`}>
                {id === "screw" ? "Screws" : id === "pocket" ? "Pocket holes" : id === "dowel" ? "Dowels" : id === "biscuit" ? "Biscuits" : "Glue"}
              </button>
            ))}
          </div>
        </section>
      )}

      {warnings.map((w) => (
        <p key={w.id} className="mt-3 text-[11px] leading-snug text-muted" data-yard-measure-warn={w.id}>
          {w.text}{" "}
          <button type="button" className="inline-flex min-h-11 items-center text-fg underline" onClick={() => {
            if (w.id === "span") addSupport();
            else if (w.id === "narrow-seat") { setMeasure({ width: "16" }); liveIfFitted(0); }
            else if (w.id === "shallow-shelf") { setMeasure({ depth: "11" }); liveIfFitted(0); }
            else shrinkToFit();
          }}>
            {w.fix}
          </button>
        </p>
      ))}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="h-12 min-h-11 rounded-md border border-border text-sm text-muted" onClick={() => { saveBuild({ prompt: project.prompt, measure, stockId: project.primaryMaterialId, join: project.shopJoin }); setSummary("Saved on this phone"); }}>Save</button>
        <button type="button" className="h-12 min-h-11 rounded-md border border-border text-sm text-muted" onClick={() => { const url = shareUrl({ prompt: project.prompt, measure, stockId: project.primaryMaterialId, join: project.shopJoin }); void navigator.clipboard?.writeText(url); setSummary("Link copied"); }}>Share</button>
      </div>
      <button type="button" onClick={resetTab} className="mt-4 h-12 w-full rounded-md border border-border text-sm text-muted">
        Reset this tab
      </button>
      <button type="button" onClick={apply} className="mt-2 h-12 w-full rounded-md bg-accent text-sm font-medium text-accent-fg">
        {isPocket ? "Refit this pocket" : "Refit this build"}
      </button>
      {isPocket && (
        <button
          type="button"
          onClick={() => {
            generate(POCKET_DREAM, undefined, undefined, { fresh: true });
            makePlan();
            useYard.getState().revealBench();
            onBuilt();
          }}
          className="mt-2 h-12 w-full rounded-md border border-border text-sm text-muted hover:text-fg"
        >
          Load the example pocket
        </button>
      )}
    </div>
  );

  function pickJoin(join: ShopJoin) {
    const before = useYard.getState().plan ?? makePlan() ?? useYard.getState().plan;
    const method = join === "dowel" ? "pin" : join === "glue" || join === "biscuit" ? "glue" : "screw";
    setJoinMethod(method);
    const projectNow = useYard.getState().project;
    useYard.getState().commit({ ...projectNow, shopJoin: join, joinMethod: method });
    const after = makePlan();
    const line = before && after ? planDiffLine(before, after) : "";
    setSummary(line || "Join updated");
  }
}

function blurb({ isPocket, isCorner, isSlope, slopeDeg, project, envOpts }: {
  isPocket: boolean;
  isCorner: boolean;
  isSlope: boolean;
  slopeDeg?: number;
  project: { prompt: string; fitted?: unknown; kind: string };
  envOpts: Parameters<typeof measureRefitTalk>[0];
}) {
  if (isPocket) return "The hole, the piece, what is inside, and the stock. Change a number and the model, cut list, Buy list and steps refit.";
  const emptyTalk = openingStorageMeasureEmptyTalk(project.prompt);
  if (emptyTalk) return emptyTalk.panelBlurb;
  if (project.fitted) {
    if (isCorner) return "Wall A, wall B, and the height. The angle is the corner those walls make.";
    if (isSlope) return `Wide, deep, the high side, and the low side${slopeDeg != null ? ` — ${slopeDeg}° now` : ""}.`;
    return measureRefitTalk(envOpts).panelBlurb;
  }
  return "Wide, tall, and deep. Change a number and the same build refits — model, cut list, Buy list and steps.";
}

function Sketch({ openingW, pieceW, height, depth, shape, notch, outlet, baseboard }: { openingW?: number; pieceW: number; height: number; depth: number; shape: string; notch: string; outlet?: boolean; baseboard?: boolean }) {
  const ow = openingW && openingW > 0 ? openingW : pieceW;
  const scale = 70 / Math.max(ow, height, 1);
  const pw = Math.min(ow, pieceW) * scale;
  const dw = Math.max(8, depth * scale);
  return (
    <svg viewBox="0 0 180 78" className="mt-2 h-24 w-full rounded-md border border-border bg-bg" aria-label="Opening sketch, top and front">
      <text x="4" y="10" className="fill-current text-[8px] text-faint">Top</text>
      <rect x="22" y="4" width={ow * scale} height={dw} fill="none" stroke="currentColor" className="text-faint" />
      <rect x={22 + (ow * scale - pw) / 2} y={4 + 4} width={pw} height={Math.max(4, dw - 8)} fill="currentColor" className="text-fg/15" />
      {notch !== "none" && <rect x="22" y="4" width="10" height="8" fill="currentColor" className="text-fg/30" />}
      <text x="100" y="10" className="fill-current text-[8px] text-faint">Front</text>
      <rect x="118" y="14" width={ow * scale} height={height * scale} fill="none" stroke="currentColor" className="text-faint" />
      {shape === "sloped" && <line x1="118" y1="28" x2={118 + ow * scale} y2="14" stroke="currentColor" className="text-faint" />}
      {shape === "arch" && <path d={`M118 28 Q${118 + (ow * scale) / 2} 8 ${118 + ow * scale} 28`} fill="none" stroke="currentColor" className="text-faint" />}
      {outlet && <rect x="126" y={14 + height * scale - 22} width="8" height="6" fill="none" stroke="currentColor" className="text-faint" />}
      {baseboard && <rect x="118" y={14 + height * scale - 4} width={ow * scale} height="4" fill="currentColor" className="text-fg/30" />}
      {shape === "corner" && <path d={`M118 ${14 + height * scale} L${118 + ow * scale} ${14 + height * scale} L118 14 Z`} fill="none" stroke="currentColor" className="text-faint" />}
      <rect x={118 + (ow * scale - pw) / 2} y={18} width={pw} height={Math.max(8, height * scale - 8)} fill="currentColor" className="text-fg/15" />
      {notch !== "none" && <rect x="118" y={14 + height * scale - 16} width="10" height="16" fill="currentColor" className="text-fg/30" />}
    </svg>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-1.5 flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} data-yard-choice={v} onClick={() => onChange(v)} className={`h-12 rounded-full border px-3 text-xs ${value === v ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Inch({ label, value, onChange, onCommit, unit = "″", hint, field }: { label: string; value: string; onChange: (v: string) => void; onCommit?: () => void; unit?: string; hint?: string; field?: string }) {
  const [text, setText] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(value);
  }, [value, focus]);
  return (
    <label className="text-xs text-muted" data-yard-field={field}>
      {label}
      {unit}
      {hint ? <span className="ml-1 text-faint">{hint}</span> : null}
      <input
        value={focus ? text : value}
        onFocus={() => { setFocus(true); setText(value); }}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
        onBlur={() => {
          setFocus(false);
          const committed = commitInch(text);
          if (committed.ready) onChange(committed.text);
          onCommit?.();
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        className="mt-1 h-12 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg"
      />
    </label>
  );
}

function Count({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        value={value || ""}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        inputMode="numeric"
        className="mt-1 h-12 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg"
      />
    </label>
  );
}
