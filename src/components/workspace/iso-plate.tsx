"use client";

import { useMemo } from "react";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "@/lib/yard/iso";
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
  const key = ids.join("|");
  const box = useMemo(() => isoViewBox(project, ids), [project, key]);
  const marks = useMemo(() => isoMarks(project, ids), [project, key]);
  const dims = useMemo(() => isoDims(project, ids), [project, key]);
  const faces = useMemo(() => isoFaces(project, ids), [project, key]);
  const caption = useMemo(() => isoCaption(project, ids, step), [project, key, step?.title]);
  const fs = Math.max(1.6, box.w * 0.042);

  return (
    <span className={`flex flex-col ${className ?? ""}`}>
      <svg
        viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
        className="h-full min-h-0 w-full rounded-sm bg-paper"
        aria-hidden
      >
        {faces.map((f, i) => (
          <polygon
            key={`f${i}`}
            points={f.points}
            fill={f.hot ? "#d9cbb0" : "#ece6da"}
            opacity={f.hot ? 0.9 : 0.4}
          />
        ))}
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
        {dims.map((d, i) => (
          <g key={`d${i}`}>
            <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} className="stroke-muted" strokeWidth={0.55} />
            <text
              x={d.lx}
              y={d.ly - fs * 0.12}
              textAnchor="middle"
              fontSize={fs}
              className="fill-ink"
              style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            >
              {d.label}
            </text>
          </g>
        ))}
      </svg>
      {caption && (
        <span className="mt-0.5 block truncate text-center font-mono text-[10px] leading-tight text-muted">
          {caption}
        </span>
      )}
    </span>
  );
}
