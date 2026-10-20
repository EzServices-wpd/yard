import { useLayoutEffect, useRef } from "react";
import type { DrawingRef } from "@/lib/ideas/feed";

/** One observer for every card: a drawing inks once, when a third of it is on screen. */
let io: IntersectionObserver | null = null;
function observe(el: Element) {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("inked"); io?.unobserve(e.target); }
    },
    { threshold: 0.35 },
  );
  io.observe(el);
  return () => io?.unobserve(el);
}

/**
 * The build's real drawing (the plan overview, baked at build time). A pencil copy (the same file, greyed
 * and faint, a static filter) sits under the wood;
 * scrolling in fades the wood up over them. A drawing already on screen at load shows in wood at once
 * (no flash), reduced motion always does. The 4:3 box is reserved, so nothing shifts (CLS 0).
 */
export function IdeaDrawing({ drawing, title, eager = false }: { drawing: DrawingRef | null; title: string; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !drawing) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0) {
      el.classList.add("inked", "instant");
      return;
    }
    return observe(el);
  }, [drawing]);
  return (
    <div ref={ref} className="idea-ink relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[rgb(247,244,238)]">
      {drawing ? (
        <>
          <img src={drawing.src} alt="" aria-hidden width={drawing.w} height={drawing.h} loading={eager ? "eager" : "lazy"} decoding="async" className="idea-pencil absolute inset-0 size-full object-contain" />
          <img src={drawing.src} alt={`${title}, drawn from Yard's model`} width={drawing.w} height={drawing.h} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} className="idea-wood absolute inset-0 size-full object-contain" />
        </>
      ) : (
        // Quick win (e): a build with no baked drawing yet is never a blank card: its name, drawn in pencil.
        <div data-idea-no-drawing="1" className="absolute inset-0 grid place-items-center p-4 text-center">
          <span className="font-display text-xl leading-tight text-[rgb(120,110,96)]">{title}</span>
        </div>
      )}
    </div>
  );
}
