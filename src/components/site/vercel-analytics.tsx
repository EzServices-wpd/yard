import { useEffect } from "react";
import { eventPageQuiet } from "@/lib/feedback/eventGate";

/**
 * Vercel Web Analytics (free tier): Vercel's own script, served from this site's /_vercel path. No cookies.
 * A page whose URL has offline=1, local=1 or test=1 does not load it. That is eventPageQuiet, the same
 * rule the browser uses before it POSTs /api/ev, so a test walk is not a visit.
 */
export function VercelAnalytics() {
  useEffect(() => {
    // ponytail: once, at first paint. A test walk opens with the flag, and the router keeps it on later URLs.
    if (
      eventPageQuiet(location.search) ||
      !/yard\.wiki$/.test(location.hostname) ||
      document.querySelector("script[data-yard-va]")
    ) {
      return;
    }
    const s = document.createElement("script");
    s.defer = true;
    s.dataset.yardVa = "1";
    s.src = "/_vercel/insights/script.js";
    document.head.appendChild(s);
  }, []);
  return null;
}
