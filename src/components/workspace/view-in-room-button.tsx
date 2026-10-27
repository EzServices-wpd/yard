"use client";
/**
 * The View in your room chip (Options, Scale row). It shows only when the phone passes the AR feature test
 * (Quick Look on iOS, WebXR immersive-ar on Android); on a desktop or any other browser it renders nothing.
 * The exporters and the session code load on tap. A failed open says so on the chip, never in the console.
 */
import { useEffect, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { arMode, arRoot, browserArEnv, type ArMode } from "./view-in-room";

type Phase = "idle" | "busy" | "failed";

export function ViewInRoomButton() {
  const [mode, setMode] = useState<ArMode | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const name = useYard((s) => s.project.name);
  const parts = useYard((s) => s.project.panels.length + s.project.instances.length);
  // See inside or a step card moves or dims parts: AR waits for the built piece.
  const moved = useYard((s) => s.explode || s.activeStep != null);
  useEffect(() => {
    let live = true;
    void arMode(browserArEnv()).then((m) => live && setMode(m));
    if (new URLSearchParams(window.location.search).get("test") === "1") {
      (window as unknown as { __yardAr?: unknown }).__yardAr = {
        glb: async () => {
          const ar = await import("./view-in-room-ar");
          const root = arRoot();
          return root ? Array.from(new Uint8Array(await ar.arGlb(ar.arModel(root)))) : null;
        },
      };
    }
    return () => void (live = false);
  }, []);
  if (!mode || parts === 0) return null;
  const open = async () => {
    const root = arRoot();
    if (!root || phase === "busy") return;
    setPhase("busy");
    try {
      const ar = await import("./view-in-room-ar");
      const model = ar.arModel(root);
      if (mode === "quicklook") await ar.openQuickLook(model, name);
      else await ar.startWebXR(model, () => setPhase("idle"));
      if (mode === "quicklook") setPhase("idle");
    } catch {
      setPhase("failed");
    }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button
        type="button"
        data-yard-ar={mode}
        onClick={() => void open()}
        disabled={moved || phase === "busy"}
        title="Stands the piece in your room at true size, with your phone's camera. Nothing is uploaded."
        className="min-h-11 rounded-md border border-border px-3 text-xs text-fg hover:bg-elevated disabled:opacity-50"
      >
        {phase === "busy" ? "Opening…" : phase === "failed" ? "AR didn't open. Try again" : "View in your room"}
      </button>
    </div>
  );
}
