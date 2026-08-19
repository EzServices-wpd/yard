"use client";

import { useEffect, useRef } from "react";
import { useYard } from "@/lib/yard/store";
import type { SpaceKind } from "@/lib/yard/types";
import { STOCK_WINDOWS, windowLabel } from "@/lib/yard/windows";

export function MeasurePanel({ onBuilt }: { onBuilt: () => void }) {
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
  const setMeasureOpen = useYard((s) => s.setMeasureOpen);
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
    applyMeasure();
    makePlan();
    onBuilt();
  }

  return (
    <div className="p-4">
      <h2 className="font-display text-lg text-fg">Measure a space</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {project.pocket
          ? "W × H × D is the rectangular unit. The pocket walls stay put — they are the trapezoid. Front face stays parallel to the back wall."
          : project.fitted
            ? "W × H × D refits this unit. The program — drawers, knee, doors, shelves — stays. Same engine as the bathroom pocket."
            : "The opening is on the bench — type into the arrows or these fields. An alcove becomes a closet. A shallow opening becomes a window package."}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Field label="W" value={measure.width} onChange={(v) => { setMeasure({ width: v }); liveIfFitted(); }} />
        <Field label="H" value={measure.height} onChange={(v) => { setMeasure({ height: v }); liveIfFitted(); }} />
        <Field label="D" value={measure.depth} onChange={(v) => { setMeasure({ depth: v }); liveIfFitted(); }} />
      </div>
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
          <option value="shelving_alcove">Shelving niche</option>
          <option value="general_volume">General volume</option>
        </select>
      </label>
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
      <button type="button" onClick={apply} className="mt-4 h-10 w-full rounded-md bg-accent text-sm font-medium text-accent-fg">
        Fit this opening
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-muted">
      {label}″
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg"
      />
    </label>
  );
}
