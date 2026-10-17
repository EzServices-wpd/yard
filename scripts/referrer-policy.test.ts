import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Privacy: the idea-log beacon sends the page URL as referrer, and ?q= can hold a typed email.
test("vercel.json sends Referrer-Policy: strict-origin site-wide", () => {
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const all = (cfg.headers ?? []).find((h: { source: string }) => h.source === "/(.*)");
  assert.ok(all, "site-wide header block missing");
  const rp = all.headers.filter((h: { key: string }) => h.key.toLowerCase() === "referrer-policy");
  assert.equal(rp.length, 1);
  assert.equal(rp[0].value, "strict-origin");
});

test("root route carries the referrer meta fallback on every page", () => {
  const src = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.equal(src.match(/name: "referrer", content: "strict-origin"/g)?.length, 2);
});
