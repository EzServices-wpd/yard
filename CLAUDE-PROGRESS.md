LOCK: none

# Claude progress log

Shared log for the Yard bot team. Lives on `release/2026-10-24`. Always pull this branch before reading it. Cold start: read `docs/BOT-LOAD.md` first (queue, state, every standing rule).

## Lock

The first line of this file is the push lock. One active pusher at a time.

- Free: `LOCK: none`
- Held: `LOCK: <bot> | item: <short name> | started: <YYYY-MM-DD HH:MM ET> | status: in-progress`

To push: pull `release/2026-10-24` → if the lock is held, wait → otherwise write your lock line, commit and push it → only then start the change. Clear it (back to `LOCK: none`) after the regrade on the new main confirms canaries are still byte-identical.

## Rules

- Only items with an explicit Critic PASS entry below are eligible to push. No entry, no push.
- One at a time: `release/2026-10-24` → squash PR to `main` → merge `main` back. No rebase, no force-push, no direct commits to `main`.
- After each landing, regrade on the new `main` and confirm canaries are byte-identical before the next. On any failure: stop, revert that one, move it to PARKED-IDEAS. For the #235 ship, the canary check on record is Critic's r5 grade (unchanged vs then-release `afcb1f8b`); do not open a second main regrade for it, and do not block the approved queue on one.
- Grade the model, the steps, and the parts (correct items and quantities). A price total that follows the catalog from those parts is not its own grade: no dollar-delta card, and no Ezra yes on a price-up list. Wrong Buy items or quantities still block. User-facing wording still needs Ezra's yes. Never loosen a pinning test without Ezra's yes.
- Hands off Vercel settings and env vars.

## Critic PASS entries

Whoever runs the Critic pastes the short PASS summary here right after the grade.

Format: `- <YYYY-MM-DD> | <item> | PASS | <one-line summary> | moves price/part size: yes/no | verdict: <path or link>`

- 2026-11-06 | NR-1 r5 (#225, head `fc7de9efb98af31f9ae3324df177384d8bbebf7f`) | PASS | vs then-release `afcb1f8b` ~9:24 AM ET, lean bar (model, steps, parts only). Zero blockers. Digit forms ("with 4 feet") parked (= release). Axis forms still sizes. 0 movers drop a typed size release honoured. 35/35 new refusals match their digit twins. Canaries unchanged. eval-gate Δ 0. Tests 2116/2116. No loosened tests. | moves price/part size: yes (catalog follows the parts; no dollar-delta card) | verdict: Critic grade 2026-11-06 ~9:24 AM ET (no verdict path recorded)

## Landings

Format: `- <YYYY-MM-DD HH:MM ET> | <item> | PR #<n> | main <sha> | regrade: canaries identical yes/no | by <bot>`

- 2026-11-06 09:36 ET | NR-1 r5 one length reader (squash of release after #225) | PR #235 | main `cf05d769fee45089ce5ac70e2dd45343515667a9` | regrade: canaries identical yes — Critic's r5 grade found canaries unchanged vs then-release `afcb1f8b`; no separate post-merge main regrade | by YARD Chief

## Session notes

Newest first. Tip, canary status, the rule per change, before/after prompts, files, tests, parked items.

### 2026-11-06 ~10:04 ET | NR-1 (#225) shipped; lean bar; approved queue

- Lock not taken (`LOCK: none`). Docs only. Release tip now `deabae9d818a04a59bbd99104456df485eed0f88`, which is also the #236 merge-back tip (HEAD has not moved past it). Main `cf05d769fee45089ce5ac70e2dd45343515667a9`.
- Critic PASSed #225 r5 (head `fc7de9efb98af31f9ae3324df177384d8bbebf7f`) vs then-release `afcb1f8b` on 2026-11-06 ~9:24 AM ET, under Ezra's lean bar (model, steps, and parts only; no dollar-delta / price-up card). Zero blockers. Digit forms like "with 4 feet" parked (= release). Axis forms still sizes. 0 movers drop a typed size release honoured. 35/35 new refusals match their digit twins. Canaries unchanged. eval-gate Δ 0. Tests 2116/2116. No loosened tests.
- Merged #225 into `release/2026-10-24` as `efbd49fc9b3df273f2832f143649289969a5c749` (merge commit, 09:26 ET; PR head stayed `fc7de9ef`). Squash PR #235 (release → main) merged 09:36 ET: main `cf05d769fee45089ce5ac70e2dd45343515667a9`, by YARD Chief. Merge-back PR #236 (main → release, plain merge) 09:37 ET: `deabae9d818a04a59bbd99104456df485eed0f88`.
- Regrade recorded for #235: Critic's r5 grade found canaries unchanged vs then-release. No separate post-merge main regrade was run; do not invent one, and do not block the queue on it.
- Production deploy for `cf05d769` was started (`dpl_52Xfso1fZnEGQazXtNTUiQVPnioV`) and was last seen BUILDING. yard.wiki is not confirmed live.
- Lean grading bar (Ezra, 2026-11-06 ~8:37 AM ET, standing): grade only the model, the steps, and the parts (correct items and quantities). Drop dollar-delta cards; price follows the catalog from those parts. A changed total is not its own grade and does not need Ezra's click on a list of price-ups. Still block on a bad model, wrong or mismatched steps, wrong Buy items or quantities, a loosened test, a false claim, a canary or protected-build regression, or a privacy/auth risk. User-facing wording changes (e.g. "A linen needs…") still need Ezra's yes. Canaries stay byte-identical. Never loosen a pinning test without Ezra's yes.
- Approved next queue (Ezra, 2026-11-06 ~10:04 AM ET):
  1. Finish the in-flight grade of `class-card1-any-size` (tip `f1e7472` + movers `4dc2add`; 213 movers, all price-downs). Sent to Critic after #225 landed. Waiting for Critic PASS/BLOCK. If PASS, ship the usual way (release → squash PR to main → merge main back). No dollar-delta card.
  2. Then land Claude's already-written output-neutral engine-speed patch (compile hot regexes once, precompute family words, cache graded gate rows; no build-output change). Grade, then ship.
  3. Then parked honesty classes, one at a time: other hosts that still become "with Shelf" and drop the typed size; digit forms like "with 4 feet"; stool plus a feature word dropping a unit-marked size; equal bays (dividers that ignore their own thickness).
  4. "A linen needs…" refusal wording still needs Ezra's yes before any change.
- Do not resume SWE 2, Critic 2, or Design.

### 2026-11-06 (later) | #225 mover folder; class F card 1 fix held behind #225

- Release tip `e8a8119`. Lock not taken (no landing).
- #225 DRAFT mover folder: branch `movers/nr1-r5`, `scripts/baselines/approvals/pr-225/` (generator sweep.py +
  observe.mts + movers.py, prompts.json 6,433, release/head outputs, movers.md, nr1-r5.diff, draft card text).
  r5 vs release: 1,962 move — 488 price-ups (189 builds, every one listed), 834 down, 640 same-price/refusal.
  0 movers leave a typed size release honoured; 35 new refusals each match their digit spelling's refusal on release.
  Card not to be shown until the Critic PASS of r5 is logged here.
- Class F card 1 at every size spelling: branch `class-card1-any-size` (f1e7472 + mover folder 4dc2add), built on r5.
  Rule: CARD1 reads any spelling the one reader reads as its inches, so "desk 4 ft wide with an open shelf" builds the
  48" desk, not an 84" "Desk with Shelf". vs r5: 213 move, all price-downs, 0 ups. Critic NR-1 probe A–E all pass.
  Test: typedCounts.test.ts (5 hosts × 13 spellings × 3 shelf forms; fails on the old CARD1). Unit suite same as r5.
  No PR yet: graded after #225.
- Parked: stool + feature words drops a unit-marked size; "A linen needs ..." refusal wording.

### 2026-11-06 | NR-1 r5 (PR #225, `class-number-reader` fc7de9e) | waiting for Critic

- Release tip `afdc8b1`, main `5a21262`. Lock not taken (no landing this session).
- Why: Critic NR-1 probe (critic/nr1-head, 2026-11-05) failed test B: r4 read a spelled count of feet as a size.
- Rule: a spelled number before feet/foot is not a length when with/on/and/has/plus comes before it or a part noun
  (legs, shelves, boards, rods, ...) follows it, unless an axis word follows ("two feet wide" is still 24").
- Before → after (r4 → r5; each after = release byte for byte):
  - "coffee table with four feet" 48x22x18 $48.51 → 40x40x18 $62.94
  - "side table with three feet" 36x36x22 $64.38 → 20x20x22 $45.95
  - "table with four foot legs" 48x36x30 $68.88 → 40x40x30 $68.88
  - "bookcase with two foot shelves" 36x12x24 $83.35 → 36x12x84 $131.76
  - "bookcase with five one foot shelves" / "with 5 one foot shelves" 36x12x12 $83.35 → 36x12x84 $131.76
  - No other probe prompt moved (712 compared). Digit forms ("with 4 feet") unchanged = release.
- Files: src/lib/yard/lengthReader.ts, src/lib/yard/lengthReader.test.ts (new r5 property; fails with the rule off).
- CI on fc7de9e: guards ✅, eval-gate ✅ (Δ 0 on 511 prompts), canaries 7/7.
- Probe A and D still fail; both failures are on release too ("<host> with Shelf" ignores the typed size). Parked in
  PARKED-IDEAS.md, not NR-1's.
- NR-1 vs release still moves 265 probe prompts (67 price-ups, 110 price-downs); needs Critic PASS, then Ezra's yes with the
  full mover list before merge.
- Next: Critic regrade of r5; then the mover card.
