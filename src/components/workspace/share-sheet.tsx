"use client";

import { useState } from "react";
import { Drawer } from "vaul";

const BTN = "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm text-fg hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";
/** Inline 24 px line icons (lucide's paths): this lazy chunk is vaul and this file only. */
const ICON = { share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13", link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", check: "M20 6 9 17l-5-5", image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM21 15l-5-5L5 21M9 9h.01", video: "m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.76-.43L16 10.5M2 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" };
const Icon = ({ d, className = "" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-4 ${className}`} aria-hidden><path d={d} /></svg>
);

export type ShareSheetProps = {
  open: boolean; onOpenChange: (o: boolean) => void; host: HTMLElement | null;
  /** A bench card the fit avoids: only once slid in, and never while recording. */
  card: boolean;
  name: string; size: string; preview: string | null; url: string | null;
  canShare: boolean; onShareLink: () => void; onStill: () => void;
  /** ms recorded so far (null when not recording); clip: null when this device can't record (or reduced motion). */
  ms: number | null; clip: "idle" | "ready" | null; onRecord: () => void; onShareClip: () => void;
  /** Why there is no clip button (the recorder failed here), and the line shown when a copy fails. */
  clipNote: string | null; copyFailed: string;
  /** Resolves true only once the clipboard has the link. */
  onCopy: () => Promise<boolean>;
  /** The sheet has closed: focus goes back to the Share button. */
  onClosed: () => void;
};

/** The share sheet (vaul, plan L516): presentational only; share-button.tsx owns the link, the still and the clip. */
export default function ShareSheet(p: ShareSheetProps) {
  const [copy, setCopy] = useState<"" | "copied" | "failed">("");
  const copied = copy === "copied";
  const recording = p.ms != null;
  return (
    <Drawer.Root open={p.open} onOpenChange={p.onOpenChange} modal={false} container={p.host}>
      <Drawer.Portal>
        <Drawer.Content
          data-yard-share="open"
          data-bench-overlay={p.card ? "share" : undefined}
          onCloseAutoFocus={(e) => { e.preventDefault(); p.onClosed(); }}
          aria-describedby="yard-share-desc"
          className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md rounded-t-xl border border-b-0 border-border bg-surface px-4 pb-4 pt-2 text-fg shadow-lg outline-none sm:bottom-3 sm:w-[min(28rem,calc(100%-1.5rem))] sm:rounded-xl sm:border-b"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center gap-3">
            {p.preview && <img src={p.preview} alt={`Link preview: ${p.name}`} width={128} height={67} className="h-[67px] w-32 shrink-0 rounded-md border border-border bg-bg object-cover" />}
            <div className="min-w-0">
              <Drawer.Title className="truncate text-sm font-medium">{p.name}</Drawer.Title>
              <Drawer.Description id="yard-share-desc" className="mt-0.5 truncate text-xs text-muted">{p.size}</Drawer.Description>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {p.canShare && <button type="button" className={BTN} onClick={p.onShareLink}><Icon d={ICON.share} />Share link</button>}
            {p.url && (
              <button type="button" className={BTN} data-yard-share-copy={copy} onClick={async () => { const ok = await p.onCopy(); setCopy(ok ? "copied" : "failed"); if (ok) window.setTimeout(() => setCopy(""), 2000); }}>
                <span className="relative grid size-4 place-items-center" aria-hidden>
                  <Icon d={ICON.link} className={`col-start-1 row-start-1 transition-[opacity,transform] duration-200 ${copied ? "scale-50 opacity-0" : ""}`} />
                  <Icon d={ICON.check} className={`col-start-1 row-start-1 text-mark transition-[opacity,transform] duration-200 ${copied ? "" : "scale-50 opacity-0"}`} />
                </span>
                <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
              </button>
            )}
            <button type="button" className={BTN} data-yard-share-still disabled={recording} onClick={p.onStill}><Icon d={ICON.image} />Share image</button>
            {p.clip === "ready" && !recording ? (
              <button type="button" className={BTN} data-yard-share-clip="ready" onClick={p.onShareClip}><Icon d={ICON.video} />Share clip</button>
            ) : p.clip && (
              <button type="button" className={BTN} data-yard-share-clip={recording ? "recording" : "idle"} disabled={recording} onClick={p.onRecord}>
                {recording ? <Ring ms={p.ms!} /> : <Icon d={ICON.video} />}
                {recording ? `Recording ${Math.max(1, Math.ceil((6000 - p.ms!) / 1000))} s` : "Record 6 s clip"}
              </button>
            )}
          </div>
          {copy === "failed" && p.url && (
            <p role="status" className="mt-2 text-xs text-muted">{p.copyFailed}<span data-yard-share-url className="mt-1 block select-all break-all text-fg">{p.url}</span></p>
          )}
          {p.clipNote && <p role="status" data-yard-share-clip-note className="mt-2 text-xs text-muted">{p.clipNote}</p>}
          <p className="mt-2 text-[11px] text-faint">Made on this device. Nothing is uploaded.</p>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** The 6-tick ring: one tick lights per second recorded (opacity only). */
function Ring({ ms }: { ms: number }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1="10" y1="2" x2="10" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 60} 10 10)`} opacity={ms >= i * 1000 ? 1 : 0.25} />
      ))}
    </svg>
  );
}
