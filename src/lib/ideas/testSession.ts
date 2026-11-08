/**
 * ?test=1 for the whole tab session. Once a page opens with test=1 the tab remembers it (sessionStorage), the router
 * keeps `test=1` on every navigation (root route), and every same-origin API call carries `x-yard-test: 1`, so the
 * Ideas log gate drops the write. Nothing here reads the user agent, navigator.webdriver, cookies or any browser detail.
 *
 * The run id is a random per-tab token for the server's short-lived burst counter only (never stored with a row).
 */
const TEST_KEY = "yard:test";
const RUN_KEY = "yard:run";
const TEST_QS = /(?:^|[?&])test=1(?:&|$)/;
let memTest = false;
let memRun = "";

function store(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

/** Remember test=1 for this tab when the page URL has it. Client only; a no-op on the server. */
export function rememberTestFromUrl(search: string = typeof window === "undefined" ? "" : window.location.search): void {
  if (!TEST_QS.test(search)) return;
  memTest = true;
  try { store()?.setItem(TEST_KEY, "1"); } catch { /* storage off: memory only */ }
}

/** True when this tab session is a test run (the URL now, or any earlier page in the tab, had test=1). */
export function sessionTest(): boolean {
  if (typeof window === "undefined") return false;
  if (TEST_QS.test(window.location.search)) return true;
  try { if (store()?.getItem(TEST_KEY) === "1") return true; } catch { /* fall through */ }
  return memTest;
}

/** A random per-tab run id (16 hex chars), made once per tab session. */
export function runId(): string {
  if (memRun) return memRun;
  try { const v = store()?.getItem(RUN_KEY); if (v && /^[a-f0-9]{16}$/.test(v)) return (memRun = v); } catch { /* new one */ }
  const b = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(b);
  memRun = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (!/[1-9a-f]/.test(memRun)) memRun = Math.random().toString(16).slice(2, 10).padEnd(16, "0");
  try { store()?.setItem(RUN_KEY, memRun); } catch { /* memory only */ }
  return memRun;
}

function sameOrigin(input: RequestInfo | URL): boolean {
  try {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(u, window.location.href).origin === window.location.origin;
  } catch { return false; }
}

/** The fetch init with `x-yard-test: 1` added (keeps every other header). */
export function withTestHeader(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("x-yard-test", "1");
  return { ...init, headers };
}

type Fetch = typeof fetch & { __yardTest?: true };
/** Client: remember test=1 and wrap window.fetch so every same-origin API call in a test session says so. Idempotent. */
export function installTestHeader(): void {
  if (typeof window === "undefined") return;
  rememberTestFromUrl();
  const f = window.fetch as Fetch;
  if (!f || f.__yardTest) return;
  const wrapped: Fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => (sessionTest() && sameOrigin(input) ? f.call(window, input, withTestHeader(input, init)) : f.call(window, input, init)),
    { __yardTest: true as const },
  );
  window.fetch = wrapped;
}
