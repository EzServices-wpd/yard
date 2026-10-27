/**
 * View in your room (PR 14b, plan concept 8): the light half, loaded with the bench. It holds a pointer to
 * the bench's model group, the AR feature test, the size cap and every message the chip shows. The model
 * copy and the WebXR session live in view-in-room-ar.ts (loaded when the chip shows on an AR phone; it imports
 * nothing from here, so it stays its own chunk); the exporters load only on tap. Nothing leaves the device: the model is built here and
 * handed to the phone's own viewer as a blob URL, and the camera feed never reaches the page.
 */
import type { Object3D } from "three";

/** The bench's model group (BenchScene), set by its ref. The scale figure and props are not inside it. */
let modelRoot: Object3D | null = null;
export const setArRoot = (o: Object3D | null) => void (modelRoot = o);
export const arRoot = () => modelRoot;

export type ArMode = "quicklook" | "webxr";
type XrLike = { isSessionSupported?: (mode: string) => Promise<boolean> };
type ArEnv = {
  document?: { createElement(tag: "a"): { relList?: { supports?(t: string): boolean } } };
  xr?: XrLike | null;
  secure?: boolean;
  /** navigator.userAgent, navigator.platform, navigator.maxTouchPoints (for the iOS gate). */
  ua?: string;
  platform?: string;
  touch?: number;
};

/** iPhone, iPad or iPod, or an iPad asking for the desktop site (MacIntel with touch), the model-viewer test. */
export const isIOS = (env: ArEnv) => /iPad|iPhone|iPod/.test(env.ua ?? "") || (env.platform === "MacIntel" && (env.touch ?? 0) > 1);

/**
 * iOS Quick Look first (a rel="ar" supported AND an iOS device: desktop Mac Safari also answers the rel test
 * but has no AR), then WebXR immersive-ar (Android Chrome with ARCore), else none. Never throws.
 */
export async function arMode(env: ArEnv): Promise<ArMode | null> {
  try {
    if (isIOS(env) && env.document?.createElement("a").relList?.supports?.("ar")) return "quicklook";
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
  const nav = navigator as Navigator & { xr?: XrLike };
  return { document, xr: nav.xr ?? null, secure: window.isSecureContext, ua: nav.userAgent, platform: nav.platform, touch: nav.maxTouchPoints };
}

/**
 * The cap on what AR is handed: about 8 MB for the model file (Quick Look's USDZ; on Android the same
 * measure of the model in memory). Phones open files this size in a second or two; past it Quick Look can
 * take many seconds or drop the file, so the chip refuses with the reason instead.
 */
export const AR_CAP_BYTES = 8 * 1024 * 1024;
export const mb = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/** Inches as the app writes them, to the nearest 1/8: 14 3/8", 78". */
export function inchText(n: number): string {
  const e = Math.round(n * 8);
  const whole = Math.floor(e / 8), r = e % 8;
  if (!r) return `${whole}"`;
  const g = r % 4 === 0 ? 4 : r % 2 === 0 ? 2 : 1;
  return `${whole ? `${whole} ` : ""}${r / g}/${8 / g}"`;
}

/** The export's own measured size (the piece as the bench draws it), W × D × H. */
export const sizeLine = (w: number, d: number, h: number) => `${inchText(w)} W × ${inchText(d)} D × ${inchText(h)} H`;

export const tooBig = (bytes: number) =>
  `This build is too detailed to open in AR (about ${mb(bytes)} MB; phones handle up to ${mb(AR_CAP_BYTES)} MB). It still builds and measures the same here.`;
/** Shown (as text, under the chip) while the bench isn't showing the whole built piece. */
export const NOT_WHOLE = "Close Watch it build, See inside, the step card or the open doors first, so the whole piece goes to your room.";
export const FAILED = "AR didn't open on this phone. Nothing was sent. Try again, or try another phone.";

/** What the lazy half reports for a model: its measured size in inches and its file size. */
export type ArStats = { inches: [number, number, number]; bytes: number; parts: number };
/** The chip's line under it: the size it will stand at, or why it can't. */
export type ArPrep = { size: string | null; refused: string | null };

/**
 * Never throws: a failed measure refuses with the plain message rather than leaving the chip silent. A model
 * with fewer parts than the plan (a reveal or step hid some) is refused too: AR only gets the whole piece.
 */
export async function prepareAr(measure: () => Promise<ArStats | null>, planParts = 0): Promise<ArPrep> {
  try {
    const s = await measure();
    if (!s) return { size: null, refused: FAILED };
    if (s.parts < planParts) return { size: null, refused: NOT_WHOLE };
    const size = sizeLine(...s.inches);
    return { size, refused: s.bytes > AR_CAP_BYTES ? tooBig(s.bytes) : null };
  } catch {
    return { size: null, refused: FAILED };
  }
}

/** Run the open; null when AR opened, else the message to show. Never throws. */
export async function openAr(run: () => Promise<number | void>): Promise<string | null> {
  try {
    const bytes = await run();
    return typeof bytes === "number" && bytes > AR_CAP_BYTES ? tooBig(bytes) : null;
  } catch {
    return FAILED;
  }
}
