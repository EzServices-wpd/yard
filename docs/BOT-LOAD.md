# Bot load file — read this first on resume

Snapshot 2026-11-07 08:40 ET · release `release/2026-10-24` @ `7134c41b` · main `db7cd481` · shadow fastener demand shipped (#263 / #264 / #265) · shadow cut and pack compile on PR #266 (r1 layer-count hole addressed on this branch; lock held; not merged) · written by Cursor Agent.

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
| CARD1 any-size spelling (class F card 1) | shipped · `ship/card1-any-size` · #238 into release · squash #239 release → main · merge-back #240 main → release | Engine head stayed `f1e7472a930dd929b31c6f92510bddd8adba43bf` (mover-folder tip `4dc2add4` was not merged). Release merge `e04795ae0d83af1375d2e3dcf12e45345bd19246`. Main `3cb578532eb00e5627e2d363ab9616452df3a70b` (2 files: `compose.ts`, `typedCounts.test.ts`). Release tip at that landing `b0bdccff09bdee04ca64feb70d41cfd9bc642347` | Yard Critic PASS vs then-release `deabae9d` / then-main `cf05d769`, lean bar (model, steps, parts only). Zero blockers. No price card. Headline: "desk 4 ft wide with an open shelf" builds as the typed-size desk matching the digit twin. Scope note (not a blocker): size-after, comma-before-shelf, and non-CARD1 hosts still Combined, same as that tip. Production deploy for `3cb57853` was not verified — yard.wiki is not claimed live | — |
| Engine speed (hot regexes, graded gate-row cache) | shipped · #241 into release · squash #243 release → main · merge-back #244 main → release · docs #242 release only | Main `a032063e5f1c4cc94f0d02b32772cb788600b6a4` (11:13 AM ET). Merge-back #244 `530b670661d3ce5f424523eeb4460f6eed0d65c2`. Docs #242 release `80c3e7655194c89bacd741e55097531e20f0c93e` | Output-neutral. Production deploy for `a032063e` is READY (`dpl_5H2BWSNgXhcwtkQFcsSzGXqTiQ9z` / yard-5l0og90pa) | — |
| Class F: typed size kept beside a shelf on every host | shipped · #245 into release · squash #246 release → main · merge-back #247 main → release | Engine head stayed `d47dc17c8b84012fbe8de8073496db7d7c6ce24a`. Release merge `ec37c4c8248abaa72d9e1a555271861083ab71be`. Main `eb082af6a014115fc574598c9fca22393ddf40f9`. Merge-back #247 `b5442befb7a417ba72bd02e1eff43df696e9c7dd` | Yard Critic PASS vs then-release `80c3e765`, lean bar (model, steps, parts). Canaries byte-identical. CARD1 host list unchanged. A typed axis beside `1 shelf` / `an open shelf` is kept on every host, including comma, spelled, and metric axes. Production READY (`dpl_CghbaV74qwH6gzTB1a7xPvRYyyxc` / yard-if6j79v6x, aliases include yard.wiki) | — |
| Digit count of feet read as a size | shipped · #248 into release · squash #249 release → main · merge-back #250 main → release | Engine head the grade named stayed `a2e8170ee0878c91ff4c884ce0731855e9f5b727`. Release merge `94a7e50bbbe6f657808d1bbf1768d5624cfb6437`. Main `333ba25bb31f5085a96e44668e258828534f0a5b`. Merge-back #250 `104075e45583b7a82b77d6d30cb90c09df5e70de` | Yard Critic PASS vs then-release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`, lean bar (model, steps, parts). A digit before feet/foot is not a size when with/on/and/has/plus comes before it or a part noun follows, unless an axis word follows. Headline prompts match their spelled twins. Production READY (`dpl_7uT1q7YuuaDgoYNSx67dGzKFeF21` / yard-d2cp6x7kp, aliases include yard.wiki) | — |
| Stool plus a feature word keeps a unit-marked size | shipped · #251 into release · squash #252 release → main · merge-back #253 main → release | Engine head the grade named stayed `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`. Main `ea287eb75361fbfa3a13354257cd84ee0f84048b`. Merge-back #253 `c230ab55348aa963937de462a6eb162460a41a1e` | Yard Critic PASS on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`, lean bar (model, steps, parts). A width or depth on a stool, or the chair on the same reader, keeps a unit mark. Production READY (`dpl_5ypakZABbcku8KrdqHTfkUhSfQjh` / yard-ds1vwu7ep, aliases include yard.wiki) | — |
| Equal clear bays | shipped · #254 into release · squash #255 release → main · merge-back #256 main → release | Main `e25b82d4f0f96df9619e1324a6e33d829b1d6013`. Release `94cc8d6589c42c77fe054111b582af912113f20a` | An auto-divided shelf run of 3+ clear bays is equal within 1/64", and the bays plus the dividers fill the run between the sides. Ezra: live. This row does not record a Critic PASS or a deployment id. Do not reopen it | — |
| Shadow build graph (version 1) | shipped · #257 into release · squash #258 release → main · merge-back #259 main → release | Main `3966f67f2e2d071c3e0c7d420c5bbb558adec765`. Release `6de4631859fbfd7eb467e60c48b312abc60c5715` | One shadow graph. Model, steps, and Buy compile back for a bookcase, a potting bench with a lower shelf, and the Eiffel canary. Not the live source of truth. This row does not record a Critic PASS or a deployment id | — |
| Construction knowledge and substitution | shipped · #260 into release · squash #261 release → main · merge-back #262 main → release | Main `10f776525411543ea0fc7d2d13c421d49f3a7c04`. Release `6ef07183c7ca20c0aec85b581df54affbf9b993e` | Declared joints only where a reviewed pattern already applies. Stock substitution keeps the form. Still shadow. Not the live source of truth. This row does not record a Critic PASS or a deployment id | — |
| Shadow fastener demand | shipped · #263 into release · squash #264 release → main · merge-back #265 main → release | Main `db7cd4812967096ee82e7f8abc8fa8da31451f24`. Release merge of #263 `43a5cc52f7d78b27ee42eb3bc906a20b07e0867d`. Release tip `7134c41b20ed329a11fc52d36699cbef9c10de71` | Carcass screws come from reviewed shop joints. A thin dowel or a thin polygon buys none. Still shadow. Not the live source of truth. This row does not record a Critic PASS or a deployment id | — |
| Shadow cut and pack compile | in progress · PR #266 into `release/2026-10-24` · r1 layer-count hole in this round · do not merge | Lock held. See `CLAUDE-PROGRESS.md` | Glue-up layers ceil, so the stack covers the finished thickness. Whole craft sticks still derive no pack. Oak stays 25 against a live 24. Still shadow. Not graded | Do not merge |
| Critic NR-1 probe | `critic/nr1-base`, `critic/nr1-head` | `62b9bba`, `bbca4d6` | Probe harness, **do not merge** | — |
| Other open PRs | #231, #203, #202, #121, #120, #119, #118, #11 | — | Not in this queue | — |

Critic PASS entries for #225, CARD1, class F, digit-feet, and stool unit-size, and the #235, #239, #246, #249, and #252 landings, are logged in `CLAUDE-PROGRESS.md`. Canaries for the #235 landing: Critic's r5 grade found them unchanged vs then-release `afcb1f8b`. There is no separate post-merge main regrade for #235. The CARD1 grade was against then-release `deabae9d` / then-main `cf05d769`; this update does not record a new canary check on main `3cb57853`. Class F canaries were byte-identical in the Critic PASS vs then-release `80c3e765`; production for main `eb082af6` is READY. Digit-feet production for main `333ba25b` is READY. Stool unit-size production for main `ea287eb7` is READY.

## 3. Next, in order (one at a time)

Ezra's queue, updated 2026-11-07 08:40 ET. Items 1–6, the shadow build graph, construction knowledge, and shadow fastener demand are done. Shadow cut and pack compile is PR #266 (r1 layer-count hole addressed on this branch; lock held). Do not merge it from this note. "A linen needs…" still needs Ezra's yes.

1. DONE: `class-card1-any-size` shipped (#238 / #239 / #240).
2. DONE: output-neutral engine-speed patch shipped (#241 into release, squash #243 to main `a032063e`, merge-back #244, docs #242 on release as `80c3e765`). Production deploy READY.
3. DONE: class F — a typed axis beside `1 shelf` / `an open shelf` is kept on every host, including comma, spelled, and metric axes. Shipped #245 / #246 / #247. Main `eb082af6`. Production READY (`dpl_CghbaV74qwH6gzTB1a7xPvRYyyxc` / yard-if6j79v6x, aliases include yard.wiki).
4. DONE: digit counts of feet are not a size ("coffee table with 4 feet" matches "with four feet"). Shipped #248 / #249 / #250. Main `333ba25bb31f5085a96e44668e258828534f0a5b`. Production READY (`dpl_7uT1q7YuuaDgoYNSx67dGzKFeF21` / yard-d2cp6x7kp, aliases include yard.wiki).
5. DONE: a stool plus a feature word keeps a unit-marked size (`24"` and `24 inches` match `24`). Shipped #251 / #252 / #253. Main `ea287eb75361fbfa3a13354257cd84ee0f84048b`. Production READY (`dpl_5ypakZABbcku8KrdqHTfkUhSfQjh` / yard-ds1vwu7ep, aliases include yard.wiki). Critic PASS on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`.
6. DONE: equal clear bays. Shipped #254 / #255 / #256. Main `e25b82d4f0f96df9619e1324a6e33d829b1d6013`. Release `94cc8d6589c42c77fe054111b582af912113f20a`. Do not reopen it.
7. "A linen needs…" wording still needs Ezra's yes.
8. DONE: shadow build graph version 1. Shipped #257 / #258 / #259. Main `3966f67f2e2d071c3e0c7d420c5bbb558adec765`. Release `6de4631859fbfd7eb467e60c48b312abc60c5715`. Not the live source of truth. This note does not record a Critic PASS.
9. DONE: construction knowledge and substitution on that graph. Shipped #260 / #261 / #262. Main `10f776525411543ea0fc7d2d13c421d49f3a7c04`. Release `6ef07183c7ca20c0aec85b581df54affbf9b993e`. Still shadow. This note does not record a Critic PASS.
10. DONE: shadow fastener demand. Shipped #263 / #264 / #265. Main `db7cd4812967096ee82e7f8abc8fa8da31451f24`. Release `7134c41b20ed329a11fc52d36699cbef9c10de71`. Still shadow. This note does not record a Critic PASS. Do not switch the graph on.
11. IN PROGRESS, do not merge (PR #266; r1 was a glue-up that rounded short of the finished thickness): layers now ceil, on sheet and on lumber. Whole craft sticks derive no pack. The live engine does not read the graph.

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
