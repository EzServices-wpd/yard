"use client";

import { useEffect, useRef } from "react";
import { useYard } from "@/lib/yard/store";
import type { SpaceKind } from "@/lib/yard/types";
import { STOCK_WINDOWS, windowLabel } from "@/lib/yard/windows";
import { POCKET_DREAM } from "@/lib/yard/pocket";
import { isRoundUnitEnvelope, measureChipAxisLabels, openingStorageMeasureEmptyTalk, measureRefitTalk } from "@/lib/yard/voiceHonesty";

export function MeasurePanel({ onBuilt }: { onBuilt: () => void }) {
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
  const measureNote = useYard((s) => s.measureNote);
  const setMeasureOpen = useYard((s) => s.setMeasureOpen);
  const generate = useYard((s) => s.generate);
  const project = useYard((s) => s.project);
  const makePlan = useYard((s) => s.makePlan);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMeasureOpen(true);
    return () => setMeasureOpen(false);
  }, [setMeasureOpen]);

  function liveIfFitted() {
    if (project.kind !== "closet" && project.kind !== "opening") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      applyMeasure();
      makePlan();
    }, 280);
  }

  function apply() {
    applyMeasure(true);
    makePlan();
    onBuilt();
  }

  const isPocket = Boolean(project.pocket);
  const isCorner = Boolean(project.fitted?.unit?.corner) || project.fitted?.unit?.odd?.kind === "angled-corner";
  const isSlope = project.fitted?.unit?.odd?.kind === "sloped";
  const slopeDeg = isSlope ? (project.fitted?.unit?.odd?.params as { angle?: number } | undefined)?.angle : undefined;
  const wNum = parseFloat(measure.width);
  const hNum = parseFloat(measure.height);
  const dNum = parseFloat(measure.depth);
  const envOpts = {
    width: Number.isFinite(wNum) ? wNum : project.overall.width,
    height: Number.isFinite(hNum) ? hNum : project.overall.height,
    depth: Number.isFinite(dNum) ? dNum : project.overall.depth,
    shape: project.fitted?.unit?.shape,
    prompt: project.prompt,
    name: project.name,
  };
  const roundUnit = measureChipAxisLabels(envOpts).mode === "round" || isRoundUnitEnvelope(envOpts);

  const built = project.panels.length > 0 || project.instances.length > 0;
  const title = isPocket ? "The pocket you measured" : built ? "Size" : "Measure a space";

  return (
    <div className="p-4">
      <h2 className="font-display text-lg text-fg">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {(() => {
          if (isPocket) {
            return "The hole is the walls. The build is how much of that hole you want filled — along the back, out from the back, and the shelves on each side.";
          }
          const emptyTalk = openingStorageMeasureEmptyTalk(project.prompt);
          if (emptyTalk) return emptyTalk.panelBlurb;
          if (project.fitted) {
            if (isCorner) return "Wall A, wall B, and the height. The angle is the corner those walls make — just over 20° through just under 170°. 90° is the right triangle.";
            if (isSlope) return `Wide, deep, the high side, and the low side. The plan states the degree those two heights make${slopeDeg != null ? ` — ${slopeDeg}° now` : ""}.`;
            return measureRefitTalk(envOpts).panelBlurb;
          }
          if (project.kind !== "closet" && project.kind !== "opening") {
            return "Wide, tall, and deep. Change a number and it keeps this form.";
          }
          return "Wide, tall, and deep. Change a number and the same closet refits.";
        })()}
      </p>

      {isPocket && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field
            label="Back wall"
            value={measure.backWidth ?? ""}
            onChange={(v) => {
              setMeasure({ backWidth: v });
              liveIfFitted();
            }}
          />
          <Field
            label="Ceiling"
            value={measure.ceiling ?? measure.height}
            onChange={(v) => {
              setMeasure({ ceiling: v });
              liveIfFitted();
            }}
          />
          <Field
            label="Left depth"
            value={measure.leftDepth ?? ""}
            onChange={(v) => {
              setMeasure({ leftDepth: v });
              liveIfFitted();
            }}
          />
          <Field
            label="Right depth"
            value={measure.rightDepth ?? ""}
            onChange={(v) => {
              setMeasure({ rightDepth: v });
              liveIfFitted();
            }}
          />
        </div>
      )}

      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-faint">
        {isPocket ? "How much of the pocket" : roundUnit ? "Round" : "This build"}
      </p>
      {roundUnit ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field
            label="Across"
            value={measure.width}
            onChange={(v) => {
              setMeasure({ width: v, depth: v });
              liveIfFitted();
            }}
          />
          <Field
            label="Tall"
            value={measure.height}
            onChange={(v) => {
              setMeasure({ height: v });
              liveIfFitted();
            }}
          />
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field
            label={isPocket ? "Along the back" : isCorner ? "Wall A" : "Wide"}
            value={measure.width}
            onChange={(v) => {
              setMeasure({ width: v });
              liveIfFitted();
            }}
          />
          <Field
            label={isPocket ? "Tall" : isSlope ? "High" : "Tall"}
            value={measure.height}
            onChange={(v) => {
              setMeasure({ height: v });
              liveIfFitted();
            }}
          />
          <Field
            label={isPocket ? "Comes out" : isCorner ? "Wall B" : "Deep"}
            value={measure.depth}
            onChange={(v) => {
              setMeasure({ depth: v });
              liveIfFitted();
            }}
          />
        </div>
      )}
      {isPocket && (
        <>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field
            label="Left shelves"
            value={measure.leftBay ?? ""}
            onChange={(v) => {
              setMeasure({ leftBay: v });
              liveIfFitted();
            }}
          />
          <Field
            label="Right shelves"
            value={measure.rightBay ?? ""}
            onChange={(v) => {
              setMeasure({ rightBay: v });
              liveIfFitted();
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">Leave the shelves blank and they split the back.</p>
        </>
      )}
      {isCorner && (
        <div className="mt-2">
          <Field
            label="Angle"
            unit="°"
            value={measure.angle ?? ""}
            onChange={(v) => setMeasure({ angle: v })}
          />
        </div>
      )}
      {isSlope && (
        <div className="mt-2">
          <Field
            label="Low"
            value={measure.lowSide ?? ""}
            onChange={(v) => setMeasure({ lowSide: v })}
          />
        </div>
      )}
      {measureNote ? <p className="mt-3 text-sm leading-relaxed text-fg">{measureNote}</p> : null}
      {!isPocket && (
        <label className="mt-3 block text-xs text-muted">
          This is a
          <select
            value={measure.kind}
            onChange={(e) => {
              setMeasure({ kind: e.target.value as SpaceKind });
              liveIfFitted();
            }}
            className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg"
          >
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
            className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg"
          >
            <option value="">Match by RO size…</option>
            {STOCK_WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>
                {windowLabel(w)} — RO {w.roW}×{w.roH}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={apply}
        className="mt-4 h-10 w-full rounded-md bg-accent text-sm font-medium text-accent-fg"
      >
        {isPocket ? "Refit this pocket" : "Fit this opening"}
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
          className="mt-2 h-10 w-full rounded-md border border-border text-sm text-muted hover:text-fg"
        >
          Load the example pocket
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  unit = "″",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <label className="text-xs text-muted">
      {label}
      {unit}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg"
      />
    </label>
  );
}
