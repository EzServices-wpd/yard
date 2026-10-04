"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useYard } from "@/lib/yard/store";
import type { JoinMethod, SpaceKind } from "@/lib/yard/types";
import { STOCK_WINDOWS, windowLabel } from "@/lib/yard/windows";
import { POCKET_DREAM } from "@/lib/yard/pocket";
import { isRoundUnitEnvelope, measureChipAxisLabels, openingStorageMeasureEmptyTalk, measureRefitTalk } from "@/lib/yard/voiceHonesty";
import { parseInch, fieldInch } from "@/lib/yard/inchText";
import { getCatalogItem, FORGE_CATALOG } from "@/lib/yard/catalog";
import { planDiffLine } from "@/lib/yard/shopJoin";
import type { ShopJoin } from "@/lib/yard/shopJoin";
import {
  bayClearTalk,
  changeLine,
  classPresets,
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
  const spare = clearanceTalk(openingW ?? NaN, pieceW, clearance);
  const shelfSpan = Math.max(0, ...project.panels.filter((p) => p.type === "shelf").map((p) => Math.max(p.size.width, p.size.depth)));
  const warnings = measureWarnings({
    shelfSpan,
    hasDivider: project.panels.some((p) => p.type === "divider") || Boolean(project.supportOffer?.included),
    openingW,
    pieceW,
    clearance,
  });
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
  }

  function resetTab() {
    const raw = tabSnap.current[shown];
    if (!raw) return;
    setMeasure(JSON.parse(raw));
    liveIfFitted(0);
  }

  function applyInside(patch: { shelves?: number; cubbies?: number; drawers?: number }) {
    const before = snap();
    const fitted = project.fitted ?? project.recastFrom?.fitted;
    const pocket = project.pocket ?? project.recastFrom?.pocket;
    if (pocket && patch.shelves != null) {
      generate(project.prompt, project.primaryMaterialId, undefined, {
        fresh: true,
        restock: true,
        pocketOverride: { ...pocket, unit: { ...pocket.unit, shelfRows: Math.max(1, Math.round(patch.shelves / 2)) } },
      });
    } else if (fitted) {
      generate(project.prompt, project.primaryMaterialId, undefined, {
        fresh: true,
        restock: true,
        honorUnit: true,
        fittedOverride: {
          ...fitted,
          unit: {
            ...fitted.unit,
            shelfCount: patch.shelves ?? fitted.unit.shelfCount,
            cubbies: patch.cubbies ?? fitted.unit.cubbies,
            drawersPerBank: patch.drawers != null ? Math.max(1, Math.ceil(patch.drawers / 2)) : fitted.unit.drawersPerBank,
          },
        },
      });
    }
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

  function addSupport() {
    const before = snap();
    generate(`${project.prompt} with a center divider`, project.primaryMaterialId, undefined, { restock: true });
    makePlan();
    setSummary(changeLine(before, snap()) || "middle support added");
  }

  function shrinkToFit() {
    if (!openingW) return;
    const next = Math.max(1, openingW - clearance * 2);
    setMeasure({ width: fieldInch(next) });
    liveIfFitted(0);
  }

  const shelfN = facts.shelves ?? 0;
  const cubbyN = facts.cubbies ?? 0;
  const drawerN = facts.drawers ?? 0;
  const dividers = project.panels.filter((p) => p.type === "divider").length;
  const thick = stock?.dims.thickness ?? 0.75;
  const inner = cubbyN > 1 ? clearOpening(pieceW, thick, Math.max(0, cubbyN - 1)) / cubbyN : clearOpening(pieceW, thick, dividers);
  const clearH = shelfN > 0 ? ((Number.isFinite(hNum) ? hNum : project.overall.height) - thick * (shelfN + 2)) / Math.max(1, shelfN + 1) : NaN;
  const shoe = /\bshoes?\b/i.test(project.prompt || project.name);

  const stockChoices = useMemo(() => {
    const seen = new Set<string>();
    return FORGE_CATALOG.filter((item) => {
      if (!item.canCut || item.id === "wire-frame") return false;
      if (seen.has(item.formFactor)) return false;
      seen.add(item.formFactor);
      return true;
    }).slice(0, 8);
  }, []);

  return (
    <div className="p-4" data-yard-measure-panel="1" data-yard-measure-tabs={tabs.map((t) => t.id).join(",")} data-yard-measure-phone={phone ? "1" : "0"}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-fg">Measure</h2>
        <button type="button" onClick={() => { undo(); makePlan(); }} className="text-xs text-muted hover:text-fg">
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
          <Sketch openingW={openingW} pieceW={pieceW} height={Number.isFinite(hNum) ? hNum : project.overall.height} shape={measure.spaceShape ?? (isCorner ? "corner" : isSlope ? "sloped" : shape === "flared" ? "flared" : "rectangle")} notch={notchSide} />
          {spare.line ? <p className="mt-1 text-[11px] text-muted">{spare.line}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Inch label={isPocket ? "Back wall" : "Opening wide"} value={isPocket ? measure.backWidth ?? "" : fieldInch(openingW)} onChange={(v) => { setMeasure(isPocket ? { backWidth: v } : { width: v }); liveIfFitted(); }} />
            <Inch label={isPocket ? "Ceiling" : "Opening tall"} value={isPocket ? measure.ceiling ?? measure.height : measure.height} onChange={(v) => { setMeasure(isPocket ? { ceiling: v } : { height: v }); liveIfFitted(); }} />
            {isPocket ? (
              <>
                <Inch label="Left depth" value={measure.leftDepth ?? ""} onChange={(v) => { setMeasure({ leftDepth: v }); liveIfFitted(); }} />
                <Inch label="Right depth" value={measure.rightDepth ?? ""} onChange={(v) => { setMeasure({ rightDepth: v }); liveIfFitted(); }} />
              </>
            ) : (
              <Inch label="Opening deep" value={measure.depth} onChange={(v) => { setMeasure({ depth: v }); liveIfFitted(); }} />
            )}
            <Inch label="Clearance a side" value={measure.clearance ?? "1/8"} onChange={(v) => setMeasure({ clearance: v })} />
          </div>
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
                  <Inch label="Left flare" unit="°" value={measure.leftAngle ?? ""} onChange={(v) => { setMeasure({ leftAngle: v }); liveIfFitted(); }} />
                  <Inch label="Right flare" unit="°" value={measure.rightAngle ?? ""} onChange={(v) => { setMeasure({ rightAngle: v }); liveIfFitted(); }} />
                </div>
              )}
            </>
          )}
          {!isPocket && (
            <Segmented
              label="Shape"
              value={measure.spaceShape ?? (isCorner ? "corner" : isSlope ? "sloped" : "rectangle")}
              options={[["rectangle", "Rectangle"], ["arched", "Arched top"], ["sloped", "Sloped ceiling"], ["corner", "Corner"]]}
              onChange={(v) => setMeasure({ spaceShape: v as "rectangle" | "arched" | "sloped" | "corner" })}
            />
          )}
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-faint">In the way</p>
          <Segmented
            label="In the way"
            value={notchSide === "none" ? "none" : "pipe"}
            options={[["none", "Clear"], ["baseboard", "Baseboard"], ["outlet", "Outlet"], ["pipe", "Pipe or notch"]]}
            onChange={(v) => {
              if (v === "pipe" || v === "baseboard") {
                setMeasure({ notchSide: "back", notchDepth: measure.notchDepth || "4", notchHeight: measure.notchHeight || (v === "baseboard" ? "4" : "36") });
              } else if (v === "none") setMeasure({ notchSide: "none" });
              liveIfFitted(0);
            }}
          />
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
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Inch label="Notch wide" value={measure.notchWidth ?? ""} onChange={(v) => { setMeasure({ notchWidth: v }); liveIfFitted(); }} />
              <Inch label="Notch deep" value={measure.notchDepth ?? ""} onChange={(v) => { setMeasure({ notchDepth: v }); liveIfFitted(); }} />
              <Inch label="Notch tall" value={measure.notchHeight ?? ""} onChange={(v) => { setMeasure({ notchHeight: v }); liveIfFitted(); }} />
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
          <div className="grid grid-cols-3 gap-2">
            <Inch
              label={roundUnit ? "Across" : isPocket ? "Along the back" : isCorner ? "Wall A" : "Wide"}
              value={measure.width}
              hint={yardsPick(facts.typed?.width, Boolean(touched.width)) ? "Yard's pick" : undefined}
              onChange={(v) => { scaleLocked(roundUnit ? "width" : "width", v); if (roundUnit) setMeasure({ width: v, depth: v }); liveIfFitted(); }}
            />
            <Inch
              label={isSlope ? "High" : "Tall"}
              value={measure.height}
              hint={yardsPick(facts.typed?.height, Boolean(touched.height)) ? "Yard's pick" : undefined}
              onChange={(v) => { scaleLocked("height", v); liveIfFitted(); }}
            />
            {!roundUnit && (
              <Inch
                label={isPocket ? "Comes out" : isCorner ? "Wall B" : "Deep"}
                value={measure.depth}
                hint={yardsPick(facts.typed?.depth, Boolean(touched.depth)) ? "Yard's pick" : undefined}
                onChange={(v) => { scaleLocked("depth", v); liveIfFitted(); }}
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
              <select value={measure.kind} onChange={(e) => { setMeasure({ kind: e.target.value as SpaceKind }); liveIfFitted(); }} className="mt-1 h-12 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg">
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
              <Inch label="Left shelves" value={measure.leftBay ?? ""} onChange={(v) => { setMeasure({ leftBay: v }); liveIfFitted(); }} />
              <Inch label="Right shelves" value={measure.rightBay ?? ""} onChange={(v) => { setMeasure({ rightBay: v }); liveIfFitted(); }} />
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
          <button type="button" className="text-fg underline" onClick={() => (w.id === "span" ? addSupport() : shrinkToFit())}>
            {w.fix}
          </button>
        </p>
      ))}

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

function Sketch({ openingW, pieceW, height, shape, notch }: { openingW?: number; pieceW: number; height: number; shape: string; notch: string }) {
  const ow = openingW && openingW > 0 ? openingW : pieceW;
  const scale = 120 / Math.max(ow, 1);
  const pw = Math.min(ow, pieceW) * scale;
  return (
    <svg viewBox="0 0 160 90" className="mt-2 h-24 w-full rounded-md border border-border bg-bg" aria-label="Opening sketch">
      <rect x="16" y="10" width={ow * scale} height="70" fill="none" stroke="currentColor" className="text-faint" />
      {shape === "sloped" && <line x1="16" y1="28" x2={16 + ow * scale} y2="10" stroke="currentColor" className="text-faint" />}
      {shape === "corner" && <path d={`M16 80 L${16 + ow * scale} 80 L16 10 Z`} fill="none" stroke="currentColor" className="text-faint" />}
      <rect x={16 + (ow * scale - pw) / 2} y="18" width={pw} height="54" fill="currentColor" className="text-fg/15" />
      {notch !== "none" && <rect x="16" y="48" width="18" height="32" fill="currentColor" className="text-fg/30" />}
      <text x="16" y="88" className="fill-current text-[8px] text-faint">{fieldInch(height)} tall</text>
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

function Inch({ label, value, onChange, unit = "″", hint }: { label: string; value: string; onChange: (v: string) => void; unit?: string; hint?: string }) {
  const [text, setText] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(value);
  }, [value, focus]);
  return (
    <label className="text-xs text-muted">
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
