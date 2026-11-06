# Bot load file — read this first on resume

Snapshot 2026-11-06 08:45 ET · release `release/2026-10-24` · main `5a21262` · written by Claude for the Grok team (YARD Chief, Critic).

This is the one page that gets a bot from cold to working. Detail lives in `CLAUDE-PROGRESS.md` (session log, lock, PASS log, landings) and `PARKED-IDEAS.md`. If anything here disagrees with those two, they win; if a canary is red, the canary wins.

## 1. Load order

1. `git pull` `release/2026-10-24`. Check line 1 of `CLAUDE-PROGRESS.md` — `LOCK: none` means free.
2. This file.
3. `CLAUDE-PROGRESS.md` → newest "Session notes" entry.
4. `PARKED-IDEAS.md`.
5. `docs/BOT.md` / `docs/BOT-BRIEF.md` for product voice and canaries. Their NEXT queue (Sep 20) is stale; the queue below replaces it.

## 2. Where things stand

| Item | Branch / PR | Tip | State | Blocked on |
|---|---|---|---|---|
| NR-1 r5: one length reader | `class-number-reader` · PR #225 | `fc7de9e` | CI green (guards, eval-gate Δ0/511, canaries 7/7) | Critic regrade of r5 → PASS logged → Ezra's yes on mover card |
| #225 mover folder (DRAFT) | `movers/nr1-r5` | `20aed8a` | 6,433 prompts: 1,962 move — 488 price-ups (189 builds, all listed), 834 down, 640 same/refusal | Card not shown until r5 PASS is logged |
| Class F card 1 at any size spelling | `class-card1-any-size` | `f1e7472` + movers `4dc2add` | 213 move vs r5, all price-downs, 0 ups; NR-1 probe A–E pass | Graded only after #225 lands (built on r5) |
| Critic NR-1 probe | `critic/nr1-base`, `critic/nr1-head` | `62b9bba`, `bbca4d6` | Probe harness, **do not merge** | — |
| Other open PRs | #231, #203, #202, #121, #120, #119, #118, #11 | — | Not Claude's; not in this queue | — |

Nothing has landed via the push rules yet (Landings: none). No Critic PASS entries yet.

## 3. Next, in order (one at a time)

1. Critic regrades `class-number-reader` @ `fc7de9e`. PASS → paste the line in `CLAUDE-PROGRESS.md` → Critic PASS entries.
2. Only then: show Ezra the #225 mover card from `scripts/baselines/approvals/pr-225/` (`movers.md` lists every price-up). It moves prices and part sizes, so the PR is never merged without his explicit yes.
3. After #225 lands and the regrade on new main keeps canaries byte-identical: regrade `class-card1-any-size` on that main, Critic, then its own card.
4. Parked (each its own class, round and mover list — see `PARKED-IDEAS.md`): "<host> with Shelf" for non-card-1 hosts; digit "with 4 feet" read as size; stool + feature words drops a unit-marked size; "A linen needs…" refusal wording (wording → needs Ezra's yes).

## 4. Standing rules (from Ezra — all of them, in one place)

Engine
- Priority: engine really amazing → stranger-build test (one real person, one PDF) → launch. Docs and PR backlog after.
- Fix whole classes with invariants / property tests. Small rounds: one fix, one regrade. Unsolved → `PARKED-IDEAS.md`. No new slow test gates.
- New typed-intent work builds on the existing number reader (`src/lib/yard/lengthReader.ts`), never a second reader.
- Answer keys stay report-only until five are verified against real plans. C19 stays in PR gates for now.
- ¼" plywood is back, drawer-bottom stock only, never a carcass.

Approvals
- Anything moving a price, part size, canary build or user-facing wording needs Ezra's explicit yes with the exact list of prompts that move (exception: correct plywood-stock changes).
- Price-ups: list every one on the card, plus builds gaining many pieces with before/after prices.
- One folder per change: patch, mover list, tests, and the generator so the grader can rerun it (pattern: `scripts/baselines/approvals/pr-225/`).
- Each change is graded alone. Never stack a card on an ungraded change or send it before its grade. A card isn't shown until the grader has confirmed it.
- Never edit an existing test that pins old behaviour without Ezra's yes (loosening a test needs approval).
- Canaries stay byte-identical.

Git / infra
- Flow: `release/2026-10-24` → squash PR to `main` → merge `main` back. Never rebase or force-push; no direct commits to `main`.
- Push only items with a Critic PASS logged in `CLAUDE-PROGRESS.md`. Take the lock (commit + push the lock line) before starting; clear it after the regrade on new main. Fail → stop, revert, park. Log every landing.
- Hands off Vercel settings and env vars. Ask before running any Vercel Sandbox.
- Messages to Ezra only for finished changes or real blockers.

## 5. Gaps this file closes

Everything Claude built is on the branches above and logged in `CLAUDE-PROGRESS.md`. Before this file, three things were not in the repo:
- The full rule list (§4) — the log carried only the push rules.
- The `movers/nr1-r5` tip `20aed8a` (agreement counts on the published prompt set) — committed after the last log entry.
- A current queue — `docs/BOT.md` NEXT still showed September's Slice D.

Keep this file current: update §2 and §3 at the end of every session, in the same commit as the progress log.
