import { scrubCounter, scrubState, setScrub, type ScrubTrack } from "./build-scrub";

/**
 * Share sheet and 6 s clip (plan L516–525, PR 11). The clip is recorded on the device (canvas.captureStream plus
 * MediaRecorder); nothing is uploaded and no paid service is called. It walks the Watch it build scrub (PR 10), so
 * the order is buildOrder's own, during one slow turn, and ends on the finished build with a made-on-yard.wiki card.
 * No price, no links and no audio in the clip; the title is the engine's build name, never the typed prompt.
 */
export const CLIP_MS = 6000;
/** Steps play over the first 4.2 s; the finished build holds for the rest, the end card fading in from 4.6 s. */
export const BUILD_MS = 4200, CARD_MS = 4600, CLIP_FPS = 30;
/** Night shop palette B (styles.css): ground, card, rule, ink; chalk blue marks the name and never glows. */
export const CLIP_INK = { bg: "#131518", surface: "#1c1f23", border: "#2c3136", fg: "#eceae6", mark: "#7cb2ff" } as const;

/** Scrub position (1..positions) at ms into the clip: steps in plan order, evenly spaced, then the finished build. */
export function clipK(ms: number, positions: number): number {
  if (positions <= 1 || ms >= BUILD_MS) return Math.max(1, positions);
  return Math.min(positions, 1 + Math.floor((Math.max(0, ms) / BUILD_MS) * positions));
}
/** The camera's turn at ms: one eased full turn over the clip, so the last frame is the bench's own angle. */
export function clipTurn(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / CLIP_MS));
  return 2 * Math.PI * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
}
/** End card opacity at ms (0 before 4.6 s, 1 by 5.2 s). */
export const cardAlpha = (ms: number) => Math.min(1, Math.max(0, (ms - CARD_MS) / 600));
/** Clip size from the bench canvas: same aspect, longest side at most 1080, even numbers (encoders need them). */
export function clipSize(w: number, h: number): { w: number; h: number } {
  const s = Math.min(1, 1080 / Math.max(w, h, 1));
  const even = (v: number) => Math.max(2, 2 * Math.round((v * s) / 2));
  return { w: even(w), h: even(h) };
}

/** The first container this browser records (Safari: mp4; Chrome and Firefox: webm), or null: no clip button. */
export function pickClipType(isTypeSupported?: (t: string) => boolean): string | null {
  if (!isTypeSupported) return null;
  return ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => { try { return isTypeSupported(t); } catch { return false; } }) ?? null;
}
/** The clip is offered only with MediaRecorder and canvas capture, and never with reduced motion (they share the still). */
export function clipType(env: { recorder?: { isTypeSupported?: (t: string) => boolean }; capture: boolean; reduced: boolean }): string | null {
  return env.reduced || !env.capture || !env.recorder ? null : pickClipType(env.recorder.isTypeSupported?.bind(env.recorder));
}
/** A file goes out through the native share sheet when it can take it, else it downloads. */
export function fileRoute(nav: { canShare?: (d: { files: File[] }) => boolean } | undefined, file: File): "share" | "download" {
  try { return nav?.canShare?.({ files: [file] }) ? "share" : "download"; } catch { return "download"; }
}

/** What the link, image and clip say: the build's own name and its link. No price, no prompt, no store links. */
export function shareText(name: string, url: string | null) {
  const title = name.trim() || "Yard plan";
  return { title, text: `${title}: a real model with every part, cut and step. Made on yard.wiki`, ...(url ? { url } : {}) };
}
export function shareFileName(name: string, ext: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "yard-plan";
  return `${slug}-yard.${ext}`;
}
/** The ?y= token of a yard.wiki permalink, for its link preview card (/api/og?y=, PR 4). */
export const shareToken = (url: string | null) => (url ? new URL(url).searchParams.get("y") : null);

/** Shared state: the sheet and the recorder write it, the WebGL bench reads it (the fit's card key, the turn). */
export type ShareState = { open: boolean; turn: number | null };
let state: ShareState = { open: false, turn: null };
const subs = new Set<() => void>();
export const shareState = () => state;
export function setShare(next: Partial<ShareState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
export function subscribeShare(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

/** One frame of the shared picture: the bench, the step counter, the yard.wiki mark and (late) the end card. */
export function drawClipFrame(ctx: CanvasRenderingContext2D, gl: HTMLCanvasElement, o: { counter?: string; name: string; card: number }) {
  const { width: w, height: h } = ctx.canvas, u = Math.max(w, h) / 1080;
  ctx.drawImage(gl, 0, 0, w, h);
  ctx.textBaseline = "middle";
  const font = (px: number, wt = 500) => `${wt} ${Math.round(px * u)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  if (o.counter) {
    ctx.font = font(26);
    const tw = ctx.measureText(o.counter).width, x = 28 * u, y = 28 * u, ph = 48 * u;
    ctx.fillStyle = CLIP_INK.surface; ctx.strokeStyle = CLIP_INK.border; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.roundRect(x, y, tw + 36 * u, ph, ph / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CLIP_INK.fg; ctx.fillText(o.counter, x + 18 * u, y + ph / 2);
  }
  if (o.card > 0) {
    const bh = 132 * u;
    ctx.globalAlpha = 0.92 * o.card; ctx.fillStyle = CLIP_INK.bg; ctx.fillRect(0, h - bh, w, bh);
    ctx.globalAlpha = o.card; ctx.fillStyle = CLIP_INK.fg; ctx.font = font(40, 600);
    ctx.fillText(o.name, 36 * u, h - bh + 50 * u, w - 72 * u);
    ctx.font = font(26); ctx.fillStyle = CLIP_INK.fg; ctx.fillText("Made on", 36 * u, h - bh + 96 * u);
    const mw = ctx.measureText("Made on ").width;
    ctx.fillStyle = CLIP_INK.mark; ctx.fillText("yard.wiki", 36 * u + mw, h - bh + 96 * u);
    ctx.globalAlpha = 1;
  } else {
    ctx.font = font(28, 600); ctx.fillStyle = CLIP_INK.mark; ctx.textAlign = "right";
    ctx.fillText("yard.wiki", w - 28 * u, h - 40 * u); ctx.textAlign = "left";
  }
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
/**
 * Record the 6 s clip off the bench canvas (preserveDrawingBuffer is on, so its last frame can be drawn).
 * The Watch it build bar stays hidden (rec), the scale figure and props are off while scrubbing, and when it
 * ends (or is cancelled) the scrub closes and the turn clears, so the bench is back on its own finished frame.
 */
export async function recordClip(gl: HTMLCanvasElement, track: ScrubTrack, name: string, type: string, o: { onTick?: (ms: number) => void; cancelled?: () => boolean } = {}): Promise<Blob | null> {
  const out = sized(gl);
  const ctx = out.getContext("2d")!;
  // Frames go in by hand (captureStream(0) + requestFrame) right after each draw, so the first and last frames are
  // exactly the ones drawn at 0 and 6 s, whatever the device's frame rate.
  const stream = out.captureStream(0);
  const track0 = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  const draw = (ms: number) => {
    const k = clipK(ms, track.positions);
    if (scrubState().k !== k) setScrub({ k });
    setShare({ turn: ms >= CLIP_MS ? 0 : clipTurn(ms) });
    drawClipFrame(ctx, gl, { counter: ms < BUILD_MS ? scrubCounter(track, k) : undefined, name, card: cardAlpha(ms) });
    track0.requestFrame?.();
  };
  try {
    setScrub({ open: true, rec: true, k: 1 });
    // The fit refits for the scrub (0, 60 and 450 ms): start on the settled frame.
    for (let t0 = performance.now(); performance.now() - t0 < 650; ) await frame();
    rec.start();
    const t0 = performance.now();
    for (;;) {
      const ms = Math.min(CLIP_MS, performance.now() - t0);
      if (o.cancelled?.() || document.hidden) { rec.stop(); await done; return null; }
      draw(ms);
      o.onTick?.(ms);
      await frame();
      if (ms >= CLIP_MS) break;
    }
    // The encoder runs a frame or two behind: hand it the held end frame a few more times so stop() never cuts the
    // last real frame (the file then ends at 6 s, not short of it).
    for (let i = 0; i < 3; i++) { track0.requestFrame?.(); await frame(); }
    rec.stop();
    await done;
    return new Blob(chunks, { type: type.split(";")[0] });
  } finally {
    stop();
  }
}
const stop = () => { setShare({ turn: null }); setScrub({ open: false, rec: false, k: 0 }); };
const sized = (gl: HTMLCanvasElement) => {
  const out = document.createElement("canvas"), s = clipSize(gl.width, gl.height);
  out.width = s.w; out.height = s.h;
  return out;
};

/** The still: the bench as it stands now (its own finished frame when nothing is open), with the name and mark. */
export function stillImage(gl: HTMLCanvasElement, name: string): Promise<Blob | null> {
  const out = sized(gl);
  drawClipFrame(out.getContext("2d")!, gl, { name, card: 1 });
  return new Promise((r) => out.toBlob(r, "image/png"));
}
