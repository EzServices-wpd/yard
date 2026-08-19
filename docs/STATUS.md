# Yard — status

Checked 2026-08-19.

## Stage 0 — production stable

| Check | Result |
|---|---|
| PGLite never boots on Vercel | `dbSource = none` without `DATABASE_URL`. |
| Auth degrades to signed-out | Memory adapter. Auth off unless `VITE_AUTH_ENABLED=true`. |
| Landing / bench / login | `/` 200 · `/workspace` 200 · `/login` 200 |
| Share card + PWA + lockfile | on `main` |
| `XAI_API_KEY` | Set on Vercel. Grok true-form works on production. |

## Stage 1 — connected builds, stock-scaled detail

Local harness (`scripts/yard-stage1-connect.ts`):

```
eiffel 36" popsicle   926 pcs · 1 cluster · 0 loose
eiffel 12" popsicle   280 pcs
eiffel 12" toothpick  594 pcs  (denser than popsicle at the same height)
eiffel 36" toothpick 3032 pcs · 1 cluster · 0 loose
giraffe popsicle       39 pcs · 1 cluster · spine offered
closet / Andersen      26 / 17 pcs unchanged
```

- Face lattice sits on the same joints as the corner chords. Arches reuse the base corners.
- Splices lap. Mid-span crossings count as joins.
- Figures always generate; a spine is offered, not forced.
- No material quantity cap. 8,000 is a renderer hitch limit only.

Contractor path (pocket vanity, alcove closet, stock window) is unchanged.
