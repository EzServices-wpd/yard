"use client";
/**
 * The View in your room chip (Options, Scale row). It shows only when the phone passes the AR feature test
 * (Quick Look on iOS, WebXR immersive-ar on Android); on a desktop or any other browser it renders nothing.
 * On an AR phone it measures the bench model first (the lazy half, no exporters) and says the size the piece
 * will stand at, or why AR can't open it (too detailed, over the cap). Exporters load on tap. Every failure
 * is a plain line under the chip, never a console error.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useYard } from "@/lib/yard/store";
import { subscribeScrub } from "./build-scrub";
import { AR_CAP_BYTES, FAILED, arMode, arMoved, arRoot, browserArEnv, chipView, openAr, prepareAr, tapRun, type ArMode, type ArPrep } from "./view-in-room";

const lazy = () => import("./view-in-room-ar");
type ArLib = Awaited<ReturnType<typeof lazy>>;
type Built = Awaited<ReturnType<ArLib["arBuild"]>>;
const subscribeMoved = (f: () => void) => {
  const a = subscribeScrub(f), b = useYard.subscribe(f);
  return () => (a(), b());
};

export function ViewInRoomButton() {
  const [mode, setMode] = useState<ArMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<ArPrep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const project = useYard((s) => s.project);
  const parts = project.panels.length + project.instances.length;
  // See inside, a step card, Watch it build or open doors move, hide or dim parts: AR waits for the built piece.
  const moved = useSyncExternalStore(subscribeMoved, () => arMoved(), () => false);
  // The lazy half, kept once measured, so a tap starts the WebXR session without awaiting an import.
  const lib = useRef<ArLib | null>(null);
  const built = useRef<Built | null>(null);
  useEffect(() => {
    let live = true;
    void arMode(browserArEnv()).then((m) => live && setMode(m));
    if (new URLSearchParams(window.location.search).get("test") === "1") {
      (window as unknown as { __yardAr?: unknown }).__yardAr = {
        glb: async () => {
          const ar = await lazy();
          const root = arRoot();
          return root ? Array.from(new Uint8Array(await ar.arGlb(ar.arModel(root)))) : null;
        },
      };
    }
    return () => void (live = false);
  }, []);
  // Measure what AR would get once the bench has drawn this build (two frames after it lands).
  useEffect(() => {
    if (!mode || !parts || moved) return;
    let live = true;
    setPrep(null);
    setFailed(null);
    built.current = null;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void prepareAr(async () => {
          const root = arRoot();
          if (!root) return null;
          const ar = (lib.current ??= await lazy());
          built.current = await ar.arBuild(root, AR_CAP_BYTES);
          return built.current;
        }, project.panels.length).then((p) => live && setPrep(p));
      }),
    );
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [mode, parts, moved, project]);
  const view = chipView({ mode, parts, moved, busy, prep, failed });
  if (!view || !mode) return null;
  const open = async () => {
    if (view.disabled) return;
    setBusy(true);
    setFailed(null);
    // No await before tapRun: the WebXR session is requested inside the tap.
    const msg = await openAr(() => tapRun(lib.current, built.current, mode, project.name));
    // Over the cap on the real file: the chip stays refused with that reason, not a one-off error.
    if (msg && msg !== FAILED) setPrep((p) => ({ size: p?.size ?? null, refused: msg }));
    else setFailed(msg);
    setBusy(false);
  };
  return (
    <div className="mt-2 flex flex-col items-start gap-1.5">
      <button
        type="button"
        data-yard-ar={mode}
        onClick={() => void open()}
        disabled={view.disabled}
        aria-describedby="yard-ar-note"
        className="min-h-11 rounded-md border border-border px-3 text-xs text-fg hover:bg-elevated disabled:opacity-50"
      >
        {view.label}
      </button>
      <p id="yard-ar-note" data-yard-ar-note={view.kind} role="status" className="max-w-[18rem] text-[11px] leading-snug text-muted">
        {view.note}
      </p>
    </div>
  );
}
