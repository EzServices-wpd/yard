"use client";

import { useYard } from "@/lib/yard/store";

export function MeasureOverlay() {
  const open = useYard((s) => s.measureOpen);
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
  const makePlan = useYard((s) => s.makePlan);
  const project = useYard((s) => s.project);

  if (!open) return null;

  function commitLive() {
    if (project.kind === "closet" || project.kind === "opening") {
      applyMeasure();
      makePlan();
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-lg flex-wrap items-end gap-2 rounded-md border border-border bg-surface/95 px-3 py-2 shadow-lg backdrop-blur">
        <Dim label="W" value={measure.width} onChange={(v) => setMeasure({ width: v })} onBlur={commitLive} />
        <span className="mb-2 text-faint">×</span>
        <Dim label="H" value={measure.height} onChange={(v) => setMeasure({ height: v })} onBlur={commitLive} />
        <span className="mb-2 text-faint">×</span>
        <Dim label="D" value={measure.depth} onChange={(v) => setMeasure({ depth: v })} onBlur={commitLive} />
        <span className="mb-2.5 text-xs text-faint">in</span>
        {project.windowPkg && (
          <span className="mb-2 w-full text-[11px] leading-snug text-muted">
            {project.windowPkg.window.brand} {project.windowPkg.window.line} {project.windowPkg.window.callW}×
            {project.windowPkg.window.callH} · RO {project.windowPkg.window.roW}" × {project.windowPkg.window.roH}" ·
            unit {project.windowPkg.window.unitW}" × {project.windowPkg.window.unitH}"
          </span>
        )}
        {project.pocket && (
          <span className="mb-2 w-full text-[11px] leading-snug text-muted">
            Pocket back {project.pocket.walls.backWidth}" · L {project.pocket.walls.leftDepth}" @{ " " }
            {project.pocket.walls.leftAngleDeg.toFixed(1)}° · R {project.pocket.walls.rightDepth}" @{ " " }
            {project.pocket.walls.rightAngleDeg.toFixed(1)}° · clear {project.pocket.leftClear.toFixed(1)}" /{" "}
            {project.pocket.rightClear.toFixed(1)}"
          </span>
        )}
      </div>
    </div>
  );
}

function Dim({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="h-9 w-16 rounded-sm border border-border bg-bg px-2 font-mono text-sm text-fg outline-none ring-fg/20 focus:ring-2"
      />
    </label>
  );
}
