# Yard — base-stage status

Checked 2026-08-19 against production deploy `dpl_RjF3tEP6oHNiYnR3K1L2jwEEhFmC` (commit `b5704e02`).

## Live

| | |
|---|---|
| Production | https://yard-peach.vercel.app |
| Aliases | yard-build-hq.vercel.app, yard-git-main-build-hq.vercel.app |
| Team | BuildHQ (`team_nmw9TlWf4hgHRTAiH38dwAux`) |
| Project | `yard` / `prj_1n4o4nZTHurytn25MkrZ8C6MU8iT` |
| Framework | tanstack-start · Node 24 · Nitro `vercel` preset |
| Build | SUCCESS · ~1 min |
| Ready state | READY |

## What works now

- Landing `/` — 200, hero, north-star chips, vanity / window / Eiffel links
- Bench `/workspace` — 200, client-hydrated 3D (SSR off for the canvas, by design)
- Login `/login` — 200, skip-to-bench works
- Deterministic engines in the tree: Eiffel lattice, pocket vanity, fitted units, stock windows, catalog, cut list, BOM, unique steps, PDF export
- Shop chips fall back to Home Depot search (no affiliate tag required)
- Auth UI is present and labeled optional

## Broken / blocking (fix before scaling)

1. **PGLite crashes the serverless function.** `src/lib/db.ts` boots PGLite on import. Vercel has no `/var/task/_libs/pglite.data`. Result: unhandled rejection, process exit 128, 18 errors / 11 users on `/__server`.
2. **Auth API is down.** `GET /api/auth/get-session` → 404 (function dies in the same crash). Google / X buttons will not complete.
3. **No `XAI_API_KEY` on Vercel.** True-form query and finished-piece render return “not available in this environment.” Deterministic generate still works.
4. **Share / PWA assets 404.** `/og.jpg`, `/__grok/icon-180.png`, `/favicon.ico`.
5. **No `DATABASE_URL` / Better Auth secrets.** Expected for this pass — but must not crash the process when absent.
6. **Affiliate is a stub.** `shopSearchUrl` is Home Depot only. `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG` unused.

## Not bugs — product gaps for later stages

- Any-query true-form wire (wiki / Grok) mapped onto unlimited stock
- Structural “frame will fail without support” as a first-class check
- Denser LEGO / Wayfair plates in the PDF
- AR / on-site overlay
- Cloud-saved yards
- Custom domain (`project.live` is still false)
