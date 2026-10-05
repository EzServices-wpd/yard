# Quickstart: Engine Cleanup validation

## Prerequisites

- Repo at `/workspace/yard-chief`, deps installed (`npm ci` if needed)

## Validate snapshots

```bash
npx tsx --test src/lib/yard/promptSnapshots.test.ts
# or full unit suite:
npx tsx scripts/run-unit-tests.ts
```

Expect ~40 ok cases; linen overall 31.5 / 78 / 16.

## Validate facade after split

```bash
npx tsc --noEmit
npx tsx --test src/lib/yard/promptSnapshots.test.ts
npx tsx scripts/shallow-wall-cabinet.test.ts
```

## Architecture doc

Confirm `docs/ARCHITECTURE.md` paths exist:

```bash
rg -o '`src/lib/yard/[^`]+`' docs/ARCHITECTURE.md | tr -d '`' | while read p; do test -e "$p" && echo OK "$p" || echo MISSING "$p"; done
```

## Full local guards (before push)

Mirror `.github/workflows/guards.yml`: typecheck, honesty smoke/guards, affiliate/buy/stand/climb/span guards, unit tests, vite build.
