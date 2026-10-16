"use client";

import { useEffect, useRef, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { CHIPS, NOTE_CAP, type ChipId } from "@/lib/feedback/shop";

const sentKey = (k: string) => `yard.told.v1:${k}`;
const sizeOf = (o?: { width: number; height: number; depth: number }) =>
  o ? `${Math.round(o.width * 10) / 10}x${Math.round(o.depth * 10) / 10}x${Math.round(o.height * 10) / 10}` : "";

/**
 * "Something's off? Tell the shop": a quiet line under the build card that opens a small sheet.
 * Hick's: six chips, nothing else to decide. Tesler's: the build, size, tip and part count go with it
 * automatically. Postel's: chips or a note, either is enough. Peak-end: a warm thank-you closes it.
 * No identity is sent, and nothing here links out.
 */
export function ShopFeedback() {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [chips, setChips] = useState<ChipId[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "thanks" | "busy" | "error">("idle");
  const size = sizeOf(project.overall);
  const buildKey = `${project.prompt}|${size}|${project.primaryMaterialId ?? ""}`;
  const [told, setTold] = useState(false);
  useEffect(() => {
    try { setTold(sessionStorage.getItem(sentKey(buildKey)) === "1"); } catch { setTold(false); }
    setChips([]); setNote(""); setState("idle");
  }, [buildKey]);
  if (!plan || !project.prompt?.trim() || project.displayOnly) return null;

  const open = () => { setState(told ? "thanks" : "idle"); ref.current?.showModal(); };
  const close = () => { ref.current?.close(); opener.current?.focus(); };
  const toggle = (id: ChipId) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const send = async () => {
    if (state === "sending" || (!chips.length && !note.trim())) return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ prompt: project.prompt, size, partCount: plan.totals.pieces, chips, note: note.slice(0, NOTE_CAP) }),
      });
      if (res.status === 429) return setState("busy");
      if (!res.ok && res.status !== 204) return setState("error");
      try { sessionStorage.setItem(sentKey(buildKey), "1"); } catch { /* private mode */ }
      setTold(true);
      setState("thanks");
    } catch { setState("error"); }
  };

  const ready = chips.length > 0 || note.trim().length > 0;
  return (
    <>
      <p data-yard-shop-feedback={told ? "told" : "1"} className="flex items-center border-t border-border/60 px-3 py-1 text-xs">
        <button ref={opener} type="button" onClick={open} className="min-h-11 text-muted underline-offset-4 hover:text-fg hover:underline">
          {told ? "Told the shop. Thanks." : "Something's off? Tell the shop"}
        </button>
      </p>
      <dialog
        ref={ref}
        data-yard-shop-sheet="1"
        aria-labelledby="yard-shop-title"
        className="yard-shop-sheet m-auto w-[min(92vw,420px)] rounded-2xl bg-surface p-0 text-fg backdrop:bg-black/40"
        onClose={() => opener.current?.focus()}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        {state === "thanks" ? (
          <div className="p-5" role="status">
            <h2 id="yard-shop-title" className="font-display text-[20px] leading-tight">Thanks. The shop's on it.</h2>
            <p className="mt-2 text-sm text-muted">Every note gets read at the bench. That's how the next build comes out truer.</p>
            <button type="button" autoFocus onClick={close} className="mt-4 inline-flex h-11 items-center rounded-full bg-fg px-5 text-sm text-bg">Back to the build</button>
          </div>
        ) : (
          <form className="p-5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <h2 id="yard-shop-title" className="font-display text-[20px] leading-tight">What's off with this one?</h2>
            <p className="mt-1 text-sm text-muted">Pick any that fit. We send the build and its size with it. Nothing about you.</p>
            <div role="group" aria-label="What's off" className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={chips.includes(c.id)}
                  data-yard-shop-chip={c.id}
                  onClick={() => toggle(c.id)}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:bg-elevated aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-bg"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm" htmlFor="yard-shop-note">Anything else? <span className="text-muted">(optional)</span></label>
            <textarea
              id="yard-shop-note"
              data-yard-shop-note="1"
              value={note}
              maxLength={NOTE_CAP}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="The shelf sits a little low…"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-base"
            />
            <p aria-live="polite" className="mt-1 min-h-5 text-xs text-muted">
              {state === "busy" ? "The shop's swamped right now. Give it a minute and try again." : state === "error" ? "That didn't reach the shop. Try once more?" : note ? `${NOTE_CAP - note.length} left` : ""}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={close} className="inline-flex h-11 items-center rounded-full px-4 text-sm text-muted hover:text-fg">Not now</button>
              <button type="submit" disabled={!ready || state === "sending"} aria-disabled={!ready} className="inline-flex h-11 items-center rounded-full bg-fg px-5 text-sm text-bg disabled:opacity-40">
                {state === "sending" ? "Sending…" : "Send to the shop"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
