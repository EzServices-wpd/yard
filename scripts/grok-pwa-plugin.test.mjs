import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  appNameFromHost,
  createHeadInjector,
  injectGrokPwaHead,
  isDocumentPath,
  isInstallQuery,
  renderWebManifest,
  stripInstallParams,
} from "./grok-pwa-shared.mjs";

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("injects before </head>", () => {
  const out = injectGrokPwaHead("<html><head><title>x</title></head><body></body></html>");
  assert.match(out, /rel="manifest"/);
  assert.match(out, /apple-touch-icon/);
  assert.ok(out.indexOf("manifest") < out.indexOf("</head>"));
});

test("streaming injector handles </head> split across chunks", () => {
  const injector = createHeadInjector("Yard");
  const chunks = [...injector.push("<html><head><title>x</title></he"), ...injector.push("ad><body>hello</body></html>")];
  const out = Buffer.concat(chunks).toString("utf8");
  assert.match(out, /rel="manifest"/);
  assert.ok(out.indexOf("manifest") < out.indexOf("</head>"));
  assert.deepEqual(injector.flush(), []);
});

test("detects install query", () => {
  assert.equal(isInstallQuery("/?install=1&platform=ios"), true);
  assert.equal(isInstallQuery("/?install=1"), false);
  assert.equal(isInstallQuery("/"), false);
});

test("filters non-document paths", () => {
  assert.equal(isDocumentPath("/"), true);
  assert.equal(isDocumentPath("/workspace"), true);
  assert.equal(isDocumentPath("/api/thing"), false);
  assert.equal(isDocumentPath("/logo.png"), false);
});

test("strips install params", () => {
  assert.equal(stripInstallParams("/?install=1&platform=ios"), "/");
  assert.equal(stripInstallParams("/app?install=1&platform=ios&tab=2"), "/app?tab=2");
});

test("names the install page from host slug", () => {
  assert.equal(appNameFromHost("localhost:8080"), "Grok App");
  assert.equal(appNameFromHost("yard.grok.me"), "Yard");
});

test("renders the manifest with the per-app name", () => {
  const manifest = JSON.parse(renderWebManifest("yard.grok.me"));
  assert.equal(manifest.name, "Yard");
  assert.equal(manifest.icons[0].src, "/__grok/icon-180.png");
});

test("vite config keeps nitro serverDir wiring", () => {
  const viteConfig = readFileSync(join(TEMPLATE_ROOT, "vite.config.ts"), "utf8");
  assert.match(viteConfig, /serverDir:\s*"\.\/server"/);
  assert.match(viteConfig, /grokPwaPlugin\(\)/);
});

test("nitro middleware and install page exist", () => {
  const middleware = readFileSync(join(TEMPLATE_ROOT, "server/middleware/grok-pwa.ts"), "utf8");
  assert.match(middleware, /install-page\.html\?raw/);
  readFileSync(join(TEMPLATE_ROOT, "scripts/install-page.html"));
});
