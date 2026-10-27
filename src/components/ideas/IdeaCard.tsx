import type { IdeaCard as Card } from "@/lib/ideas/feed";
import { IdeaDrawing } from "./IdeaDrawing";

/** "W × D × H in" in the measure face (spelled out for screen readers), then the note in the text face. */
export function CardSize({ card, className = "" }: { card: Pick<Card, "slug" | "size" | "sizeAria" | "stock">; className?: string }) {
  if (!card.size && !card.stock) return null;
  return (
    <span className={`text-sm text-ink ${className}`}>
      {card.size ? (
        <>
          <span className="yard-measure" data-size={card.slug} aria-hidden>{card.size}</span>
          <span className="sr-only">{card.sizeAria}</span>
        </>
      ) : null}
      {card.stock ? `${card.size ? " · " : ""}${card.stock}` : null}
    </span>
  );
}

/** A plain left click runs the app's own open (the morph); a middle, Ctrl/Cmd or Shift click is the browser's (new tab, window). */
export function plainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** One card anatomy for every idea: drawing, title, size, one line. The whole card is a link to its build (`href`). */
/** `onOpen` gets the drawing box, so the tap can morph it into the workspace stage; `onIntent` prefetches the route. */
export function IdeaCard({ card, href, onOpen, onIntent, eager, showCount = false }: { card: Card; href: string; onOpen: (drawing?: HTMLElement | null) => void; onIntent?: () => void; eager?: boolean; showCount?: boolean }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen(e.currentTarget.querySelector<HTMLElement>(".idea-ink"));
      }}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
      data-idea={card.slug}
      data-build-type={card.buildType}
      className="yard-paper yard-sheet group flex h-full min-h-11 w-full flex-col rounded-xl border border-rule bg-paper p-2.5 text-left hover:border-ink/35 sm:p-3"
    >
      <IdeaDrawing drawing={card.drawing} title={card.title} eager={eager} />
      <span className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-base leading-tight text-ink group-hover:underline sm:text-lg">{card.title}</span>
        {card.status === "new" ? <span className="shrink-0 text-[13px] text-ink-muted">New</span> : null}
      </span>
      <CardSize card={card} className="mt-0.5 line-clamp-2" />
      {card.blurb ? <span className="mt-1.5 line-clamp-2 hidden text-sm leading-snug text-ink sm:block">{card.blurb}</span> : null}
      {showCount && card.count > 0 ? <span className="yard-num mt-1 text-[13px] text-ink-muted">Built {card.count}×</span> : null}
    </a>
  );
}

/**
 * A catalog row (All ideas, and a search hit with no drawing): the engine title and size as one link to its build, never
 * an empty picture box. A type Critic never graded says so. Rows part by space, and a fill tone on hover or focus; no
 * divider line (taste-inspect "hairline"). No transition: the tone changes at once.
 */
export function IdeaRow({ card, href, onOpen, onIntent }: { card: Card; href: string; onOpen: () => void; onIntent?: () => void }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen();
      }}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
      data-idea-row={card.slug}
      data-build-type={card.buildType}
      className="group -mx-2 flex h-full min-h-12 flex-col justify-center rounded-lg px-2 py-2 text-left hover:bg-[var(--yard-fill)] focus-visible:bg-[var(--yard-fill)]"
    >
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-base leading-tight text-ink group-hover:underline">{card.title}</span>
        {card.status === "new" ? <span className="text-[13px] text-ink-muted">New, not checked yet</span> : null}
      </span>
      <CardSize card={card} className="mt-0.5" />
    </a>
  );
}
