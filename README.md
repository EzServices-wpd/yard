# Yard

**Playground for makers. Utility for real-world builders.**

Type a dream → see it on the bench → Help Me Build → cut list, shop links, step plates, export.

## North star

```
3 foot Eiffel Tower from popsicle sticks
→ lattice on the bench
→ Help Me Build
→ export plan
```

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default port 8080). Landing → **Open the bench** → prompt the Eiffel.

## Deploy

This is the **permanent** source of truth. All future work is commits here — not new repos.

1. Import `EzServices-wpd/yard` on Vercel (Framework: Vite).
2. Env (optional at first): `XAI_API_KEY` for Grok true-form + finished renders.
3. Later: `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG` for monetized shop links. Auth/DB when you want accounts.

## Folder map

```
src/lib/yard/          engines (catalog, form, graph, fitted, pocket, windows, plan)
src/lib/ai/            Grok interpret / rewrite / render
src/lib/auth/          Better Auth (Grok broker + PGLite)
src/components/        landing chrome + workspace bench
src/routes/            /  /workspace  /login  /api/auth
scripts/               PWA, migrate, Playwright smokes
server/middleware/     Nitro PWA (manifest + install page)
migrations/            auth schema
```

## Stack

TanStack Start · Vite · React 19 · React Three Fiber · Zod · Tailwind 4

## Guidance

Yard is guidance only — not stamped engineering or a substitute for local building codes.
