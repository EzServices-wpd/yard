import { createServerFn } from "@tanstack/react-start";

/** Row 578: the engine's name and size for a /workspace build token, worked out on the server (the card's worker). */
export const engineTitleFn = createServerFn({ method: "GET" })
  .validator((token: unknown) => (typeof token === "string" ? token : ""))
  .handler(async ({ data }) => {
    // Imported here so the route tree (and the browser) never loads the engine or node:worker_threads.
    const { engineTitleWithin } = await import("./budget.server");
    return engineTitleWithin(data);
  });
