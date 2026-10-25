import { useEffect, useRef, useState, type ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import type { IdeaCard } from "@/lib/ideas/feed";
import type { HeroModel } from "./HeroStage";
import { CardSize, plainClick } from "./IdeaCard";

const EVENTS = ["pointerdown", "scroll", "keydown", "touchstart"] as const;
type Stage = ComponentType<{ model: HeroModel; active: boolean; onReady: () => void }>;

/** Live 3D only where it is cheap: not on Save-Data, not on low-memory phones, and only when the model is baked. */
function canGoLive() {
  const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (n.connection?.saveData) return false;
  if (typeof n.deviceMemory === "number" && n.deviceMemory < 4) return false;
  return typeof WebGLRenderingContext !== "undefined";
}

/**
 * Ideas hero: one build, drawn first (its baked plan drawing is the LCP, server-rendered, no JS), then the
 * live model fades in over it in the same reserved 4:3 box once the page is idle and the hero is on screen.
 * It turns slowly, and stops when offscreen, when the tab is hidden, or under reduced motion (still pose).
 */
export function IdeaHero({ card, href, onBuild, live = true }: { card: IdeaCard; href: string; onBuild: () => void; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ C: Stage; model: HeroModel } | null>(null);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  const modelUrl = card.drawing?.model;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    const vis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rm = () => setStill(mq.matches);
    rm();
    mq.addEventListener("change", rm);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); mq.removeEventListener("change", rm); };
  }, []);

  // Load the live model only after the page has loaded and gone idle, and only once the hero is seen.
  useEffect(() => {
    if (!live || !modelUrl || !onScreen || stage || !canGoLive()) return;
    let cancelled = false;
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idle = 0, timer = 0;
    // The model waits for the first touch, scroll or key, or 4 s after load: the page settles (and is
    // interactive) before three.js parses, so the live hero never costs the phone its first paint or input.
    const kick = () => {
      window.clearTimeout(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, kick));
      idle = w.requestIdleCallback ? w.requestIdleCallback(load, { timeout: 1500 }) : window.setTimeout(load, 200);
    };
    const go = () => {
      timer = window.setTimeout(kick, 4000);
      EVENTS.forEach((e) => window.addEventListener(e, kick, { once: true, passive: true }));
    };
    const load = () => {
      void Promise.all([import("./HeroStage"), fetch(modelUrl).then((r) => r.json() as Promise<HeroModel>)])
        .then(([mod, model]) => { if (!cancelled) setStage({ C: mod.default, model }); })
        .catch(() => {});
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", go);
      window.clearTimeout(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, kick));
      if (idle) { if (w.cancelIdleCallback) w.cancelIdleCallback(idle); else window.clearTimeout(idle); }
    };
  }, [live, modelUrl, onScreen, stage]);

  const C = stage?.C;
  return (
    <section className="mt-6 grid items-center gap-4 rounded-2xl border border-rule bg-paper p-3 sm:mt-8 sm:grid-cols-[1fr_1.3fr] sm:gap-8 sm:p-6" data-ideas-hero={card.slug} aria-labelledby="ideas-hero-title">
      <div className="order-2 sm:order-1">
        <h2 id="ideas-hero-title" className="font-display text-2xl leading-tight text-ink sm:text-3xl">{card.title}</h2>
        <p className="mt-1"><CardSize card={card} /></p>
        {card.blurb ? <p className="mt-2 max-w-md text-base leading-relaxed text-ink">{card.blurb}</p> : null}
        <a
          href={href}
          onClick={(e) => {
            if (!plainClick(e)) return;
            e.preventDefault();
            onBuild();
          }}
          data-ideas-hero-build
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-transform duration-150 active:scale-[0.97]"
        >
          Build this <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
      <div ref={box} className="relative order-1 aspect-[4/3] w-full overflow-hidden rounded-xl bg-[rgb(247,244,238)] sm:order-2" data-hero-live={ready ? "1" : undefined}>
        {card.drawing ? (
          <img
            src={card.drawing.src}
            alt={`${card.title}, drawn from Yard's model`}
            width={card.drawing.w}
            height={card.drawing.h}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-contain transition-opacity duration-500 ease-out"
            style={{ opacity: ready ? 0 : 1 }}
          />
        ) : null}
        {C && stage ? (
          <div className="absolute inset-0 transition-opacity duration-500 ease-out" style={{ opacity: ready ? 1 : 0 }} aria-hidden>
            <C model={stage.model} active={onScreen && visible && !still} onReady={() => setReady(true)} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
