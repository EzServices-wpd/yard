import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  MAX_CARD_BYTES,
  computeBrandWarnings,
  rootDeclaresGameImage,
  rootDeclaresOgTypeGame,
  rootUsesBannerPlaceholder,
  rootUsesCardPlaceholder,
} from "./brand-check.mjs";

const PLACEHOLDER_ROOT = `
const ogImage = host ? \`https://og.grok.me/v1/card.png?host=\${encodeURIComponent(host)}\` : undefined;
const xBanner = host ? \`https://og.grok.me/v1/banner.png?host=\${encodeURIComponent(host)}\` : undefined;
meta: [{ property: "x:game:image", content: xBanner }],
`;

const CUSTOM_ROOT = `
const ogImage = host ? \`https://\${host}/og.jpg\` : undefined;
const xBanner = host ? \`https://og.grok.me/v1/banner.png?host=\${encodeURIComponent(host)}\` : undefined;
meta: [{ property: "x:game:image", content: xBanner }],
`;

const CUSTOM_GAME_ROOT = `
const ogImage = host ? \`https://\${host}/og.jpg\` : undefined;
const xBanner = host ? \`https://\${host}/x-banner.jpg\` : undefined;
meta: [{ property: "og:type", content: "x:game" }, { property: "x:game:image", content: xBanner }],
`;

function makeWorkspace({ rootTsx, cardFile, narrowFile, cardBytes = 200 * 1024, narrowBytes = 200 * 1024 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "brand-check-"));
  mkdirSync(join(root, "public"), { recursive: true });
  mkdirSync(join(root, "src/routes"), { recursive: true });
  if (rootTsx !== undefined) writeFileSync(join(root, "src/routes/__root.tsx"), rootTsx);
  if (cardFile !== undefined) writeFileSync(join(root, "public", cardFile), Buffer.alloc(cardBytes, 7));
  if (narrowFile !== undefined) writeFileSync(join(root, "public", narrowFile), Buffer.alloc(narrowBytes, 7));
  return root;
}

test("non-canvas app with a compliant card is silent", () => {
  const root = makeWorkspace({ rootTsx: CUSTOM_ROOT, cardFile: "og.jpg" });
  assert.deepEqual(computeBrandWarnings({ hasCanvas: false, workspaceRoot: root }), []);
});

test("oversized card warns", () => {
  const root = makeWorkspace({ rootTsx: CUSTOM_ROOT, cardFile: "og.jpg", cardBytes: MAX_CARD_BYTES + 1 });
  const warnings = computeBrandWarnings({ hasCanvas: false, workspaceRoot: root });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /over 600 KB/);
});

test("canvas app with no card warns missing", () => {
  const root = makeWorkspace({ rootTsx: PLACEHOLDER_ROOT });
  const warnings = computeBrandWarnings({ hasCanvas: true, workspaceRoot: root });
  assert.ok(warnings.some((w) => /og\.jpg.*missing/s.test(w)));
});

test("rootDeclaresOgTypeGame accepts property/content order", () => {
  assert.equal(rootDeclaresOgTypeGame('{ property: "og:type", content: "x:game" }'), true);
  assert.equal(rootDeclaresOgTypeGame('{ content: "x:game", property: "og:type" }'), true);
  assert.equal(rootDeclaresOgTypeGame('{ property: "og:type", content: "website" }'), false);
  assert.equal(rootDeclaresOgTypeGame('// { property: "og:type", content: "x:game" }'), false);
});

test("rootDeclaresGameImage requires a live tag", () => {
  assert.equal(rootDeclaresGameImage('{ property: "x:game:image", content: xBanner }'), true);
  assert.equal(rootDeclaresGameImage('// { property: "x:game:image", content: xBanner }'), false);
});

test("placeholder detectors", () => {
  assert.equal(rootUsesCardPlaceholder("https://og.grok.me/v1/card.png?host=demo"), true);
  assert.equal(rootUsesCardPlaceholder("https://og.grok.me/v1/banner.png"), false);
  assert.equal(rootUsesBannerPlaceholder("https://og.grok.me/v1/banner.png"), true);
});

test("compliant game card set is silent", () => {
  const root = makeWorkspace({ rootTsx: CUSTOM_GAME_ROOT, cardFile: "og.jpg", narrowFile: "x-banner.jpg" });
  assert.deepEqual(computeBrandWarnings({ hasCanvas: true, workspaceRoot: root }), []);
});
