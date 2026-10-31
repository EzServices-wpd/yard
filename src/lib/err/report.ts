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

/** Keep only the shape of a message: typed words, field values, quoted strings and long tokens become [x]. */
export function scrubMessage(msg: string, typed: string[]): string {
  let m = String(msg).slice(0, 2000);
  for (const t of typed) {
    if (!t || t.length < 3) continue;
    m = m.split(t).join("[x]");
    // and every typed word of 4+ letters, wherever it shows up
    for (const w of t.match(/[\p{L}\p{N}]{4,}/gu) ?? []) m = m.replace(new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, "giu"), "[x]");
  }
  m = noQuery(m)
    .replace(/(["'`“‘])[^"'`”’]*(["'`”’])/g, "[x]") // anything quoted
    .replace(/\S{25,}/g, "[x]") // long tokens (pasted text, data, urls)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[x]");
  return m.slice(0, 120);
}

/** Frames only ("at f (file:1:2)" / "f@file:1:2"), query strings and hashes dropped; the message line is not kept. */
export function scrubStack(stack: string | undefined): string {
  return (stack ?? "")
    .split("\n")
    .filter((l) => /^\s*at\s|@\S+:\d+:\d+\s*$/.test(l))
    .slice(0, 20)
    .map((l) => noQuery(l.trim()).slice(0, 200))
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
      stack: scrubStack(e.stack),
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
