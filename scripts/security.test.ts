import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { isPrivateIp } from "../src/lib/ai/stockLookup.ts";

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test("every xAI call goes through the capped helper (src/lib/ai/xai.server.ts)", () => {
  const bad = [...walk("src"), ...(fs.existsSync("server") ? walk("server") : [])]
    .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f) && !/\.test\./.test(f) && !f.endsWith(path.join("ai", "xai.server.ts")))
    .filter((f) => /api\.x\.ai|XAI_API_KEY/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});

test("the recipe bot never takes recipe JSON from the client", () => {
  const src = fs.readFileSync("src/lib/ai/recipeBot.ts", "utf8");
  assert.doesNotMatch(src, /validator\(\(input: \{ recipeJson/);
  assert.match(src, /yard-lookup:/);
});

test("the image proxy refuses private, loopback, link-local, 172.16/12 and IPv4-mapped addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "[::ffff:169.254.169.254]"]) assert.ok(isPrivateIp(ip), ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "151.101.1.1", "2606:4700::1111"]) assert.ok(!isPrivateIp(ip), ip);
});

test("vercel.json sends nosniff, a strict referrer policy, frame-ancestors 'self' and a report-only CSP", () => {
  const h = JSON.parse(fs.readFileSync("vercel.json", "utf8")).headers[0].headers as { key: string; value: string }[];
  const get = (k: string) => h.find((x) => x.key === k)?.value ?? "";
  assert.equal(get("X-Content-Type-Options"), "nosniff");
  assert.equal(get("Referrer-Policy"), "strict-origin");
  assert.match(get("Content-Security-Policy"), /frame-ancestors 'self'/);
  assert.match(get("Content-Security-Policy-Report-Only"), /default-src 'self'/);
  assert.match(get("Permissions-Policy"), /camera=\(\)/);
  assert.match(get("Strict-Transport-Security"), /includeSubDomains/);
});
