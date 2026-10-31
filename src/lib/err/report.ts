// Crash reporter (no SDK). The browser posts only to our own /api/err; the server forwards to Sentry.
// It sends the error name, a scrubbed short message, stack frames without query strings, and the bench's build
// family (the engine's fixed kind id, never a title or size). Never what was typed: the live prompt, any field's value, quoted text and long runs are cut out.

type Ctx = () => { family?: string; typed?: (string | undefined)[] };
let ctx: Ctx = () => ({});
let sent = 0;
const seen = new Set<string>();

/** The workspace registers how to read the current build's family (and the words to never send). */
export function setErrContext(fn: Ctx) {
  ctx = fn;
}

/** Drops ?query and #hash from every URL, keeping a stack frame's trailing :line:col. */
export const noQuery = (s: string) => s.replace(/(https?:\/\/[^\s?#)]*)[?#][^\s)]*?(:\d+:\d+)?(?=[\s)]|$)/g, "$1$2");

/** One pass that cuts every typed word and digit run (any length, any case; long words with any ending). */
function cutTyped(s: string, typed: string[], digits = true): string {
  const toks = [...new Set(typed.flatMap((t) => t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []))]
    .filter((w) => digits || /\p{L}/u.test(w))
    .sort((a, b) => b.length - a.length);
  if (!toks.length) return s;
  // 4+ letter words also take any ending (bookshelf -> bookshelves); short ones match whole words only
  const alt = toks.map((w) => (w.length >= 4 ? `${w.slice(0, -1)}\\p{L}*` : `${w}(?![\\p{L}\\p{N}])`)).join("|");
  return s.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})`, "giu"), "[x]");
}

/** Keep only the shape of a message: typed words, digit runs, quoted strings and long tokens become [x]. */
export function scrubMessage(msg: string, typed: string[]): string {
  return noQuery(cutTyped(String(msg).slice(0, 2000), typed))
    .replace(/(["'`“‘])[^"'`”’]*(["'`”’])/g, "[x]") // anything quoted
    .replace(/\S{25,}/g, "[x]") // long tokens (pasted text, data, urls)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[x]")
    .replace(/\d+/g, "#") // every digit run (sizes, counts, ids)
    .slice(0, 120);
}

// A real frame: "at [async |new ]name (url:1:2)", "at url:1:2" or "name@url:1:2". Anything else (a message's own
// "at ..." line, typed text) is dropped.
const FRAME = /^(?:at (?:(?:async |new )?[\w$.<>[\]]+ \()?(?:https?:\/\/|\/|file:|<anonymous>)\S*:\d+:\d+\)?|[\w$.<>[\]/]*@(?:https?:\/\/|\/|file:)\S*:\d+:\d+)$/;

/** Frames only, query strings and hashes dropped, typed words cut from names and paths (line:col digits kept). */
export function scrubStack(stack: string | undefined, typed: string[] = []): string {
  return (stack ?? "")
    .split("\n")
    .map((l) => noQuery(l.trim()))
    .filter((l) => FRAME.test(l))
    .slice(0, 20)
    .map((l) => cutTyped(l, typed, false).slice(0, 200))
    .join("\n");
}

export function reportError(err: unknown) {
  try {
    if (sent >= 3 || typeof window === "undefined") return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Non-error thrown");
    const c = ctx();
    const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"), (f) => f.value);
    const typed = [...(c.typed ?? []), ...fields].filter((t): t is string => !!t && t.trim().length > 2).map((t) => t.trim());
    const body = JSON.stringify({
      name: String(e.name || "Error").slice(0, 40),
      message: scrubMessage(e.message, typed),
      stack: scrubStack(e.stack, typed),
      family: /^[a-z][a-z0-9-]{0,29}$/.test(c.family ?? "") ? c.family : "",
    });
    if (seen.has(body)) return;
    seen.add(body);
    sent++;
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/err", blob)) void fetch("/api/err", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    // the reporter never throws
  }
}

let installed = false;
export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason));
}
