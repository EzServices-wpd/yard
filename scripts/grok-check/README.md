# Grok after-build check (arm B), nightly, report only

`run.ts` builds each prompt in `corpus.json` with the newest `release/*` engine and sends Grok the frozen intake spec plus the build summary. It drops the known false positives (`filter.ts`) and writes `grok-check.json` / `.md`. The nightly workflow uploads both as an artifact. Nothing is ever fixed, gated or posted.

- **Off by default:** a live call needs **both** the repo variable `YARD_GROK_CHECK=on` **and** the `XAI_API_KEY` secret (`client.ts`). With either one missing, the workflow never receives the key, and the run builds the summaries and prices them without calling.
- **$2/run cap** (`budget.ts`): each call is priced before it is sent, at input tokens × the no-cache rate + 600 output tokens. The run stops at the first call that would pass the cap. Real usage is then charged from xAI's `usage`.
- **False positives** (`filter.ts`, measured by `measure-fp.ts` on the recorded Oct 19 outputs):
  - kind-noun: the internal `Kind:` was read as the noun
  - present: features that are present were flagged
  - drawer-parts: drawer parts were counted as drawers
  - Result: 31 → 8 false positives, 0 real flags dropped (`fp-report.json`).
- **No paid calls in tests:** `scripts/grok-check.test.ts` uses the recorded fixtures and a fake fetch, and fails if anything touches the real `fetch`.
- **Cost:** see `COST.md`.

```
npx tsx scripts/grok-check/run.ts --replay scripts/grok-check/fixtures/ab-2026-10-19.json --out /tmp/gc   # recorded, no engine, no network
cd <release checkout> && npx tsx <main>/scripts/grok-check/run.ts --root . --out /tmp/gc                 # off unless switched on
npx tsx scripts/grok-check/measure-fp.ts      # false positives before/after on recorded outputs
npx tsx scripts/grok-check/cost.ts            # cost estimate
```
