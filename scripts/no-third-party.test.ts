/**
 * No third-party runtime loads (Critic row 113). The fonts are self-hosted under /fonts like the bench HDRI, and the
 * production CSP (vercel.json, today Report-Only per docs/csp-plan.md) lets every fetch directive name this site only
 * (plus data:/blob: where a canvas or worker needs them), so a stray CDN script, font, image or fetch is reported.
 * The blocking runtime check is scripts/e2e/no-third-party.py (Playwright, every page, desk and phone): any request
 * to another origin fails it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const csp = (() => {
  const cfg = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const v = cfg.headers.flatMap((h) => h.headers).find((x) => /^content-security-policy/i.test(x.key) && /default-src/.test(x.value))!.value;
  return Object.fromEntries(v.split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...xs]) => [k, xs]));
})() as Record<string, string[]>;

test("the CSP lets no fetch directive name another origin (no https:, no host, no *)", () => {
  const FETCH = ["default-src", "script-src", "style-src", "font-src", "img-src", "connect-src", "worker-src", "media-src", "frame-src", "manifest-src", "object-src"];
  const ok = new Set(["'self'", "'none'", "'unsafe-inline'", "'wasm-unsafe-eval'", "data:", "blob:"]);
  const bad: string[] = [];
  for (const d of FETCH) for (const s of csp[d] ?? []) if (!ok.has(s)) bad.push(`${d} ${s}`);
  assert.deepEqual(bad, []);
  assert.deepEqual(csp["default-src"], ["'self'"]);
});

test("fonts are self-hosted: /fonts/fonts.css names only /fonts/*.woff2 that exist, and the root loads it", () => {
  const css = fs.readFileSync("public/fonts/fonts.css", "utf8");
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 8, `${urls.length} font files`);
  for (const u of urls) {
    assert.match(u, /^\/fonts\/[\w-]+\.woff2$/);
    const f = `public${u}`;
    assert.ok(fs.existsSync(f), f);
    assert.equal(fs.readFileSync(f).subarray(0, 4).toString("latin1"), "wOF2", `${f} is not a woff2`);
  }
  for (const fam of ["Figtree", "Newsreader"]) assert.match(css, new RegExp(`font-family: '${fam}'`));
  assert.match(css, /font-display: optional/, "display=optional kept (no late swap, no CLS)");
  const root = fs.readFileSync("src/routes/__root.tsx", "utf8");
  assert.match(root, /const FONTS_CSS = "\/fonts\/fonts\.css";/);
  assert.doesNotMatch(root, /fonts\.(?:googleapis|gstatic)\.com/);
});
