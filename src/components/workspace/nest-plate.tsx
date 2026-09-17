"use client";

import { sheetSizeLabel, type NestSheet } from "@/lib/yard/nesting";

/** On-plan sheet: same letters as the cut list, laid on a 4×8. */
export function NestPlate({ sheet, sheetCount }: { sheet: NestSheet; sheetCount?: number }) {
  const sw = sheet.width || 96;
  const sh = sheet.height || 48;
  const usedPct = Math.round((sheet.utilization ?? 0) * 100);
  const of = sheetCount && sheetCount > 1 ? ` of ${sheetCount}` : "";
  const size = sheetSizeLabel(sheet).replace("x", "×");
  const label = `Sheet ${sheet.index}${of} · ${sheet.material || '3/4" plywood'} · ${size} · ${usedPct}% used · 1/8" kerf`;

  return (
    <figure className="overflow-hidden rounded-md border border-border bg-paper" data-yard-nest={sheet.index}>
      <svg
        viewBox={`0 0 ${sw} ${sh}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        <rect x={0} y={0} width={sw} height={sh} fill="#f3eee4" stroke="#a08c6e" strokeWidth={0.35} />
        {Array.from({ length: Math.floor(sw / 12) - 1 }, (_, i) => (
          <line
            key={i}
            x1={(i + 1) * 12}
            y1={0.6}
            x2={(i + 1) * 12}
            y2={sh - 0.6}
            stroke="#d2c4a8"
            strokeWidth={0.12}
          />
        ))}
        {sheet.parts.map((p) => {
          const cx = p.x + p.width / 2;
          const cy = p.y + p.height / 2;
          const short = Math.min(p.width, p.height);
          const fs = Math.min(7, Math.max(2.4, short * 0.28));
          const showDims = short > 8;
          const showName = short > 12 && Boolean(p.name);
          return (
            <g key={p.id}>
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill="#e8dcc4"
                stroke="#a08c6e"
                strokeWidth={0.22}
              />
              <text
                x={cx}
                y={cy + (showName ? -fs * 0.35 : showDims ? -fs * 0.15 : fs * 0.35)}
                textAnchor="middle"
                fontFamily="Newsreader, Times New Roman, serif"
                fontWeight={600}
                fontSize={fs}
                fill="#1a1612"
              >
                {p.label || "?"}
              </text>
              {showDims && (
                <text
                  x={cx}
                  y={cy + fs * 0.85}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                  fontSize={Math.min(2.4, fs * 0.42)}
                  fill="#6b6358"
                >
                  {p.width.toFixed(1)}×{p.height.toFixed(1)}
                </text>
              )}
              {showName && (
                <text
                  x={cx}
                  y={cy + fs * 1.45}
                  textAnchor="middle"
                  fontFamily="Newsreader, Times New Roman, serif"
                  fontSize={Math.min(2.2, fs * 0.38)}
                  fill="#6b6358"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="border-t border-rule px-3 py-1.5 text-[11px] text-ink-muted">
        {label}
      </figcaption>
    </figure>
  );
}
