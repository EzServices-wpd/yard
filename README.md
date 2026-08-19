# Yard

Playground for makers. Utility for real-world builders.

Permanent repo: **this one**. Future work is commits here — not new repositories.

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

Dev server: `0.0.0.0:8080`.

## Deploy (Vercel)

Wait until `src/lib/yard/` and `src/components/workspace/` are fully populated (see map below).

1. Vercel → Import `EzServices-wpd/yard`
2. Framework: Vite / Nitro (from `vite.config.ts` `nitro({ preset: "vercel" })`)
3. Build: `npm run build`
4. Optional env: `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG` (shop chips work without it)

Do **not** set a custom root directory. `package.json` is at repo root.

## Folder map (keep this)

```
src/
  routes/                 # landing, login, /workspace
  components/workspace/   # bench UI (canvas, plan, measure, export)
  components/brand/       # logo
  lib/yard/               # product engines (do not dump new features at root)
    types.ts              # project / BOM / window / fitted types
    catalog.ts            # retail SKUs
    prompt.ts             # prompt → project
    structures/           # latticeTower / Eiffel
    fitted.ts pocket.ts   # measured openings → cabinetry
    windows.ts            # stock units + framing
    report.ts steps.ts    # unique instructions + plan
    pdf.ts                # printable export
    store.ts              # zustand bench state
  lib/ai/grok.ts          # optional language / true-form query
  lib/auth/               # optional sign-in (preview + deploy)
scripts/                  # migrate, PWA, smoke tests
migrations/               # SQL (0001_auth, then 0002_…)
```

New feature → new file under the matching folder. Do not start another repo.

## Guidance

Yard is guidance only — not stamped engineering or a substitute for local code.
