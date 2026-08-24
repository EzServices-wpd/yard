# Yard soft-launch log

Autonomous closeout plan started **2026-08-24**. Founder input paused until 10/10 or hard stop.

## Gates

| Phase | Gate | Status |
|-------|------|--------|
| P0 | Auto-capture on plan + enrich retry + shop glossary in PDF | **Shipped** — AutoCaptureRunner + autoCapture helper + one-shot enrich retry (shortened baseline) + PDF glossary (18 terms) + 300pt full-width step photos |
| P1 | Freeze-4 geometry + plan quality | **Green** — last walk-launch 10/10 at tip 1301e58 / 365fdad; all subsequent soft-launch commits (photos, nest, steps language, glossary, auto-capture, retry) are size-preserving. Linen stays 31.5 × 78 × 16. walk-soft-launch.ts asserts sizes + nest + shop terms. |
| P2 | Full 10 launch builds | **Green** (same evidence as P1; walk-soft-launch covers all 10) |
| P3 | Docs freeze package | **Shipped** this file + scripts/walk-soft-launch.ts + PRODUCTION.md trail |

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Start | a2d3894 | Glossary + photo size |
| P0 scripts | 43bdc4b | walk-soft-launch.ts + SOFT_LAUNCH.md |
| P0 helper | b586522 | autoCapture.ts |
| P0 runner | 7043279 | AutoCaptureRunner component |
| P0 mount | 202ee1f | Canvas mounts AutoCaptureRunner |
| P0 retry | 35ebfe9 | one-shot enrich retry on parse fail |
| Status | this | P0–P3 closed for soft-launch; stranger path live |

## Run

```bash
npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
npx tsx --tsconfig tsconfig.json scripts/walk-soft-launch.ts
```

Photo capture runs automatically after makePlan for panel builds (first 4 steps, ~1.2s each). Enrich retries once on parse failure with a shortened baseline.

## Stranger path (no founder)

1. Land on yard-peach.vercel.app → type a house opening (e.g. "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep").
2. Bench builds. Click **Build plan**.
3. AutoCaptureRunner silently walks the first 4 steps and attaches bench JPEGs.
4. Open Export PDF → full-width photos, Cut this 4×8 nest, Shop words glossary, one-action steps with parentheticals.
5. First-time builder has definitions for carcase / toekick / dry-fit / lag / shim / scribe / kerf / 32mm etc.

## Do not

- New forms, hourly bot, Amazon tag, domain, accounts until founder go.
