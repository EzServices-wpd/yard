/** Frozen linen nest from the live engine (31.5 × 78 × 16, 3/4" 4×8, 1/8" kerf). Not a drawing. */

type Part = { label: string; name: string; x: number; y: number; width: number; height: number };

const SHEETS: { index: number; used: string; parts: Part[] }[] = [
  {
    index: 1,
    used: "91%",
    parts: [
      { label: "C", name: "Left upright", x: 0, y: 0, width: 78, height: 16 },
      { label: "D", name: "Right upright", x: 0, y: 16.125, width: 78, height: 16 },
      { label: "B", name: "Door", x: 0, y: 32.25, width: 78, height: 15.5 },
      { label: "E", name: "Bottom", x: 78.125, y: 0, width: 15.75, height: 30 },
    ],
  },
  {
    index: 2,
    used: "77%",
    parts: [
      { label: "B", name: "Door", x: 0, y: 0, width: 78, height: 15.5 },
      { label: "G", name: "Top", x: 78.125, y: 0, width: 15.75, height: 30 },
      { label: "F", name: "Shelf", x: 0, y: 15.625, width: 15.5, height: 30 },
      { label: "F", name: "Shelf", x: 15.625, y: 15.625, width: 15.5, height: 30 },
      { label: "F", name: "Shelf", x: 31.25, y: 15.625, width: 15.5, height: 30 },
      { label: "F", name: "Shelf", x: 46.875, y: 15.625, width: 30, height: 15.5 },
    ],
  },
];

function Sheet({ index, used, parts }: (typeof SHEETS)[number]) {
  return (
    <figure className="overflow-hidden rounded-lg border border-rule bg-[#f3eee4]" data-yard-landing-nest={index}>
      <svg viewBox="0 0 96 48" className="h-auto w-full" role="img" aria-label={`Sheet ${index} of 2, linen closet, ${used} used`}>
        <rect x="0" y="0" width="96" height="48" fill="#f3eee4" stroke="#a08c6e" strokeWidth="0.35" />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={i} x1={(i + 1) * 12} y1="0.4" x2={(i + 1) * 12} y2="47.6" stroke="#d2c4a8" strokeWidth="0.12" />
        ))}
        {parts.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height} fill="#e7dcc8" stroke="#6b5334" strokeWidth="0.28" />
            <text
              x={p.x + p.width / 2}
              y={p.y + p.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#3d2b1a"
              fontSize={Math.min(4.2, p.height * 0.42)}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {p.label} {p.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="border-t border-rule/80 px-3 py-1.5 font-mono text-[10px] tracking-tight text-ink-muted">
        Sheet {index} of 2 · 3/4″ plywood 4×8 · {used} used · 1/8″ kerf
      </figcaption>
    </figure>
  );
}

export function LinenNestHero() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Cut this 4×8</p>
        <p className="mt-1 font-display text-lg text-ink">Linen closet · 31.5 × 78 × 16</p>
        <p className="mt-1 text-sm text-ink-muted">The real nest. Letters match the cut list. The thin back is a separate 1/4″ sheet.</p>
      </div>
      {SHEETS.map((s) => (
        <Sheet key={s.index} {...s} />
      ))}
    </div>
  );
}
