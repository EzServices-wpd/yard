# Yard — Stage 0 status

Checked 2026-08-19 against production `https://yard-peach.vercel.app`.

## Stage 0 — code done; one env leftover

| Check | Result |
|---|---|
| PGLite never boots on Vercel | `dbSource = none` without `DATABASE_URL`. Last PGLite ENOENT was 16:51 UTC on the *old* deploy. Zero new clusters after the fix. |
| Auth degrades to signed-out | Memory adapter via `better-auth/adapters/memory`. Auth off unless `VITE_AUTH_ENABLED=true`. Skip still opens the bench. |
| Landing / bench / login | `/` 200 · `/workspace` 200 · `/login` 200 · no Dev User |
| Live pass | Eiffel 580 pcs · pocket vanity 26 pcs · alcove closet 26 pcs · Andersen 36×48 17 pcs — each opened Build plan and exported a PDF |
| PWA icon | `/__grok/icon-180.png` 200 |
| Share card | `scripts/brand/og.jpg.b64` committed (1200×630). Build decodes to `public/og.jpg`. |
| Lockfile | `package-lock.json` pinned on `main`. |
| `XAI_API_KEY` | **You add this** on Vercel → Project → Settings → Environment Variables, Production + Preview. Grok / true-form / render stay soft-fail until then. |

## Live pass (Playwright vs production)

```
OK landing {status:200}
OK login-skip /workspace
OK eiffel   {pieces:580, kind:eiffel,   pdf:eiffel-frame-plan.pdf}
OK pocket   {pieces:26,  kind:closet,   pdf:bathroom-pocket-vanity-plan.pdf}
OK alcove   {pieces:26,  kind:closet,   pdf:bathroom-pocket-vanity-plan.pdf}
OK andersen {pieces:17,  kind:opening,  pdf:andersen-100-series-36-48-double-hung-plan.pdf}
SUMMARY {passed:6, failed:0, errors:[]}
```

Deterministic generate → plan → PDF works without AI, auth, or a database.

## Still you (not code)

1. Add `XAI_API_KEY` on the Vercel **yard** project (Production + Preview). Then walk the four chips yourself.
2. After that, Stage 1: any-query true-form wire, denser plates.

Do not start Stage 1 until the API key is set and you have walked the four chips on production.
