"use client";

import { useEffect, useRef } from "react";
import { useYard } from "@/lib/yard/store";
import type { SpaceKind } from "@/lib/yard/types";
import { STOCK_WINDOWS, windowLabel } from "@/lib/yard/windows";
import { POCKET_DREAM } from "@/lib/yard/pocket";

export function MeasurePanel({ onBuilt }: { onBuilt: () => void }) {
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
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
    applyMeasure();
    makePlan();
    onBuilt();
  }

  const isPocket = Boolean(project.pocket);

  return (
    <div className="p-4">
      <h2 className="font-display text-lg text-fg">{isPocket ? "The pocket you measured" : "Measure a space"}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {isPocket
          ? "Back wall, left depth, right depth, ceiling. The unit stays a straight box inside the wonky walls."
          : project.fitted
            ? "W × H × D refits this unit. Drawers, knee, doors, and shelves stay."
            : "The opening is on the bench — type into the arrows or these fields."}
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
            value={measure.height}
            onChange={(v) => {
              setMeasure({ height: v });
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
        {isPocket ? "Unit inside the pocket" : "Opening"}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field
          label="W"
          value={measure.width}
          onChange={(v) => {
            setMeasure({ width: v });
            liveIfFitted();
          }}
        />
        <Field
          label="H"
          value={measure.height}
          onChange={(v) => {
            setMeasure({ height: v });
            liveIfFitted();
          }}
        />
        <Field
          label="D"
          value={measure.depth}
          onChange={(v) => {
            setMeasure({ depth: v });
            liveIfFitted();
          }}
        />
      </div>
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
            <option value="media">Media / TV</option>
            <option value="table">Table</option>
            <option value="bench">Bench</option>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
