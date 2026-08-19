# Yard — Stage 0 status

Checked 2026-08-19 against production `dpl_8R4tGkVvxapzXaU7G8oECMcgDDRk` (commit `2f28bb91`) plus follow-up crash/auth deploys on `main`.

Production: https://yard-peach.vercel.app

## Stage 0 — done

| Check | Result |
|---|---|
| PGLite never boots on Vercel | `dbSource = none` without `DATABASE_URL`. Last PGLite ENOENT was 16:51 UTC on the *old* deploy `dpl_RjF3tEP6oHNiYnR3K1L2jwEEhFmC`. Zero new clusters after the fix. |
| Auth degrades to signed-out | Memory adapter via `better-auth/adapters/memory`. Auth off unless `VITE_AUTH_ENABLED=true`. Skip still opens the bench. |
| Landing / bench / login | `/` 200 · `/workspace` 200 · `/login` 200 |
| Live pass | Eiffel 580 pcs · pocket vanity 26 pcs · alcove closet 26 pcs · Andersen 36×48 17 pcs — each opened Build plan and exported a PDF |
| PWA icon | `/__grok/icon-180.png` 200 |
| Share card | `/og.jpg` still 404 until `scripts/brand/og.jpg.b64` lands on the next deploy |
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

## Still optional / next

1. Add `XAI_API_KEY` (you) so true-form query and finished-piece render light up.
2. Commit `og.jpg.b64` if `/og.jpg` is still 404 after this pass.
3. Pin `package-lock.json` when convenient (Vercel already builds without it).
4. Stage 1 later: any-query true-form wire, denser plates, Amazon affiliate tag, Neon.

Do not start Stage 1 until you have set the API key and walked the four chips yourself.
