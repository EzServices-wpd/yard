# Bot load file — read this first on resume

Snapshot 2026-11-06 10:33 ET · release `release/2026-10-24` @ `b0bdccff` · main `3cb57853` · written by Claude for the Grok team (YARD Chief, Critic).

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
| NR-1 r5: one length reader | shipped · #225 into release · squash #235 release → main · merge-back #236 main → release | PR head stayed `fc7de9efb98af31f9ae3324df177384d8bbebf7f`. Release merge `efbd49fc9b3df273f2832f143649289969a5c749`. Main at that landing `cf05d769fee45089ce5ac70e2dd45343515667a9`. Merge-back #236 `deabae9d818a04a59bbd99104456df485eed0f88` | Critic PASS 2026-11-06 ~9:24 AM ET vs then-release `afcb1f8b`, under the lean bar (model, steps, parts only; no dollar-delta / price-up card). Zero blockers. Digit forms ("with 4 feet") parked (= release). Axis forms still sizes. 0 movers drop a typed size release honoured. 35/35 new refusals match their digit twins. Canaries unchanged. eval-gate Δ 0. Tests 2116/2116. No loosened tests. | — |
| CARD1 any-size spelling (class F card 1) | shipped · `ship/card1-any-size` · #238 into release · squash #239 release → main · merge-back #240 main → release | Engine head stayed `f1e7472a930dd929b31c6f92510bddd8adba43bf` (mover-folder tip `4dc2add4` was not merged). Release merge `e04795ae0d83af1375d2e3dcf12e45345bd19246`. Main `3cb578532eb00e5627e2d363ab9616452df3a70b` (2 files: `compose.ts`, `typedCounts.test.ts`). Release tip `b0bdccff09bdee04ca64feb70d41cfd9bc642347` | Yard Critic PASS vs then-release `deabae9d` / then-main `cf05d769`, lean bar (model, steps, parts only). Zero blockers. No price card. Headline: "desk 4 ft wide with an open shelf" builds as the typed-size desk matching the digit twin. Scope note (not a blocker): size-after, comma-before-shelf, and non-CARD1 hosts still Combined, same as that tip. Production deploy for `3cb57853` was not verified — yard.wiki is not claimed live | — |
| Critic NR-1 probe | `critic/nr1-base`, `critic/nr1-head` | `62b9bba`, `bbca4d6` | Probe harness, **do not merge** | — |
| Other open PRs | #231, #203, #202, #121, #120, #119, #118, #11 | — | Not in this queue | — |

Critic PASS entries for #225 and CARD1, and the #235 and #239 landings, are logged in `CLAUDE-PROGRESS.md`. Canaries for the #235 landing: Critic's r5 grade found them unchanged vs then-release `afcb1f8b`. There is no separate post-merge main regrade for #235. The CARD1 grade was against then-release `deabae9d` / then-main `cf05d769`; this update does not record a new canary check on main `3cb57853`.

## 3. Next, in order (one at a time)

Ezra's queue, 2026-11-06 ~10:04 AM ET. Item 1 is done.

1. DONE: `class-card1-any-size` shipped (#238 / #239 / #240).
2. NEXT: land Claude's output-neutral engine-speed patch (compile hot regexes once, cache graded gate rows; no build-output change). Grade, then ship.
3. Then parked honesty classes, one at a time: other hosts that still become "with Shelf" and drop the typed size; digit forms like "with 4 feet"; stool plus a feature word dropping a unit-marked size; equal bays.
4. "A linen needs…" wording still needs Ezra's yes.

Do not resume SWE 2, Critic 2, or Design.

## 4. Standing rules (from Ezra — all of them, in one place)

Engine
- Priority: engine really amazing → stranger-build test (one real person, one PDF) → launch. Docs and PR backlog after.
- Fix whole classes with invariants / property tests. Small rounds: one fix, one regrade. Unsolved → `PARKED-IDEAS.md`. No new slow test gates.
- New typed-intent work builds on the existing number reader (`src/lib/yard/lengthReader.ts`), never a second reader.
- Answer keys stay report-only until five are verified against real plans. C19 stays in PR gates for now.
- ¼" plywood is back, drawer-bottom stock only, never a carcass.

Approvals
- Lean grading bar (Ezra, 2026-11-06 ~8:37 AM ET, standing): grade only the model, the steps, and the parts (correct items and quantities). Price follows the catalog from those parts. A changed total is not its own grade. No dollar-delta card, and no Ezra click on a list of price-ups.
- Still block on a bad model, wrong or mismatched steps, wrong Buy items or quantities, a loosened test, a false claim, a canary or protected-build regression, or a privacy/auth risk.
- User-facing wording changes (e.g. "A linen needs…") still need Ezra's yes.
- One folder per change: patch, mover list, tests, and the generator so the grader can rerun it (pattern: `scripts/baselines/approvals/pr-225/`).
- Each change is graded alone. Never stack a grade on an ungraded change or send it before its grade.
- Never edit an existing test that pins old behaviour without Ezra's yes (loosening a test needs approval).
- Canaries stay byte-identical.

Git / infra
- Flow: `release/2026-10-24` → squash PR to `main` → merge `main` back. Never rebase or force-push; no direct commits to `main`.
- Push only items with a Critic PASS logged in `CLAUDE-PROGRESS.md`. Take the lock (commit + push the lock line) before starting; clear it after the regrade on new main. Fail → stop, revert, park. Log every landing.
- Hands off Vercel settings and env vars. Ask before running any Vercel Sandbox.
- Messages to Ezra only for finished changes or real blockers.

## 5. Gaps this file closes

NR-1 r5 and CARD1 any-size spelling are on release and main (§2). The critic probe branches stay unmerged (**do not merge**). Before this file, three things were not in the repo:
- The full rule list (§4) — the log carried only the push rules.
- The `movers/nr1-r5` tip `20aed8a` (agreement counts on the published prompt set) — committed after the last log entry.
- A current queue — `docs/BOT.md` NEXT still showed September's Slice D.

Keep this file current: update §2 and §3 at the end of every session, in the same commit as the progress log.
