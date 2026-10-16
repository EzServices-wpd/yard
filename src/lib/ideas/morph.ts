/**
 * Tap morph (PR-PLAN PR 3, follow-up): the card's drawing grows toward the workspace stage on the
 * tap's own frame, and the navigation, route code and stage mount happen behind it. The growth is a
 * compositor animation (transform only) on a fixed copy of the drawing, so a busy main thread while the
 * workspace mounts can't hold it back. When the stage is up, the copy settles onto its real box and
 * fades (opacity), and the stage's own step reveal carries on underneath.
 *
 * Why not the View Transition API any more: its update callback freezes the page on the old snapshot
 * until the new route has mounted, so the visual began ~640 ms after the tap at 390 (PR 62 regrade).
 * Reduced motion, or no drawing to morph from: plain navigation.
 */
export const MORPH_MS = 280;
export const SETTLE_MS = 160;
const STAGE = "[data-bench-host]";
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const KEY = "yard:stage-rect";

export function reducedMotion() {
  return typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Box = { left: number; top: number; width: number; height: number };
/** Where the stage will be: last seen at this viewport size, else the bench's usual box (below the bars, above the tray). */
export function stageGuess(vw: number, vh: number, remembered?: string | null): Box {
  try {
    const r = remembered ? (JSON.parse(remembered) as Box & { vw: number; vh: number }) : null;
    if (r && r.vw === vw && r.vh === vh) return r;
  } catch { /* fall through */ }
  const top = vw < 640 ? 120 : 92;
  const bottom = vw < 640 ? vh * 0.62 : vh * 0.86;
  return { left: 0, top, width: vw, height: Math.max(120, bottom - top) };
}

/** Uniform scale + translate putting box a (centred) into box b, as a transform from a's own place. */
export function into(a: Box, b: Box) {
  const s = Math.min(b.width / a.width, b.height / a.height);
  return { s, dx: b.left + b.width / 2 - (a.left + (a.width * s) / 2), dy: b.top + b.height / 2 - (a.top + (a.height * s) / 2) };
}

async function stage(): Promise<HTMLElement | null> {
  for (let i = 0; i < 90; i++) {
    const el = document.querySelector<HTMLElement>(STAGE);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return null;
}

export async function morphTo(from: HTMLElement | null | undefined, nav: () => Promise<unknown> | void): Promise<void> {
  if (!from || reducedMotion()) {
    await nav();
    return;
  }
  const a = from.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let remembered: string | null = null;
  try { remembered = sessionStorage.getItem(KEY); } catch { /* private mode */ }
  const guess = stageGuess(vw, vh, remembered);
  const img = from.querySelector<HTMLImageElement>("img.idea-wood");
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.dataset.ideaMorph = "1";
  Object.assign(ghost.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, zIndex: "60", pointerEvents: "none", transformOrigin: "0 0", background: "rgb(247,244,238)", borderRadius: "8px", overflow: "hidden", willChange: "transform, opacity" });
  if (img) {
    const c = img.cloneNode() as HTMLImageElement;
    c.removeAttribute("loading");
    Object.assign(c.style, { position: "static", width: "100%", height: "100%", objectFit: "contain", opacity: "1" });
    ghost.appendChild(c);
  }
  document.body.appendChild(ghost);
  const g = into(a, guess);
  const grow = ghost.animate(
    [{ transform: "none" }, { transform: `translate(${g.dx}px, ${g.dy}px) scale(${g.s})` }],
    { duration: MORPH_MS, easing: EASE, fill: "forwards" },
  );
  // The navigation starts after the growth is handed to the compositor (next frame), never before.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  try {
    await nav();
    const to = await stage();
    await grow.finished.catch(() => {});
    if (!to) return;
    const b = to.getBoundingClientRect();
    try { sessionStorage.setItem(KEY, JSON.stringify({ left: b.left, top: b.top, width: b.width, height: b.height, vw, vh })); } catch { /* ignore */ }
    const t = into(a, b);
    await ghost.animate(
      [{ transform: `translate(${g.dx}px, ${g.dy}px) scale(${g.s})`, opacity: 1 }, { transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.s})`, opacity: 0 }],
      { duration: SETTLE_MS, easing: "ease-out", fill: "forwards" },
    ).finished.catch(() => {});
  } finally {
    ghost.remove();
  }
}
