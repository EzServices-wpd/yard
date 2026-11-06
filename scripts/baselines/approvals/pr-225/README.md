# DRAFT — NOT APPROVED. Size spellings: NR-1 one length reader, PR #225 (r5, fc7de9e)

Status: waiting for the Critic regrade of r5. This card is not for Ezra to answer until the Critic PASS is logged in
CLAUDE-PROGRESS.md. Nothing here is approved.

## The rule, in plain words
- Every spelling of one size builds the same thing as its digits: "2 1/2 ft", "2'6\"", "2 ft 6 in", "thirty inches",
  "two and a half feet", "762 mm", "76.2 cm" all build as "30". On release about 4 in 10 of these spellings build
  something else, usually the class default size.
- A spelled count of feet or a part's length is not a size: "coffee table with four feet", "four foot legs",
  "five one foot shelves" build like the host without them (r5).
- Text release reads its own way (commas, arches, "N-inch wide", "N' long", "width N ft") still builds as on release.

## Measured effect (head r5 fc7de9e vs release e8a8119; 6,433 prompts)
1,962 prompts move: 488 price-ups (189 distinct builds), 834 price-downs (383 builds), 640 same price or refusal
changes (247 builds). Every price-up is listed one by one in `movers.md`, with builds gaining 8+ pieces in their own
table.

Checks on the movers (from `release.jsonl` / `head-r5.jsonl`):
- Never away from the typed size: of the sweep movers, 1,751 now build the typed axis exactly where release did not;
  0 moved away from a typed size release had honoured.
- Spelling agreement: of 3,468 spelled/unit sizes compared with their digit form, release disagrees on 1,319; r5 on
  125. Of those 125, 111 are "<host> with 1 shelf" ("with Shelf" combined build; see below) and 14 are a stool with a
  feature word and a marked size (parked).
- 35 prompts newly refuse; each one's digit form refuses on release too (e.g. "bookcase twenty-four inches tall with
  three shelves" now refuses like "bookcase 24 tall with three shelves"). 0 newly build.
- Canaries: eval gate on fc7de9e, 7/7 identical. Eval gate Δ 0 on its 511 prompts.
- Largest price-ups come from a typed height now being built: "step stool six feet tall with 1 shelf" (+$160.22),
  "desk seventy-two inches tall with two drawers" (+$153.72). Median price-up +$33.45.

## Not in this card
- "<host> with 1 shelf / an open shelf" at a non-digit size still builds a combined "with Shelf" build (release does
  too). Its fix is branch `class-card1-any-size` (f1e7472), graded on its own after this one.

## Rerun the generator
From the root of each checkout (release, then the PR head):
```
python3 scripts/baselines/approvals/pr-225/sweep.py <corpus.json> <probe.jsonl> > prompts.json   # or use the committed prompts.json
npx tsx scripts/baselines/approvals/pr-225/observe.mts scripts/baselines/approvals/pr-225/prompts.json out.jsonl
python3 scripts/baselines/approvals/pr-225/movers.py release.jsonl head.jsonl > movers.md
```
`prompts.json` = every eval-corpus prompt, the 712 Critic NR-1 probe prompts, and a seeded sample (seed 20261106) of
30 hosts × 6 sizes × every spelling × axis × 4 feature forms. `nr1-r5.diff` is the engine change (release → r5).
Tests: `src/lib/yard/lengthReader.test.ts` (NR-1 cards and r5 property), Critic probe `scripts/nr1.critic.test.ts`
on `critic/nr1-head`.

## Draft card (for Chief to relay after the Critic PASS)
> Approve size spellings? Every way of typing one size ("2 1/2 ft", "2'6\"", "thirty inches", "762 mm") builds what
> its digits build; today about 4 in 10 of those spellings build the default size instead. 1,962 tested prompts move:
> 488 cost more because the size you typed is now built (all 488 listed, biggest: a six-foot step stool +$160.22,
> a 72"-tall desk +$153.72), 834 cost less, 35 now refuse exactly like their digit spelling already does. Canaries
> don't move.
