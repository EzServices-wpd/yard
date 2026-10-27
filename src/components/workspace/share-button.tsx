"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Share2 } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { headerAxes, headerName } from "@/lib/yard/pdf";
import { permalink } from "@/lib/yard/shareBuild";
import { revealState, subscribeReveal } from "./reveal-clock";
import { scrubTrack } from "./build-scrub";
import { CLIP_FAILED, COPY_FAILED, clipType, copyText, fileRoute, recordClip, refocusShare, setShare, shareFileName, shareText, shareToken, stillImage } from "./share-clip";

// The sheet (vaul) loads on the first Share tap only, and takes everything it shows as props: 0 KB on first paint.
const ShareSheet = lazy(() => import("./share-sheet"));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const benchCanvas = () => document.querySelector<HTMLCanvasElement>("[data-bench-host] canvas");

async function sendFile(blob: Blob, name: string, text: ReturnType<typeof shareText>) {
  const file = new File([blob], name, { type: blob.type });
  if (fileRoute(navigator, file) === "share") {
    try { return void (await navigator.share({ files: [file], title: text.title, text: text.text })); } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * Share (PR 11, plan L516–522): a bench button under Watch it build, opening a sheet with the link (native share
 * sheet, copy as the fallback), the still image and the 6 s clip recorded on this device. Like Watch it build's
 * button it is not a bench card (the fit never counts it), so the closed framing is release's exactly.
 * No price, no store links; the name is the engine's build name. Reduced motion: no clip, the still and the link.
 */
export function ShareButton() {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  const pending = useYard((s) => s.building || s.grokBusy);
  const walking = useYard((s) => s.workMode === "walk");
  const revealing = useSyncExternalStore(subscribeReveal, () => revealState().active, () => false);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const [framed, setFramed] = useState(false);
  const [ms, setMs] = useState<number | null>(null);
  const [clip, setClip] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const closed = useRef(true);
  closed.current = !open;
  const name = headerName(project);
  const url = useMemo(() => (asked && !project.displayOnly ? permalink(project, window.location.origin) : null), [asked, project]);
  const track = useMemo(() => (asked ? scrubTrack(project, plan) : null), [asked, project, plan]);
  const type = useMemo(() => (asked ? clipType({ recorder: typeof MediaRecorder === "undefined" ? undefined : MediaRecorder, capture: "captureStream" in HTMLCanvasElement.prototype, reduced: reducedMotion() }) : null), [asked]);
  const text = shareText(name, url);

  // The fit counts the sheet once it has slid in (the card key gains "h"); closing drops it at once.
  useEffect(() => {
    if (!open) { setFramed(false); setShare({ open: false }); return; }
    const t = window.setTimeout(() => { setFramed(true); setShare({ open: true }); }, reducedMotion() ? 0 : 520);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => () => setShare({ open: false, turn: null }), []);
  useEffect(() => setClip(null), [project]);
  useEffect(() => { if (pending || walking || revealing) setOpen(false); }, [pending, walking, revealing]);
  if (pending || walking || revealing || (!project.panels.length && !project.instances.length)) return null;

  const record = async () => {
    const gl = benchCanvas();
    if (!gl || !track || !type) return;
    setClip(null); setMs(0); setShare({ open: false });
    try {
      setClip(await recordClip(gl, track, name, type, { onTick: setMs, cancelled: () => closed.current }));
    } catch {
      // The recorder could not be made or started here: say so plainly and drop the clip button (no console error).
      setFailed(true);
    } finally {
      setMs(null);
      if (!closed.current) setShare({ open: true });
    }
  };
  const still = async () => {
    const gl = benchCanvas();
    const blob = gl && (await stillImage(gl, name));
    if (blob) await sendFile(blob, shareFileName(name, "png"), text);
  };
  return (
    <>
      <button
        type="button"
        ref={button}
        data-yard-share="closed"
        aria-label="Share this build"
        aria-haspopup="dialog"
        onClick={() => { setAsked(true); setOpen(true); }}
        className="absolute right-3 top-[6.25rem] z-20 inline-flex size-11 items-center justify-center gap-1.5 rounded-full border border-border bg-surface/90 text-sm text-fg shadow-lg backdrop-blur hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:top-16 sm:w-auto sm:px-4"
      >
        <Share2 className="size-4" aria-hidden /> <span className="max-sm:sr-only">Share</span>
      </button>
      {asked && (
        <Suspense fallback={null}>
          <ShareSheet
            open={open}
            onOpenChange={setOpen}
            host={document.querySelector<HTMLElement>("[data-bench-host]")}
            card={framed && ms == null}
            name={name}
            size={headerAxes(project)}
            preview={shareToken(url) ? `/api/og?y=${shareToken(url)}` : null}
            url={url}
            canShare={!!url && typeof navigator.share === "function"}
            onShareLink={() => void navigator.share(text).catch(() => {})}
            onStill={() => void still()}
            ms={ms}
            clip={type && track ? (failed ? null : clip ? "ready" : "idle") : null}
            clipNote={failed ? CLIP_FAILED : null}
            copyFailed={COPY_FAILED}
            onCopy={() => copyText(navigator.clipboard, url ?? "")}
            onClosed={() => { if (refocusShare(document.activeElement, document.body)) button.current?.focus({ preventScroll: true }); }}
            onRecord={() => void record()}
            onShareClip={() => clip && void sendFile(clip, shareFileName(name, clip.type.includes("mp4") ? "mp4" : "webm"), text)}
          />
        </Suspense>
      )}
    </>
  );
}
