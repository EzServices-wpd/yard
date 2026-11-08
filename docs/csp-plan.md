# Plan: enforced CSP without 'unsafe-inline'

Today: `Content-Security-Policy: frame-ancestors 'self'` is enforced; the full policy is Report-Only and allows `'unsafe-inline'` scripts and styles. Fonts are self-hosted under `/fonts` and Vercel Analytics posts to `/_vercel/insights` (same origin), so every fetch directive names this site only (row 113; guard `scripts/no-third-party.test.ts`).

## What needs inline today
1. **Scripts.** TanStack Start SSR writes inline bootstrap and dehydration `<script>` tags (router state, `$_TSR`). The Vercel Analytics loader is injected from a `useEffect` (external src, fine).
2. **Styles.** React `style={{…}}` attributes (hero word `--i` vars, positions) and Tailwind are fine as attributes only if `style-src-attr 'unsafe-inline'` stays; `<style>` tags from three/drei are not used.

## Steps
1. **Nonce per request.** Generate a nonce in the server entry (`src/server.ts` / Start handler), pass it to `<Scripts nonce>` and `<HeadContent>` (TanStack Start supports `ssr: { nonce }` on the router), and set the header from the same handler instead of `vercel.json` (static headers can't carry a per-request nonce).
2. **Policy.** `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; report-to csp`.
3. **Report first.** Ship it as Report-Only with a `report-to` endpoint (a small server route that logs to Vercel runtime logs) for a week; fix every violation.
4. **Enforce.** Flip to `Content-Security-Policy` once reports are clean; keep a gate test that the HTML carries a nonce on every inline script and the header has no `'unsafe-inline'` in `script-src`.

Risks: CDN-cached HTML (/ideas, /plans) can't reuse a per-request nonce. Either drop the edge cache on those routes or use hashes of the (static) inline scripts there instead of a nonce.
