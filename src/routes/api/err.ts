import { createFileRoute } from "@tanstack/react-router";
import { noQuery, scrubMessage } from "@/lib/err/report";

// Crash forwarder: the browser posts a scrubbed report here (src/lib/err/report.ts) and this sends it on to Sentry,
// so the browser never contacts Sentry. Reads only the JSON body: no IP, UA or cookie is read or forwarded.
// No DSN set -> 204 and no network call. Tags are only the build family (a fixed engine id) and the commit.
const str = (v: unknown, n: number) => noQuery(typeof v === "string" ? v : "").slice(0, n);

/** "https://KEY@o1.ingest.sentry.io/123" -> envelope URL and key; null when unset or malformed. */
export function sentryTarget(dsn: string | undefined): { url: string; key: string } | null {
  try {
    const u = new URL(dsn ?? "");
    const id = u.pathname.replace(/\/+$/, "").split("/").pop();
    if (!u.username || !id) return null;
    const prefix = u.pathname.replace(/\/+$/, "").slice(0, -id.length).replace(/\/$/, "");
    return { url: `${u.protocol}//${u.host}${prefix}/api/${id}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

/** One frame per line ("at f (file:1:2)" or "f@file:1:2") -> Sentry frames, oldest first. */
function frames(stack: string) {
  return stack.split("\n").slice(0, 20).map((l) => {
    const m = /^(?:at\s+)?(?:(.*?)\s*[@(])?\s*(\S+?):(\d+):(\d+)\)?\s*$/.exec(l.trim());
    return m ? { function: (m[1] || "?").slice(0, 80), filename: m[2], lineno: +m[3], colno: +m[4], in_app: true } : { function: l.slice(0, 80) };
  }).reverse();
}

/** Only our own reporter's post: same-origin (Sec-Fetch-Site or a matching Origin) and a JSON/text body. No IP read. */
function fromOurPage(request: Request): boolean {
  const h = request.headers;
  const type = (h.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("application/json") && !type.startsWith("text/plain")) return false;
  if (h.get("sec-fetch-site") === "same-origin") return true;
  const origin = h.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

/** Reads at most `max` bytes of the body and stops there; the rest is never read. */
async function readCapped(request: Request, max: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let n = 0;
  while (n < max) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    n += value.length;
  }
  void reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(n, max));
  let o = 0;
  for (const p of parts) { buf.set(p.subarray(0, buf.length - o), o); o += Math.min(p.length, buf.length - o); }
  return new TextDecoder().decode(buf);
}

export const Route = createFileRoute("/api/err")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        const target = sentryTarget(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
        if (!target || !fromOurPage(request)) return new Response(null, { status: 204, headers });
        try {
          const b = JSON.parse(await readCapped(request, 4096)) as Record<string, unknown>;
          const id = crypto.randomUUID().replace(/-/g, "");
          const now = new Date().toISOString();
          const stack = str(b.stack, 4000);
          const event = {
            event_id: id,
            timestamp: now,
            platform: "node", // not "javascript": Sentry infers a client IP only for browser platforms
            level: "error",
            environment: process.env.VERCEL_ENV || "development",
            exception: { values: [{ type: str(b.name, 40) || "Error", value: scrubMessage(str(b.message, 400), []), ...(stack ? { stacktrace: { frames: frames(stack) } } : {}) }] },
            tags: { build_family: /^[a-z][a-z0-9-]{0,29}$/.test(str(b.family, 30)) ? str(b.family, 30) : "", commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 40) },
          };
          const envelope = `${JSON.stringify({ event_id: id, sent_at: now })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
          await fetch(target.url, {
            method: "POST",
            body: envelope,
            signal: AbortSignal.timeout(3000),
            headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=yard-err/1` },
          });
          return new Response(null, { status: 204, headers });
        } catch {
          return new Response(null, { status: 400, headers });
        }
      },
    },
  },
});
