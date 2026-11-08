import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Request middleware, every request:
 * - the secret-only endpoints (src/lib/server/secretRoutes.ts): answered only with the right Bearer secret; otherwise
 *   next(), so a bad or missing secret goes exactly where an unknown path goes (the app's not-found);
 * - the CSRF check on server functions that Start applies by default when there is no start.ts (kept as it was).
 */
const secretRoutes = createMiddleware().server(async ({ request, pathname, next }) => {
  const { secretRoute } = await import("@/lib/server/secretRoutes");
  return (await secretRoute(request, pathname)) ?? next();
});
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({ requestMiddleware: [csrf, secretRoutes] }));
