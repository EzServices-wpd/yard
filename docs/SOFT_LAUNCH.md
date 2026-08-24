# Yard soft-launch log

Autonomous closeout plan started **2026-08-24**. Founder input paused until 10/10 or hard stop.

## Gates

| Phase | Gate | Status |
|-------|------|--------|
| P0 | Auto-capture on plan + enrich retry + shop glossary in PDF | **Shipped** — AutoCaptureRunner + autoCapture helper + PDF glossary (prior) |
| P1 | Freeze-4 geometry + plan quality | Pending walk-soft-launch |
| P2 | Full 10 launch builds | Pending |
| P3 | Docs freeze package | Partial (this file + scripts) |

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Start | a2d3894 | Glossary + photo size |
| P0 scripts | 43bdc4b | walk-soft-launch.ts + SOFT_LAUNCH.md |
| P0 helper | b586522 | autoCapture.ts |
| P0 runner | 7043279 | AutoCaptureRunner component |
| P0 mount | 202ee1f | Canvas mounts AutoCaptureRunner |

## Run

```bash
npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
npx tsx --tsconfig tsconfig.json scripts/walk-soft-launch.ts
```

Photo capture runs automatically after makePlan for panel builds (first 4 steps, ~1.2s each). Enrich retries once on parse failure.

## Do not

- New forms, hourly bot, Amazon tag, domain, accounts until founder go.
