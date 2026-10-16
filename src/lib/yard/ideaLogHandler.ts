import { testTrafficReason } from "./ideaLogGate";
import type { LogRecord } from "./ideaLog";

type Deps = {
  recordFromPrompt: (prompt: string, failed: boolean) => Promise<LogRecord | null>;
  store: () => { record(rec: LogRecord): Promise<unknown> };
  env?: Record<string, string | undefined>;
};

// Endless Ideas log write (specs/004-ideas R1–R7). Always 204: logging never fails a request.
// Reads only { prompt, failed } plus test markers; no IP, UA or cookie is read or stored.
export async function handleIdeasLog(request: Request, deps: Deps): Promise<Response> {
  try {
    if (!testTrafficReason(request, deps.env)) {
      const text = (await request.text()).slice(0, 1024);
      const body = JSON.parse(text) as { prompt?: unknown; failed?: unknown };
      if (typeof body.prompt === "string") {
        const rec = await deps.recordFromPrompt(body.prompt, body.failed === true);
        if (rec) await deps.store().record(rec);
      }
    }
  } catch { /* dropped on purpose */ }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
