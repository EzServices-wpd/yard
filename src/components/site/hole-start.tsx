import { useMemo, useState } from "react";
import { readSpace, type SpaceMeasure } from "@/lib/yard/hole";

const FIELDS: { key: keyof SpaceMeasure; label: string; placeholder: string }[] = [
  { key: "wide", label: "Wide", placeholder: "31.5" },
  { key: "tall", label: "Tall", placeholder: "78" },
  { key: "deep", label: "Deep", placeholder: "16" },
  { key: "along", label: "Other wall", placeholder: "24" },
  { key: "high", label: "High side", placeholder: "60" },
  { key: "low", label: "Low side", placeholder: "30" },
];

function num(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const EMPTY: SpaceMeasure = { wide: null, tall: null, deep: null, along: null, high: null, low: null };

export function HoleStart({ onPick }: { onPick: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const measure = useMemo<SpaceMeasure>(() => {
    const m = { ...EMPTY };
    for (const f of FIELDS) m[f.key] = num(values[f.key] ?? "");
    return m;
  }, [values]);

  const read = useMemo(() => readSpace(measure), [measure]);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-ink underline decoration-rule underline-offset-[5px] hover:decoration-ink"
      >
        {open ? "Close the space" : "Start with a space"}
      </button>
      {open ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-ink-muted">
            Every measurement you have. Leave the rest blank.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-ink-muted">{f.label}</span>
                <input
                  inputMode="decimal"
                  value={values[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-rule bg-paper px-3 text-base text-ink outline-none ring-ink/20 placeholder:text-ink-muted/70 focus:border-ink/30 focus:ring-2"
                />
              </label>
            ))}
          </div>
          {read?.note ? <p className="mt-3 text-sm leading-relaxed text-ink-muted">{read.note}</p> : null}
          {read && read.line ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">The space</p>
              <p className="mt-1 font-display text-lg text-ink">{read.line}</p>
              {read.models.length ? (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Put something in it</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {read.models.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onPick(o.prompt)}
                        className="rounded-lg border border-rule bg-paper px-3 py-2.5 text-left transition-colors duration-150 hover:border-ink/35 hover:bg-rule/25"
                      >
                        <span className="font-display text-base text-ink">{o.label}</span>
                        <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{o.detail}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
