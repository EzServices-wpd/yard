# Later iterations

Permanent repo: `EzServices-wpd/yard`. Do not open a new repo per pass.

## Shipped (v1)

- Landing + bench + Eiffel lattice / hull toggle
- Pocket vanity + fitted units + stock windows
- Unique steps, cut list, BOM, affiliate-ready shop links
- PDF / markdown export + finished-piece render slot
- Grok true-form query (`XAI_API_KEY`)
- Auth (Grok broker + PGLite fallback)
- PWA chrome + Playwright smokes

## Next (keep in this tree)

1. **Wireframe fidelity** — query real proportions for any named object, then map the chosen material onto that frame (no material cap). **Shipped Stage 1** — connected joints, stock-scaled density, optional spine.
2. **Instruction plates** — denser LEGO / Wayfair-style graphics per step; embed in PDF. Joints now mark on the iso plate; keep thickening the drawings.
3. **AR / photo render** — keep the prompt-a-scene render; add on-site overlay later.
4. **Affiliate** — fill `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG`; optional retailer adapters.
5. **Accounts** — persist yards per user once `DATABASE_URL` + auth env are set on Vercel.
6. **Share cards** — drop `public/og.jpg` (1200×630) and `public/x-banner.jpg` (1200×264) if they are not already in the tree.

## Demo prompts that must keep working

- `3 foot Eiffel Tower from popsicle sticks`
- bathroom pocket vanity (original trapezoid measurements)
- `linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep`
- `window rough opening 36 by 48, 6 inches deep` + stock Andersen / Pella unit
