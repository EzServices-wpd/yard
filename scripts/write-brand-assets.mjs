#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function write(rel, dest) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.warn(`[brand] skip missing ${rel}`);
    return;
  }
  const out = join(root, dest);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(readFileSync(src, "utf8"), "base64"));
  console.log(`[brand] wrote ${dest}`);
}

write("scripts/brand/og.jpg.b64", "public/og.jpg");
write("scripts/brand/x-banner.jpg.b64", "public/x-banner.jpg");
write("scripts/brand/icon-180.png.b64", "public/__grok/icon-180.png");
