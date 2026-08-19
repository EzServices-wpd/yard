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

## Stage 1 — one structure, not stacked floors

Local loft (not pushed):

```
eiffel 36" popsicle   416 pcs · 1 cluster · 0 loose · four piers + shaft
eiffel 12" popsicle   138
eiffel 12" toothpick  264  (denser)
eiffel 36" toothpick 1142 · 1 cluster · 0 loose
giraffe               126 · spine offered
liberty / taj / igloo 390 / 867 / 163 · 1 cluster
dragon (not on list)  178 · winged figure class
closet / Andersen     26 / 17 unchanged
```

## Stage 1 — print path (local, no Grok)

```
Sydney Opera House     shell / dome · 258 pcs · 1 cluster
Godzilla               figure · 302 pcs · 1 cluster
4-ft 2x4 workbench     fitted closet · 16 panels
Eiffel / giraffe / closet plans  cuts + BOM + ≥7 steps + PDF written
```

`?local=1` skips Grok so we do not burn credits.

## Stage 2 — refined locally (not pushed)

Every demo and wild prompt: a cut list, a buy list with at least one live listing, illustrated steps, a PDF plate per step.

- Buy: same-size listings sorted by unit price. No line without a href.
- Amazon: `stampAmazon` adds `tag=` when `VITE_PUBLIC_AMAZON_ASSOCIATE_TAG` is set. Off until then. No other switch.
- View on bench: drawer closes, a banner names the step, only those pieces stay lit.

Still local. No Grok. No GitHub / Vercel push.
