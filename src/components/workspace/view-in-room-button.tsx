"use client";
/**
 * The View in your room chip (Options, Scale row). It shows only when the phone passes the AR feature test
 * (Quick Look on iOS, WebXR immersive-ar on Android); on a desktop or any other browser it renders nothing.
 * On an AR phone it measures the bench model first (the lazy half, no exporters) and says the size the piece
 * will stand at, or why AR can't open it (too detailed, over the cap). Exporters load on tap. Every failure
 * is a plain line under the chip, never a console error.
 */
import { useEffect, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { AR_CAP_BYTES, FAILED, arMode, arRoot, browserArEnv, openAr, prepareAr, type ArMode, type ArPrep } from "./view-in-room";

const lazy = () => import("./view-in-room-ar");

export function ViewInRoomButton() {
  const [mode, setMode] = useState<ArMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<ArPrep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const project = useYard((s) => s.project);
  const parts = project.panels.length + project.instances.length;
  // See inside or a step card moves or dims parts: AR waits for the built piece.
  const moved = useYard((s) => s.explode || s.activeStep != null);
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
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void prepareAr(async () => {
          const root = arRoot();
          if (!root) return null;
          const ar = await lazy();
          return ar.arStats(ar.arModel(root));
        }).then((p) => live && setPrep(p));
      }),
    );
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [mode, parts, moved, project]);
  if (!mode || parts === 0) return null;
  const refused = prep?.refused ?? null;
  const open = async () => {
    const root = arRoot();
    if (!root || busy || refused) return;
    setBusy(true);
    setFailed(null);
    const msg = await openAr(async () => {
      const ar = await lazy();
      const model = ar.arModel(root);
      if (mode === "quicklook") return ar.openQuickLook(model, project.name, AR_CAP_BYTES);
      await ar.startWebXR(model, () => undefined);
    });
    // Over the cap on the real file: the chip stays refused with that reason, not a one-off error.
    if (msg && msg !== FAILED) setPrep((p) => ({ size: p?.size ?? null, refused: msg }));
    else setFailed(msg);
    setBusy(false);
  };
  const note = failed ?? refused ?? (prep?.size ? `Stands ${prep.size} in your room, at true size.` : "Measuring…");
  return (
    <div className="mt-2 flex flex-col items-start gap-1.5">
      <button
        type="button"
        data-yard-ar={mode}
        onClick={() => void open()}
        disabled={moved || busy || !prep || !!refused}
        aria-describedby="yard-ar-note"
        className="min-h-11 rounded-md border border-border px-3 text-xs text-fg hover:bg-elevated disabled:opacity-50"
      >
        {busy ? "Opening…" : "View in your room"}
      </button>
      <p id="yard-ar-note" data-yard-ar-note={failed ? "failed" : refused ? "refused" : prep ? "size" : "measuring"} role="status" className="max-w-[18rem] text-[11px] leading-snug text-muted">
        {note}
      </p>
    </div>
  );
}
