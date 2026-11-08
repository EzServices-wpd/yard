import { createFileRoute } from "@tanstack/react-router";
import { ideaStore, recordFromPrompt } from "@/lib/yard/ideaLog.server";
import { handleIdeasLog } from "@/lib/yard/ideaLogHandler";

// Endless Ideas log write (specs/004-ideas R1–R7). Always 204: logging never fails a request.
// Reads only { prompt, failed }; no IP, UA or cookie is read or stored.
export const Route = createFileRoute("/api/ideas-log")({
  server: {
    handlers: {
      POST: ({ request }) => handleIdeasLog(request, { recordFromPrompt, store: ideaStore }),
    },
  },
});
