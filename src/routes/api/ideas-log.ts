import { createFileRoute } from "@tanstack/react-router";
import { ideaStore, recordFromPrompt } from "@/lib/yard/ideaLog.server";

// Endless Ideas log write (specs/004-ideas R1–R7). Always 204: logging never fails a request.
// Reads only { prompt, failed }; no IP, UA or cookie is read or stored.
export const Route = createFileRoute("/api/ideas-log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const text = (await request.text()).slice(0, 1024);
          const body = JSON.parse(text) as { prompt?: unknown; failed?: unknown };
          if (typeof body.prompt === "string") {
            const rec = await recordFromPrompt(body.prompt, body.failed === true);
            if (rec) await ideaStore().record(rec);
          }
        } catch { /* dropped on purpose */ }
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
