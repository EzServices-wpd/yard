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
import crypto from "node:crypto";

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

const FONT_DIR = "public/fonts";
const sha10 = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 10);
const fontsCss = (() => {
  const css = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith(".css"));
  assert.equal(css.length, 1, `one fonts stylesheet in ${FONT_DIR}: ${css.join(", ")}`);
  return css[0];
})();

test("fonts are self-hosted: the /fonts stylesheet names only /fonts/*.woff2 that exist, and the root loads it", () => {
  const css = fs.readFileSync(`${FONT_DIR}/${fontsCss}`, "utf8");
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
  assert.ok(root.includes(`const FONTS_CSS = "/fonts/${fontsCss}";`), `root loads /fonts/${fontsCss}`);
  assert.doesNotMatch(root, /fonts\.(?:googleapis|gstatic)\.com/);
});

test("/fonts is cached immutable, so every file under it is named by its content hash", () => {
  const cfg = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const rule = cfg.headers.find((h) => h.source === "/fonts/(.*)");
  assert.ok(rule, "vercel.json has a /fonts/(.*) headers rule");
  const cc = rule.headers.find((x) => x.key.toLowerCase() === "cache-control")?.value;
  assert.equal(cc, "public, max-age=31536000, immutable");
  // An immutable file must never change under the same name: the name carries sha256(content)[0:10].
  const files = fs.readdirSync(FONT_DIR);
  assert.ok(files.length >= 9, `${files.length} files`);
  for (const f of files) {
    const m = f.match(/^[a-z]+-([0-9a-f]{10})\.(?:woff2|css)$/);
    assert.ok(m, `${f} is not named <family>-<hash10>.<ext>`);
    assert.equal(m[1], sha10(`${FONT_DIR}/${f}`), `${f}: name hash != sha256(content); rename it (content changed)`);
  }
});
