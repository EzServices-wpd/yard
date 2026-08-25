# Yard — Stage 3 Launch

Opened **2026-08-25**. Tip at open: `54911a9`. Stay on `EzServices-wpd/yard` only.

## Entry gate (must be true)

| Gate | Status |
|------|--------|
| Wave 2 stranger house PDF (linen 31.5×78×16) | **Closed** |
| Craft PDF (Eiffel) functional | **Closed** |
| Soft-launch P0–P3 | **Shipped** |
| Production freeze (house-first, paper demoted) | **In force** |
| Legal line | **Live** |

## Founder decisions

| Decision | Choice |
|----------|--------|
| **Domain** | **yard.wiki** — bought + DNS on Vercel. Live: https://yard.wiki (HTTP 200). |
| **Analytics** | **Plausible** (hosted) — wire after account. |
| **Soft-launch audience** | **TBD** — founder walks first (3.3a). |

### Domain status (checked 2026-08-25 ~12:38 EDT)

| Check | Result |
|-------|--------|
| NS | `ns1.vercel-dns.com` / `ns2.vercel-dns.com` |
| A records | Resolve (Vercel edge) |
| `https://yard.wiki` | **200** — homepage loads |
| `https://www.yard.wiki` | Resolves |
| `/og.jpg` | **200** |
| Hero images | **200** |
| `og:image` meta | **Missing** — needs `VITE_PUBLIC_HOSTNAME=yard.wiki` + redeploy |

### One action left for domain (founder)

Vercel → project **yard** → Settings → Environment Variables → Production:

```
VITE_PUBLIC_HOSTNAME=yard.wiki
```

Redeploy Production. Then `og:image` becomes `https://yard.wiki/og.jpg` and Slack/X unfurls work.

## Stage 3 workstreams

### 3.0 — Launch package — **in progress**

- [x] Wave 2 + craft holes closed
- [x] Founder decisions recorded
- [x] Domain live on Vercel (`yard.wiki`)
- [ ] Set `VITE_PUBLIC_HOSTNAME=yard.wiki` + redeploy
- [ ] Re-walk freeze 10 on tip
- [ ] Confirm live linen + Eiffel export on yard.wiki
- [ ] Plausible gated on env (after account)

### 3.1 — Domain

- [x] Bought **yard.wiki**
- [x] DNS → Vercel
- [ ] `VITE_PUBLIC_HOSTNAME=yard.wiki` + redeploy
- [ ] Verify OG unfurl

### 3.2 — Observability

- [ ] Create Plausible site for `yard.wiki`
- [ ] Env-gated script

### 3.3 — Soft launch

- [ ] **3.3a** Founder walks on https://yard.wiki
- [ ] **3.3b** ≥1 stranger when named

### 3.4 — Public launch gate

- [ ] House PDFs followable
- [ ] Domain + OG unfurls
- [ ] Plausible (or ship without)
- [ ] Amazon tag — **ask first**
- [ ] Auth — **ask first**

## Do not during Stage 3

- New forms / hourly bot / Amazon without go / 2D homepage chips

## Soft-launch notes

- 2026-08-25: `yard.wiki` live; production deployment READY (tip includes Stage 3 docs + craft fixes).

## Tip trail

| When | Tip | Notes |
|------|-----|-------|
| Stage 3 open | 54911a9 | Craft PDF closed |
| Domain live | b2426ac+ | yard.wiki on Vercel DNS; set HOSTNAME env |
