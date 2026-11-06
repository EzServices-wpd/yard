LOCK: none

# Claude progress log

Shared log for the Yard bot team. Lives on `release/2026-10-24`. Always pull this branch before reading it.

## Lock

The first line of this file is the push lock. One active pusher at a time.

- Free: `LOCK: none`
- Held: `LOCK: <bot> | item: <short name> | started: <YYYY-MM-DD HH:MM ET> | status: in-progress`

To push: pull `release/2026-10-24` → if the lock is held, wait → otherwise write your lock line, commit and push it → only then start the change. Clear it (back to `LOCK: none`) after the regrade on the new main confirms canaries are still byte-identical.

## Rules

- Only items with an explicit Critic PASS entry below are eligible to push. No entry, no push.
- One at a time: `release/2026-10-24` → squash PR to `main` → merge `main` back. No rebase, no force-push, no direct commits to `main`.
- After each landing, regrade on the new `main` and confirm canaries are byte-identical before the next. On any failure: stop, revert that one, move it to PARKED-IDEAS.
- Anything that raises a price or changes a part size: PR may be opened, never merged until Ezra's explicit yes with the full mover list.
- Hands off Vercel settings and env vars.

## Critic PASS entries

Whoever runs the Critic pastes the short PASS summary here right after the grade.

Format: `- <YYYY-MM-DD> | <item> | PASS | <one-line summary> | moves price/part size: yes/no | verdict: <path or link>`

(none yet)

## Landings

Format: `- <YYYY-MM-DD HH:MM ET> | <item> | PR #<n> | main <sha> | regrade: canaries identical yes/no | by <bot>`

(none yet)

## Session notes

Newest first. Tip, canary status, the rule per change, before/after prompts, files, tests, parked items.

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
