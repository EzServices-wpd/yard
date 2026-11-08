// Crash reporter (no SDK). The browser posts only to our own /api/err; the server forwards to Sentry.
// No free text is sent: the message and error name keep only words from WORDS below (JavaScript's own error words and
// the words of this app's own throw sites); every other word, number or non-ASCII run becomes [x] or #. Stack frames
// keep only our built /assets/*.js file, line and column. The build family is the engine's fixed kind id.

let family: () => string | undefined = () => undefined;
let sent = 0;
const seen = new Set<string>();

/** The workspace registers how to read the current build's family. */
export function setErrContext(fn: () => string | undefined) {
  family = fn;
}

// JS / browser error words and names, then the app's own client throw sites (grep of `new Error(` / `throw` in src),
// minus words a user might type for a build (step, set, size, store, parts, ...): those become [x]; the frame still points.
const WORDS = new Set(`a abort aborted aborterror aggregateerror already an and array assignment at been before being
by call called cannot chunkloaderror constant constructor context css declared defined denied domexception dynamically
error evalerror exceeded failed fetch for from function has imported in initialization input internalerror invalid
invalidstateerror is iterable json loading lost maximum network networkerror non not notallowederror notfounderror
notsupportederror null object of on operation or out permission position properties property quota quotaexceedederror
rangeerror read reading referenceerror request script securityerror signal syntaxerror the thrown timeout timeouterror
to token typeerror undefined unexpected unknownerror urierror valid variable was webgl with
allow cancelled finite maxsteps measured more must poll prompt signaling stale than unavailable unset up ups`.split(/\s+/));

/** Whole tokens only (split at spaces and ASCII punctuation): an allowlisted ASCII word stays, a digit run becomes #,
 * anything else (typed words, glued runs like 30wide, any non-ASCII) becomes [x]; an [x] stays, so the server's rerun
 * is a no-op. Over 500 chars the input is cut and the word at the cut becomes [x] whole; the output is then cut to 200
 * at a token edge. So no cut can show part of a word. */
export function scrubMessage(msg: unknown): string {
  const raw = String(msg ?? "");
  let s = raw.slice(0, 500).replace(/\s+/g, " ");
  if (raw.length > 500) s = s.replace(/[^ !-/:-@[-`{-~]+$/, "[x]");
  s = s.replace(/\[x\]|[^ !-/:-@[-`{-~]+/g, (t) => (/^\d+$/.test(t) ? "#" : t === "[x]" || (/^[A-Za-z]+$/.test(t) && WORDS.has(t.toLowerCase())) ? t : "[x]"));
  return cutAt(s, 200);
}

/** Cuts scrubbed text to `max` chars at a token edge (a sliced [x] or word at the end is dropped). */
export function cutAt(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).replace(/(?:\[x?|[A-Za-z]+)$/, "") : s;
}

// A frame in our own build: Chrome "at [fn ](url:1:2)" or Firefox "fn@url:1:2"; only the /assets path, line, col are kept.
const FRAME = /^(?:at (?:[^()]* \()?|[^@\s]*@)(?:https?:\/\/[^/\s]+)?(\/assets\/[\w-]+\.js):(\d+):(\d+)\)?$/;

/** Frames only, each as "at /assets/name.js:line:col" (no function name, host, query, page or /s/ path). */
export function scrubStack(stack: unknown): string {
  return String(stack ?? "").split("\n").map((l) => FRAME.exec(l.trim())).filter((m) => !!m).slice(0, 20)
    .map((m) => `at ${m[1]}:${m[2]}:${m[3]}`).join("\n");
}

/** V8 opens a stack with "name: message", where a frame-shaped line could carry text: cut it, or send no stack when the
 * stack doesn't start with it. Other engines' stacks hold only frames. */
export function framesOf(e: Error): string {
  const s = String(e.stack ?? ""), head = String(e);
  return s.startsWith(head) ? s.slice(head.length) : "captureStackTrace" in Error ? "" : s;
}

export function reportError(err: unknown) {
  try {
    if (sent >= 3 || typeof window === "undefined") return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Non-error thrown");
    const f = family() ?? "";
    const body = JSON.stringify({
      name: cutAt(scrubMessage(e.name || "Error"), 40),
      message: scrubMessage(e.message),
      stack: scrubStack(framesOf(e)),
      family: /^[a-z][a-z0-9-]{0,29}$/.test(f) ? f : "",
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
