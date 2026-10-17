import { testTrafficReason } from "./ideaLogGate";
import type { LogRecord, LogSource } from "./ideaLog";

type Deps = {
  recordFromPrompt: (prompt: string, failed: boolean) => Promise<LogRecord | null>;
  store: () => { record(rec: LogRecord, now?: Date): Promise<unknown> };
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

// Endless Ideas log write (specs/004-ideas R1–R7). Always 204: logging never fails a request.
// Reads only { prompt, failed } plus test markers; no IP, UA or cookie is read or stored.
export async function handleIdeasLog(request: Request, deps: Deps): Promise<Response> {
  try {
    const now = deps.now?.() ?? new Date(); // request time, stamped on the row
    // Source from the offline/local/test gate only (never IP, UA or cookie). Test traffic is still never written.
    const source: LogSource = testTrafficReason(request, deps.env) ? "test" : "live";
    if (source === "live") {
      const text = (await request.text()).slice(0, 1024);
      const body = JSON.parse(text) as { prompt?: unknown; failed?: unknown };
      if (typeof body.prompt === "string") {
        const rec = await deps.recordFromPrompt(body.prompt, body.failed === true);
        if (rec) await deps.store().record({ ...rec, source }, now);
      }
    }
  } catch { /* dropped on purpose */ }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
