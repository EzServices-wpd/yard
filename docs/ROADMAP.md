# Yard — roadmap to live launch

Stay on `EzServices-wpd/yard`. No new repo per stage.

## Stage 0 — Stabilize the base (this week)

Goal: the deployed site cannot crash, the four demo prompts work, optional AI/auth fail softly.

- [x] Stop PGLite on Vercel. Only open a DB when `DATABASE_URL` is set. Never throw on import.
- [x] Auth degrades: no session API → treat as signed-out. Skip still opens the bench.
- [x] Commit `public/og.jpg` + `public/x-banner.jpg` + a real `/__grok/icon-180.png` (via `scripts/brand/*.b64` + `write-brand-assets.mjs`).
- [ ] Add `XAI_API_KEY` on the Vercel project (Production + Preview). **You do this** — Project → Settings → Environment Variables.
- [x] Manual pass on live: Eiffel, bathroom pocket vanity, alcove closet, Andersen 36×48 window — generate, plan, PDF.
- [x] Add `package-lock.json` so Vercel installs are pinned.

Exit: no PGLite errors in runtime logs; bench usable without env; Grok works when the key is set.

## Stage 1 — Any query, real build (the product)

Goal: the original vanity logic works for anything someone types.

- [ ] Query true form (wiki + Grok) for every named object, not just Eiffel.
- [ ] Map chosen stock onto that wire. No quantity cap.
- [ ] Auto support / frame / “will fail without bracing” for every model.
- [ ] Unique steps + denser isometric plates in the drawer and the PDF.
- [ ] Finished-piece render stays optional, always in the export when present.
- [ ] Measure-a-space remains the contractor path (stock window → RO → kings/jacks/header).

Exit: a stranger can type a size + material + use and leave with a printable plan.

## Stage 2 — Money and memory

- [ ] Amazon Associates tag + per-SKU affiliate URLs; keep HD / Lowe’s fallbacks.
- [ ] Retailer adapters behind one `shopSearchUrl` / `affiliateUrl` helper.
- [ ] Neon `DATABASE_URL` + real Better Auth (Google / X) when you want accounts.
- [ ] Persist yards per user; anonymous stays on-device.

Exit: a signed-in maker can reopen a project; a buy click can produce income.

## Stage 3 — Launch

- [ ] Custom domain + `VITE_PUBLIC_HOSTNAME` so og:image unfurls.
- [ ] Legal line stays: guidance only, not stamped engineering.
- [ ] Analytics (privacy-light), error tracking, uptime.
- [ ] Mobile pass: prompt, measure, export on a phone.
- [ ] Soft launch: 10 real projects (vanity, closet, window, Eiffel, desk, arch).
- [ ] Public launch once Stage 0+1 are green and Stage 2 affiliate tag is live.

## You set on Vercel (not code)

1. `XAI_API_KEY` — Stage 0 (last remaining item)
2. `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG` — Stage 2
3. `DATABASE_URL` + `BETTER_AUTH_*` + `GROK_AUTH_*` — Stage 2, only when you want accounts
4. Custom domain — Stage 3
