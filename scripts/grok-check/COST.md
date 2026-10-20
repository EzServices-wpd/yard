# Nightly arm-B check: cost estimate

Written Oct 19, 2026, about 6:40 PM ET. **No paid call was made to write it.** The figures come from the A/B token counts, the usage recorded on the 118 real B calls from Oct 19, and xAI's published price. To reproduce them, run `npx tsx scripts/grok-check/cost.ts`.

## Price (arm-B model `grok-4.20-0309-non-reasoning`)
- **$1.25 per 1M input tokens, $0.20 per 1M cached input, $2.50 per 1M output** for prompts under 200k tokens. Every token in a request that reaches 200k bills at $2.50 / $0.40 / $5.00 instead. A B call is about 1.4k tokens, so that rate never applies.
- Source: https://docs.x.ai/developers/pricing. The page says "Last updated: October 10, 2026". It was fetched on Oct 19, 2026 at 6:28 PM ET. The same rates are in `budget.ts`.
- No Batch discount (20% off, up to 24 h) is assumed, and neither the US regional endpoint (1.1×) nor Priority (2×) is used.

## Per-run corpus and tokens
- **118 B calls per run.** That is one per prompt in `corpus.json`: the 100 Grok prompts plus 18 persona prompts from the A/B, each with its frozen intake spec. There are no intake (A) calls at night.
- **Tokens per call** (grok-intake-ab `tokens.json`, tiktoken o200k, an approximation):
  - Input mean 1,125 (p95 1,541), of which 525 is the cacheable system prompt + schema.
  - Output mean 67 (p95 121).
- **Measured by xAI on the 118 recorded calls:**
  - Prompt mean 1,396 (p95 1,813, max 2,573), of which 505 was cached on average.
  - Output mean 37 (p95 122, max 143).
- Formula, same as `cost_calc.py`: `cost_call = (I − h·P)·p_in + h·P·p_cache + O·p_out`.

## Cost
The monthly figure assumes a nightly run, 30.44 runs per month (365.25 / 12).

| Basis | Per run | Per month (nightly) | $2 cap ÷ run |
|---|---|---|---|
| o200k mean, no cache | $0.1856 | $5.65 | 10.8× |
| o200k mean, prefix cached (1 cold call, then hits) | $0.1211 | $3.69 | 16.5× |
| o200k p95, no cache | $0.2630 | $8.00 | 7.6× |
| **Recorded Oct 19 run (billed by xAI)** | **$0.1541** | **$4.69** | **13.0×** |
| Recorded tokens priced with no cache | $0.2167 | $6.60 | 9.2× |
| Pre-call reservation (what the cap check counts) | $0.4456 | $13.56 | 4.5× |

**Expect about $0.15–0.26 per run and $4.70–8.00 per month.**

**How the $2 cap compares:**
- A full 118-prompt run costs 8–13× less than the cap, so the cap never cuts a normal run short. It is a ceiling for a bad night: a much bigger corpus, very long summaries, or a price change.
- Each call is priced before it is sent, from a token count that is never below xAI's own count. Over the 118 recorded calls the count averaged about 1.3× the real one. Output is reserved at the full 600 max tokens.
- So the cap stops a run before it could pass $2. The largest possible monthly total is $2 × 30.44 = **$60.88**.
- The cap can be lowered with `--cap`. It cannot be raised in code.

## Caveats
- The summaries no longer include the internal `Kind:` line, and the system prompt gained two sentences: judge the noun by the Title, and count drawers by their fronts.
  - Together they add about 7% to the input bytes: about 100 tokens per call, or roughly +$0.015 per run (+$0.45 per month). The table's o200k and recorded rows don't include this; the reservation row does. Tonight's release summaries are shorter: the off-mode run on `release/2026-10-22` reserved $0.42 and expected about $0.19.
  - Their effect on B's own answers can't be measured without a paid call. The false-positive filter is measured on recorded outputs only (`fp-report.json`).
- o200k is not xAI's tokenizer. The billed figure is the ground truth.
