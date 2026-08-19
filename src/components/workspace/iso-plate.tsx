"use client";

import { useMemo } from "react";
import { isoMarks, isoViewBox } from "@/lib/yard/iso";
import { stepInstanceIds } from "@/lib/yard/assembly";
import type { AssemblyStep, YardProject } from "@/lib/yard/types";

export function IsoPlate({
  project,
  step,
  className,
}: {
  project: YardProject;
  step?: AssemblyStep;
  className?: string;
}) {
  const ids = step ? stepInstanceIds(project, step) : [];
  const box = useMemo(() => isoViewBox(project, ids), [project, ids.join("|")]);
  const marks = useMemo(() => isoMarks(project, ids), [project, ids.join("|")]);

  return (
    <svg
      viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
      className={`rounded-sm bg-paper ${className ?? ""}`}
      aria-hidden
    >
      {marks.map((m, i) => (
        <line
          key={i}
          x1={m.x1}
          y1={m.y1}
          x2={m.x2}
          y2={m.y2}
          className={m.hot ? "stroke-ink" : "stroke-rule"}
          strokeWidth={m.hot ? 1.8 : 0.85}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
