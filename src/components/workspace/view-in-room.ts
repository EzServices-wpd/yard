/**
 * View in your room (PR 14b, plan concept 8): the light half, loaded with the bench. It holds a pointer to
 * the bench's model group, the AR feature test and the Quick Look link. The exporters and the WebXR session
 * live in view-in-room-ar.ts and load only on tap (it imports nothing from here, so the bench chunk keeps
 * this module and the lazy chunk stays its own). Nothing leaves the device: the model is built here and
 * handed to the phone's own viewer as a blob URL, and the camera feed never reaches the page.
 */
import type { Object3D } from "three";

/** The bench's model group (BenchScene), set by its ref. The scale figure and props are not inside it. */
let modelRoot: Object3D | null = null;
export const setArRoot = (o: Object3D | null) => void (modelRoot = o);
export const arRoot = () => modelRoot;

export type ArMode = "quicklook" | "webxr";
type XrLike = { isSessionSupported?: (mode: string) => Promise<boolean> };
type ArEnv = { document?: { createElement(tag: "a"): { relList?: { supports?(t: string): boolean } } }; xr?: XrLike | null; secure?: boolean };

/** iOS Quick Look first (the a rel="ar" test), then WebXR immersive-ar (Android Chrome), else none. Never throws. */
export async function arMode(env: ArEnv): Promise<ArMode | null> {
  try {
    if (env.document?.createElement("a").relList?.supports?.("ar")) return "quicklook";
  } catch {
    /* an old relList: no Quick Look */
  }
  if (env.secure === false || !env.xr?.isSessionSupported) return null;
  try {
    return (await env.xr.isSessionSupported("immersive-ar")) ? "webxr" : null;
  } catch {
    return null;
  }
}

/** The browser's own environment for arMode (none on the server). */
export function browserArEnv(): ArEnv {
  if (typeof window === "undefined") return {};
  return { document, xr: (navigator as Navigator & { xr?: XrLike }).xr ?? null, secure: window.isSecureContext };
}
