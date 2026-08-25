# Yard — Stage 3 Launch

Opened **2026-08-25**. Tip at open: `54911a9`. Current tip: progressive + Stage 3 wire. Stay on `EzServices-wpd/yard` only.

## Entry gate (must be true)

| Gate | Status |
|------|--------|
| Wave 2 stranger house PDF (linen 31.5×78×16) | **Closed** · ~4.5/5 progressive open-bay |
| Craft PDF (Eiffel) functional | **Closed** · ~3.8/5 buildable |
| Soft-launch P0–P3 | **Shipped** |
| Production freeze (house-first, paper demoted) | **In force** |
| Legal line | **Live** |
| Domain + OG unfurls | **Live** · `og:image` = `https://yard.wiki/og.jpg` |

## Founder decisions

| Decision | Choice |
|----------|--------|
| **Domain** | **yard.wiki** — live https://yard.wiki |
| **Analytics** | **Plausible** (hosted) — env-gated; create site then set env |
| **Soft-launch audience** | **TBD** — founder walks first (3.3a) |

### Domain status (re-checked 2026-08-25 ~14:50 EDT)

| Check | Result |
|-------|--------|
| `https://yard.wiki` | **200** |
| `/og.jpg` | **200** |
| `og:image` meta | **`https://yard.wiki/og.jpg`** (default host in code; env optional) |
| Heroes | **200** |
| Progressive linen PDF | Verified · carcase open-bay · hang doors open |

## Stage 3 workstreams

### 3.0 — Launch package

- [x] Wave 2 + craft holes closed
- [x] Founder decisions recorded
- [x] Domain live on Vercel (`yard.wiki`)
- [x] OG unfurls (hardcoded default `yard.wiki`)
- [x] Live linen + Eiffel export confirmed on yard.wiki
- [x] Progressive swing fix (doors only on hang steps)
- [ ] Re-walk freeze 10 on tip (optional confidence)
- [ ] Plausible account + env (3.2)

### 3.1 — Domain — **DONE**

- [x] Bought **yard.wiki**
- [x] DNS → Vercel
- [x] OG live without requiring env (default host)
- [x] Verify OG unfurl

### 3.2 — Observability

- [ ] Create Plausible site for `yard.wiki` (founder)
- [x] Env-gated script in code (`VITE_PUBLIC_PLAUSIBLE_DOMAIN`)
- [ ] Set env on Vercel Production + redeploy

### 3.3 — Soft launch

- [ ] **3.3a** Founder walks on https://yard.wiki (this is the launch action)
- [ ] **3.3b** ≥1 stranger when named

### 3.4 — Public launch gate

- [x] House PDFs followable (linen progressive)
- [x] Domain + OG unfurls
- [ ] Plausible (or ship without)
- [ ] Amazon tag — **ask first**
- [ ] Auth — **ask first**

## Do not during Stage 3

- New forms / hourly bot / Amazon without go / 2D homepage chips

## Founder actions now (3.3a)

1. Hard-refresh **https://yard.wiki**
2. Walk freeze builds you care about (linen, pocket, desk, Eiffel minimum)
3. Generate → Build plan → wait for silent photos → Export PDF
4. Note any ship-blockers only

Optional: create Plausible site → Vercel env `VITE_PUBLIC_PLAUSIBLE_DOMAIN=yard.wiki` → redeploy.

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Stage 3 open | 54911a9 | Craft PDF closed |
| Domain + OG | 08fe711+ | yard.wiki live; nest fix |
| Progressive | d2fdce8 | allowSwing + cut closed overall |
| Stage 3 wire | (this) | Plausible env-gated + checklist |
