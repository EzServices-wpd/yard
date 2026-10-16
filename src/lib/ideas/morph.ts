/**
 * Tap morph (PR-PLAN PR 3): the card's drawing grows into the workspace stage in place, then the
 * stage's own step reveal carries on. View Transition API when present, a FLIP clone otherwise.
 * ≤300 ms, transform and opacity only (the group's default width/height animation is replaced).
 * Reduced motion, or no drawing to morph from: plain navigation.
 */
export const MORPH_MS = 280;
export const MORPH_NAME = "idea-morph";
const STAGE = "[data-bench-host]";

type VT = { ready: Promise<void>; finished: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => Promise<void>) => VT };

export function reducedMotion() {
  return typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The stage after navigation commits (a few frames at most; gives up so a tap never hangs). */
async function stage(): Promise<HTMLElement | null> {
  for (let i = 0; i < 20; i++) {
    const el = document.querySelector<HTMLElement>(STAGE);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return null;
}

/** Uniform scale + translate taking box b onto box a (centred), as the "from" transform. */
export function fromTransform(a: DOMRectReadOnly, b: DOMRectReadOnly, originAtB = true) {
  const s = Math.max(a.width / b.width, a.height / b.height);
  const tx = a.left + a.width / 2 - (b.width * s) / 2 - (originAtB ? 0 : b.left);
  const ty = a.top + a.height / 2 - (b.height * s) / 2 - (originAtB ? 0 : b.top);
  return { tx, ty, s };
}

export async function morphTo(from: HTMLElement | null | undefined, nav: () => Promise<unknown> | void): Promise<void> {
  if (!from || reducedMotion()) {
    await nav();
    return;
  }
  const a = from.getBoundingClientRect();
  const doc = document as DocVT;
  if (doc.startViewTransition) {
    let to: HTMLElement | null = null;
    from.style.viewTransitionName = MORPH_NAME;
    document.documentElement.dataset.morph = "1";
    const t = doc.startViewTransition(async () => {
      from.style.viewTransitionName = "";
      await nav();
      to = await stage();
      if (to) to.style.viewTransitionName = MORPH_NAME;
    });
    t.ready
      .then(() => {
        if (!to) return;
        const b = to.getBoundingClientRect();
        const { tx, ty, s } = fromTransform(a, b, false);
        document.documentElement.animate(
          { transform: [`translate(${tx}px, ${ty}px) scale(${s})`, `translate(${b.left}px, ${b.top}px)`] },
          { duration: MORPH_MS, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: `::view-transition-group(${MORPH_NAME})` },
        );
      })
      .catch(() => {});
    await t.finished.catch(() => {});
    const el = to as HTMLElement | null;
    if (el) el.style.viewTransitionName = "";
    delete document.documentElement.dataset.morph;
    return;
  }
  // FLIP: a fixed clone of the drawing at the card, moved and faded onto the stage after it mounts.
  const img = from.querySelector<HTMLImageElement>("img.idea-wood");
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, zIndex: "60", pointerEvents: "none", transformOrigin: "0 0", background: "rgb(247,244,238)", borderRadius: "8px", overflow: "hidden" });
  if (img) {
    const c = img.cloneNode() as HTMLImageElement;
    Object.assign(c.style, { width: "100%", height: "100%", objectFit: "contain", opacity: "1" });
    ghost.appendChild(c);
  }
  document.body.appendChild(ghost);
  try {
    await nav();
    const to = await stage();
    if (!to) return;
    const b = to.getBoundingClientRect();
    const s = Math.min(b.width / a.width, b.height / a.height);
    const dx = b.left + b.width / 2 - (a.left + (a.width * s) / 2);
    const dy = b.top + b.height / 2 - (a.top + (a.height * s) / 2);
    await ghost.animate(
      [{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 }],
      { duration: MORPH_MS, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
    ).finished;
  } finally {
    ghost.remove();
  }
}
