"use client";

import { useYard } from "@/lib/yard/store";
import { isRoundUnitEnvelope, measureChipAxisLabels, openingStorageMeasureEmptyTalk } from "@/lib/yard/voiceHonesty";

/**
 * Size fields for the bench Options menu. Leaving a field refits the build:
 * a closet keeps its carcase, a weekend form keeps its shape, both take the numbers.
 */
export function MeasureFields() {
  const measure = useYard((s) => s.measure);
  const setMeasure = useYard((s) => s.setMeasure);
  const applyMeasure = useYard((s) => s.applyMeasure);
  const makePlan = useYard((s) => s.makePlan);
  const project = useYard((s) => s.project);

  const canSize =
    project.kind === "closet" ||
    project.kind === "opening" ||
    !!project.fitted ||
    !!project.pocket ||
    project.instances.length > 0 ||
    project.panels.length > 0;

  if (!canSize) return null;

  function commitLive() {
    applyMeasure();
    makePlan();
  }

  const w = parseFloat(measure.width);
  const h = parseFloat(measure.height);
  const d = parseFloat(measure.depth);
  const envOpts = {
    width: Number.isFinite(w) ? w : project.overall.width,
    height: Number.isFinite(h) ? h : project.overall.height,
    depth: Number.isFinite(d) ? d : project.overall.depth,
    shape: project.fitted?.unit?.shape,
    prompt: project.prompt,
    name: project.name,
  };
  const chip = measureChipAxisLabels(envOpts);
  const round = chip.mode === "round" || isRoundUnitEnvelope(envOpts);
  const emptyTalk = openingStorageMeasureEmptyTalk(project.prompt);

  return (
    <div>
      <div data-yard-measure-chip={chip.mode} className="flex flex-wrap items-end gap-2">
        {round ? (
          <>
            <Dim
              label="Dia"
              value={measure.width}
              onChange={(v) => setMeasure({ width: v, depth: v })}
              onBlur={commitLive}
            />
            <span className="mb-2 text-faint">×</span>
            <Dim
              label="H"
              value={measure.height}
              onChange={(v) => setMeasure({ height: v })}
              onBlur={commitLive}
            />
          </>
        ) : (
          <>
            <Dim
              label="W"
              value={measure.width}
              onChange={(v) => setMeasure({ width: v })}
              onBlur={commitLive}
            />
            <span className="mb-2 text-faint">×</span>
            <Dim
              label="H"
              value={measure.height}
              onChange={(v) => setMeasure({ height: v })}
              onBlur={commitLive}
            />
            <span className="mb-2 text-faint">×</span>
            <Dim
              label="D"
              value={measure.depth}
              onChange={(v) => setMeasure({ depth: v })}
              onBlur={commitLive}
            />
          </>
        )}
        <span className="mb-2.5 text-xs text-faint">{round ? "dia × H in" : "in"}</span>
        {emptyTalk && (
          <span className="mb-2 w-full text-[11px] leading-snug text-muted">{emptyTalk.overlayHint}</span>
        )}
        {project.windowPkg && (
          <span className="mb-2 w-full text-[11px] leading-snug text-muted">
            {project.windowPkg.window.brand} {project.windowPkg.window.line} {project.windowPkg.window.callW}×
            {project.windowPkg.window.callH} · RO {project.windowPkg.window.roW}" × {project.windowPkg.window.roH}" ·
            unit {project.windowPkg.window.unitW}" × {project.windowPkg.window.unitH}"
          </span>
        )}
        {project.pocket && (
          <span className="mb-2 w-full text-[11px] leading-snug text-muted">
            Pocket back {project.pocket.walls.backWidth}" · L {project.pocket.walls.leftDepth}" @{" "}
            {project.pocket.walls.leftAngleDeg.toFixed(1)}° · R {project.pocket.walls.rightDepth}" @{" "}
            {project.pocket.walls.rightAngleDeg.toFixed(1)}°
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
