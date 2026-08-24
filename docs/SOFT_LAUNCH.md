# Yard soft-launch log

Autonomous closeout plan started **2026-08-24**. Founder input paused until 10/10 or hard stop.

## Gates

| Phase | Gate | Status |
|-------|------|--------|
| P0 | Auto-capture on Build plan + enrich retry + shop glossary in PDF | In progress @ tip post-a2d3894 |
| P1 | Freeze-4 (linen, pocket, Andersen, desk) geometry + plan quality | Pending |
| P2 | Full 10 launch builds | Pending |
| P3 | Docs freeze package | Pending |

## Run

```bash
npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
npx tsx --tsconfig tsconfig.json scripts/walk-soft-launch.ts
```

Photo capture and enrich require a live browser on production (WebGL). Geometry/nest/steps are CI-checkable.

## Freeze-4 expected sizes

| Build | Size / kind |
|-------|-------------|
| Linen | 31.5 × 78 × 16 closet |
| Pocket | trapezoid RO → rectangular unit, closet/vanity |
| Andersen | opening, 36×48 RO path |
| Desk | 60 × 30 × 29, 24″ knee |

## Results

_Append rows as walks complete._

| When | Tip | walk-launch | walk-soft-launch | Notes |
|------|-----|-------------|------------------|-------|
| 2026-08-24 start | a2d3894 | last green Phase 0 | not yet | P0 code next |

## Do not

- New forms, hourly bot, Amazon tag, domain, accounts until founder go.
