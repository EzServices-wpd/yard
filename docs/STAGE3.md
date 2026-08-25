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

## Founder decisions (locked 2026-08-25)

| Decision | Choice |
|----------|--------|
| **Domain** | Prefer **yard.io**. DNS check: NXDOMAIN (not delegated — likely registerable). Confirm price at Cloudflare Registrar / Porkbun / Namecheap before buy — short `.io` names are often **registry premium**, not standard ~$35. Soft launch stays on `yard-peach.vercel.app` until DNS is live. |
| **Analytics** | **Plausible** (hosted). Privacy-light, no cookies, one script. Wire only after account exists. |
| **Soft-launch audience** | **TBD**. Founder walks first (3.3a). Strangers when you name them. |

### Domain fallbacks (if yard.io is premium / taken at cart)

1. `useyard.io` — NXDOMAIN  
2. `theyard.app` — NXDOMAIN  
3. `yardhq.app` — NXDOMAIN  

Avoid: `getyard.io`, `getyard.app`, `yard.build`, `useyard.com` (already resolving).

### After you own the domain

1. Vercel project `yard` → Domains → add `yard.io` (and `www` if you want)  
2. Production env: `VITE_PUBLIC_HOSTNAME=yard.io`  
3. Redeploy  
4. Check `https://yard.io/og.jpg` and Slack/X unfurl  

## Stage 3 workstreams

### 3.0 — Launch package (code + docs) — **in progress**

- [x] Wave 2 + craft holes closed  
- [x] Founder decisions recorded  
- [ ] Re-walk freeze 10 on tip (`scripts/walk-launch.ts` + `walk-soft-launch.ts`)  
- [ ] Confirm live site exports linen + Eiffel without crash  
- [ ] Plausible script gated on env (only after account)  

### 3.1 — Domain (founder)

- [ ] Buy **yard.io** (or fallback) after checking live cart price  
- [ ] Point DNS → Vercel project `yard`  
- [ ] Set Production `VITE_PUBLIC_HOSTNAME=yard.io`  
- [ ] Redeploy; verify OG unfurl  

### 3.2 — Observability

- [ ] Create **Plausible** site for the chosen host  
- [ ] Add script via env-gated include (no marketing pixels)  
- [ ] Optional later: Sentry free tier — ask first  

### 3.3 — Soft launch (real builds)

- [ ] **3.3a** Founder: walk 8 house + 2 weekend on production; log PDF quality  
- [ ] **3.3b** ≥1 stranger when audience is named  
- [ ] Log failures under Soft-launch notes  

### 3.4 — Public launch gate

- [ ] House PDFs followable end-to-end  
- [ ] Domain live + OG unfurls  
- [ ] Plausible live (or explicit ship without)  
- [ ] **Amazon Associates tag — ask Ezra before setting**  
- [ ] Accounts / auth — ask before turning on  

## Do not during Stage 3

- New forms / structure kinds  
- Hourly bot / overnight refiner  
- Amazon tag without explicit go  
- Domain / accounts without founder  
- 2D / paper homepage chips  
- Scope expansion into new product surfaces  

## Soft-launch notes

_(append dated lines as real projects run)_

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Stage 3 open | 54911a9 | Craft PDF holes closed; Wave 2 already closed |
| Decisions locked | f2d8bc0+ | Prefer yard.io; Plausible; audience TBD |
