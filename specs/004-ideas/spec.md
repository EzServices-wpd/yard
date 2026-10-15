# Feature Specification: Endless Ideas

**Feature**: `004-ideas` · **Status**: Draft (spec only, no code) · **Created**: 2026-10-15 · **Owner**: Ezra
**Builds on**: `src/routes/ideas.tsx`, `src/lib/yard/ideas.ts`, `src/lib/yard/recipeIdeas.ts` (Popular = Critic-trusted only,
New = Unverified), `specs/002-live-learning` (Unverified queue, recipe bot). Note: there was no earlier
`specs/004-ideas` folder in the repo, so this spec starts the folder and builds on the shipped Ideas code above.

## Why
Today Ideas is a hand-written list plus learned recipes. Every prompt people type is a free idea, but
nothing remembers it. Endless Ideas keeps a durable, anonymous log of what people build and shows it
back: searchable, labelled honestly, and live on the home page.

## User scenarios
1. **Search everything** — a visitor opens /ideas, types "bench" in one search box, and sees every
   logged build that matches (built-in, learned, or typed sizes), each tagged **Trusted** or **Unverified**.
   Tapping one fills the prompt bar, as cards do today.
2. **Popular stays honest** — the Popular row only shows Trusted results, ranked by count.
3. **Unknown noun** — someone types "beehive box". It is logged as Unverified and still goes to the
   Unverified learning queue (002), exactly as today.
4. **Right now** — the home page shows "People are making right now: a 4' cedar planter · a corner shelf…".
   It never shows an address, email, phone number or offensive text, and it does not animate for users
   with reduced motion.

## Requirements
### Log (R1–R7)
- **R1** One log record per distinct query: `{ key, prompt, size, resultKey, status, count, firstSeen, lastSeen }`.
  - `prompt`: the normalised, sanitised prompt text (R10), capped at 140 chars.
  - `size`: the finished W × D × H the engine produced (inches).
  - `resultKey`: the recipe/shape id the engine resolved (e.g. `builtin:bookshelf`, `recipe:knife-block`, `unknown:<noun>`).
  - `status`: `Trusted` (built-in shape or Critic-trusted recipe), `Unverified` (learned but not trusted, or unknown noun
    sent to the queue), `Failed` (the engine or learning could not build it).
- **R2** No identity: no IP, user agent, cookie, session id, account, or geo is stored or derived. Nothing in a record
  can be joined back to a person.
- **R3** No extra xAI calls. Status and resultKey come from what the engine already returned on that request.
- **R4** Dedup: `key = hash(normalisedPrompt + resultKey + roundedSize)`. A repeat increments `count` and moves
  `lastSeen`; it never adds a row. Increment is atomic (no read-modify-write race under load).
- **R5** Status only moves up the ladder with evidence (Failed → Unverified → Trusted when Critic trusts the recipe);
  a later Failed on a Trusted key does not demote it, it increments a separate `failCount`.
- **R6** Unknown nouns are still enqueued to the 002 Unverified queue; the log is additive, not a replacement.
- **R7** Survive high traffic:
  - Logging is fire-and-forget after the response (`waitUntil`); the build response never waits on the store.
  - A store error or quota hit drops the log write silently and counts it in a metric; the build still works.
  - One round trip per query (pipelined write). Per-key write coalescing: at most one write per key per 10 s per
    instance (in-memory counter flushed with the increment), so a viral prompt costs one command, not thousands.
  - Hard cap on records (e.g. 200k); the oldest low-count Unverified/Failed rows are trimmed first.

### Ideas page (R8–R9)
- **R8** One global search box over the whole log (prompt + resultKey noun), with Trusted/Unverified badges on
  every result. Failed rows are never shown to visitors. Results sorted by Trusted first, then count.
  - Reads come from a snapshot (JSON, regenerated every 10 min by a cron and served from the CDN), searched
    client-side in a deferred chunk, so search traffic never hits the store.
- **R9** Popular = top Trusted by count only (keeps the current `popularIdeas` rule and `POPULAR_CAP`).

### "People are making right now" banner (R10–R12)
- **R10** Sanitise before storing and again before showing: strip emails, URLs, phone numbers (NANP and E.164-ish
  digit runs ≥ 7), street addresses (number + street suffix, PO boxes, ZIP codes), and @handles; drop the prompt
  entirely if anything was stripped from more than a size/number.
- **R11** Offensive-text filter: a local word list (with leetspeak folding) checked on store and on show; a flagged
  prompt is stored as Failed-hidden and never surfaced. No AI moderation call (R3).
- **R12** Light and accessible:
  - Data comes from the same snapshot (latest 20 Trusted/Unverified rows), loaded after idle; no engine import,
    no layout shift (fixed-height slot reserved in SSR, CLS 0 — F28 guard).
  - A CSS-only crossfade/marquee (transform/opacity only), paused off-screen and on hover/focus;
    `prefers-reduced-motion: reduce` shows a static list with no animation.
  - `aria-live="off"` (decorative); the list is reachable as plain links.

## Store comparison (prices from vercel.com/pricing, upstash.com/pricing, neon.com/pricing on 2026-10-15)
Write load assumption: 1 pipelined write ≈ 3 commands per logged query (HINCRBY count, HSET meta, ZADD recent).

| Store | Free tier | Paid cost | Atomic count (R4) | Fit |
|---|---|---|---|---|
| **Vercel Blob** | Hobby: 1 GB, 10K reads, **2K writes/mo**, hard capped (blocked 30 days when exceeded) | Pro: $5 per 1M writes, $0.40 per 1M reads, $0.023/GB | No: object store, read-modify-write races | Poor for the log; good for the read **snapshot** file |
| **Upstash Redis** (Vercel Marketplace) | 256 MB, **500K commands/mo** (~165K logged queries), 10K cmd/s, no card | PAYG $0.20 per 100K commands (~$6 per 1M queries), or fixed $10/mo (250 MB) / $20/mo (1 GB) with unlimited commands | Yes: HINCRBY / ZINCRBY | **Best fit**: HTTP/edge-friendly, no connection pool, built for spikes |
| **Neon Postgres** (Marketplace) | 1 GB/project, 100 CU-hours/mo, scales to zero after 5 min | $0.106/CU-hour + $0.35/GB-month (Launch) | Yes: `INSERT … ON CONFLICT DO UPDATE count = count + 1` | Good for rich search (pg_trgm), but cold start and connection limits on spikes |
| Edge Config | 100K reads, **100 writes/mo** (Hobby) | — | No | Not a log; reads only |

## Recommendation
**Upstash Redis via the Vercel Marketplace for the log, plus a CDN snapshot file (Vercel Blob or a static
route) for search and the banner.** Atomic counters give dedup for free, the free tier covers ~165K logged
queries a month, and above that it costs about $6 per million queries (or $10–20/mo flat if traffic is steady).
Neon is the fallback if Ezra later wants SQL analytics. **Nothing is provisioned: adding the store needs
Ezra's approval.**

## Acceptance tests
- A1 Typing the same prompt 1,000 times yields one row with `count = 1000` (concurrent load test, local Redis mock).
- A2 No record field contains IP/UA/cookie; a schema test rejects unknown fields.
- A3 xAI call counter is unchanged with logging on vs off over the 40-prompt eval set.
- A4 An unknown noun appears in the log as Unverified and in the 002 queue.
- A5 Popular contains only Trusted keys; search shows badges on every result; Failed never shows.
- A6 Sanitiser corpus: emails, phones, addresses, URLs and offensive words never reach the banner.
- A7 Home: CLS 0, TBT not worse than main (Lighthouse median of 3); reduced-motion shows no animation.
- A8 Store down or over quota: builds still succeed, the log write is dropped and counted.

## Out of scope
Accounts, per-user history, analytics dashboards, AI moderation, provisioning the store.
