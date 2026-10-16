import type { IdeaCard as Card } from "@/lib/ideas/feed";
import { IdeaDrawing } from "./IdeaDrawing";

/** One card anatomy for every idea: drawing, title, size, one line. The whole card is the button. */
export function IdeaCard({ card, onOpen, eager, showCount = false }: { card: Card; onOpen: () => void; eager?: boolean; showCount?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-idea={card.slug}
      data-build-type={card.buildType}
      className="yard-paper group flex h-full min-h-11 w-full flex-col rounded-xl border border-rule bg-paper p-2.5 text-left hover:border-ink/35 sm:p-3"
    >
      <IdeaDrawing drawing={card.drawing} title={card.title} eager={eager} />
      <span className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-base leading-tight text-ink group-hover:underline sm:text-lg">{card.title}</span>
        {card.status === "new" ? <span className="shrink-0 text-xs text-ink-muted">New</span> : null}
      </span>
      <span className="mt-0.5 line-clamp-1 font-mono text-xs tracking-tight text-ink">{card.stock ?? card.size}</span>
      {card.blurb ? <span className="mt-1.5 line-clamp-2 hidden text-sm leading-snug text-ink-muted sm:block">{card.blurb}</span> : null}
      {showCount && card.count > 0 ? <span className="mt-1 text-xs text-ink-muted">Built {card.count}×</span> : null}
    </button>
  );
}
