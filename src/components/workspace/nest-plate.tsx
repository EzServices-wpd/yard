"use client";

import { sheetSizeLabel, type NestSheet } from "@/lib/yard/nesting";
import { nestLabelLayout } from "@/lib/yard/inchText";
import { overlaps } from "@/components/workspace/cut-focus";

/** On-plan sheet: same letters as the cut list, laid on the matching 4×8 or 4×10. */
/**
 * Linked to the cut list (UX plan item 8, uniform connectedness): every piece of the active letter
 * gets one accent outline, ticked letters fade back, and each piece is a button that picks its row.
 */
export function NestPlate({
  sheet,
  sheetCount,
  active,
  focus,
  done,
  onPick,
  backer = false,
}: {
  sheet: NestSheet;
  sheetCount?: number;
  active?: string | null;
  /** Part ids in focus (partIds); a piece without partIds falls back to its letter. */
  focus?: ReadonlySet<string>;
  backer?: boolean;
  done?: Set<string>;
  onPick?: (letter: string) => void;
}) {
  const sw = sheet.width || 96;
  const sh = sheet.height || 48;
  const usedPct = Math.round((sheet.utilization ?? 0) * 100);
  const of = sheetCount && sheetCount > 1 ? ` of ${sheetCount}` : "";
  const size = sheetSizeLabel(sheet).replace("x", "×");
  const label = `${backer ? '1/4" backer sheet' : "Sheet"} ${sheet.index}${of} · ${sheet.material || (backer ? '1/4" plywood' : '3/4" plywood')} · ${size} · ${usedPct}% used · 1/8" kerf`;

  return (
    <figure className="yard-sheet overflow-hidden rounded-md border border-border bg-paper" data-yard-nest={backer ? `backer-${sheet.index}` : sheet.index}>
      <svg
        viewBox={`0 0 ${sw} ${sh}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        <rect x={0} y={0} width={sw} height={sh} className="fill-paper" stroke="#a08c6e" strokeWidth={0.35} />
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
          const on = overlaps(p, focus ?? new Set(), active ?? null);
          const L = nestLabelLayout(p);
          const cx = p.x + p.width / 2;
          const cy = p.y + p.height / 2;
          const fs = L.fontSize;
          return (
            <g
              key={p.id}
              data-yard-sheet-letter={p.label ?? ""}
              data-active={on ? "1" : undefined}
              data-part-ids={p.partIds?.join(" ") || undefined}
              role={onPick && p.label ? "button" : undefined}
              tabIndex={onPick && p.label ? 0 : undefined}
              aria-label={onPick && p.label ? `${p.label}: ${p.name}${done?.has(p.label) ? ", cut" : ""}. Show its row` : undefined}
              aria-pressed={onPick && p.label ? on : undefined}
              onClick={onPick && p.label ? () => onPick(p.label!) : undefined}
              onKeyDown={onPick && p.label ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.label!); } } : undefined}
              className={onPick && p.label ? "yard-sheet-piece cursor-pointer" : undefined}
              style={{ opacity: p.label && done?.has(p.label) ? 0.35 : 1 }}
            >
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill="#e8dcc4"
                stroke="#a08c6e"
                strokeWidth={0.22}
              />
              <rect
                x={p.x + 0.4}
                y={p.y + 0.4}
                width={Math.max(0, p.width - 0.8)}
                height={Math.max(0, p.height - 0.8)}
                fill="none"
                strokeWidth={0.8}
                className="yard-sheet-hl stroke-mark"
                style={{ opacity: on ? 1 : 0 }}
              />
              <text
                x={L.x}
                y={L.y}
                textAnchor={L.anchor}
                transform={L.rotate ? `rotate(${L.rotate} ${L.x} ${L.y})` : undefined}
                fontFamily="Newsreader, Times New Roman, serif"
                fontWeight={600}
                fontSize={fs}
                className="fill-ink"
              >
                {L.text}
              </text>
              {L.dims && (
                <text
                  x={cx}
                  y={cy + fs * 0.85}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                  fontSize={Math.min(2.4, fs * 0.42)}
                  className="fill-ink-muted"
                >
                  {L.dims}
                </text>
              )}
              {L.name && (
                <text
                  x={cx}
                  y={cy + fs * 1.45}
                  textAnchor="middle"
                  fontFamily="Newsreader, Times New Roman, serif"
                  fontSize={Math.min(2.2, fs * 0.38)}
                  className="fill-ink-muted"
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
