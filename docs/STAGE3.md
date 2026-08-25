# Yard — Stage 3 Launch

Opened **2026-08-25**. Tip at open: `54911a9`. Stay on `EzServices-wpd/yard` only.

## Entry gate (must be true)

| Gate | Status |
|------|--------|
| Wave 2 stranger house PDF (linen 31.5×78×16) | **Closed** — nest, Buy sheet count, GRK lag, progressive photos, hierarchy, shelves plural |
| Craft PDF (Eiffel) functional | **Closed** — rounded dims, stick list, craft glossary, no double tilde |
| Soft-launch P0–P3 | **Shipped** — `docs/SOFT_LAUNCH.md` |
| Production freeze (house-first, paper demoted) | **In force** — `docs/PRODUCTION.md` |
| Legal line | **Live** — "Yard — guidance only. Not stamped engineering." on every PDF page |

## Stage 3 workstreams

### 3.0 — Launch package (code + docs) — **in progress**

- [x] Wave 2 + craft holes closed
- [ ] Re-walk freeze 10 on tip (`scripts/walk-launch.ts` + `walk-soft-launch.ts`) after Stage 3 opens
- [ ] This file + ROADMAP Stage 3 checklist current
- [ ] Confirm live site exports linen + Eiffel without crash

### 3.1 — Domain (founder)

- [ ] Choose domain (recommendation: short, sayable — e.g. `getyard.app` / `yard.shop` / whatever you own)
- [ ] Point DNS → Vercel project `yard`
- [ ] Set **Production** env on Vercel: `VITE_PUBLIC_HOSTNAME=<your-domain>` (no scheme)
- [ ] Redeploy so `og:image` resolves to `https://<host>/og.jpg` (`public/og.jpg` already committed)
- [ ] Verify unfurl in Slack / X / iMessage

Code already reads `import.meta.env.VITE_PUBLIC_HOSTNAME` in `src/routes/__root.tsx`.

### 3.2 — Observability (founder picks tool)

Privacy-light only. Do **not** add heavy marketing pixels.

Recommended default: **Plausible** (or Umami self-host) — pageviews + one custom event later for "Export PDF".

- [ ] Create project
- [ ] Add script / env only after choice is locked
- [ ] Optional: Sentry (errors) — free tier fine; ask before enabling session replay

### 3.3 — Soft launch (real builds)

- [ ] 10 real projects: **8 house + 2 weekend** (same list as freeze walk in `PRODUCTION.md`)
- [ ] At least **one stranger** (not founder) completes house path: generate → Build plan → Export PDF → can follow steps
- [ ] Log failures in this file under "Soft-launch notes"

### 3.4 — Public launch gate

- [ ] House PDFs followable end-to-end (stranger evidence)
- [ ] Domain live + OG unfurls
- [ ] Analytics live (or explicit "ship without")
- [ ] **Amazon Associates tag — ask Ezra before setting** (`VITE_PUBLIC_AMAZON_ASSOCIATE_TAG`)
- [ ] Accounts / auth — ask before turning on (`VITE_AUTH_ENABLED`)

## Do not during Stage 3

- New forms / structure kinds
- Hourly bot / overnight refiner
- Amazon tag without explicit go
- Domain / accounts without founder
- 2D / paper homepage chips
- Scope expansion into new product surfaces

## Founder decisions needed now

1. **Domain name** (or "stay on yard-peach.vercel.app for soft launch")
2. **Analytics tool** (Plausible / Umami / none)
3. **Soft-launch audience** — who are the first 1–3 strangers?

Code work does not start on 3.1–3.2 until those three answers land.

## Soft-launch notes

_(append dated lines as real projects run)_

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Stage 3 open | 54911a9 | Craft PDF holes closed; Wave 2 already closed |
