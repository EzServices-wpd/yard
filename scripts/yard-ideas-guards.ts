/**
 * Ideas page guards: no store or affiliate links anywhere on /ideas (store links live on the Buy list only),
 * no build type twice, and the page never pulls the engine (drawings and recipe cards are baked).
 * Run: npx tsx scripts/yard-ideas-guards.ts
 */
import fs from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeasPageView, ideasFeed } from "../src/components/ideas/IdeasPageView";

function fail(msg: string, extra?: unknown): never {
  console.error("FAIL ideas", msg, extra ?? "");
  process.exit(1);
}
const STORE = /amazon\.|amzn\.|homedepot|lowes\.|walmart|menards|acehardware|sjv\.io|goto\.lowes|tag=/i;
const html = [
  renderToStaticMarkup(createElement(IdeasPageView, { incoming: "", learned: [], onBuild: () => {} })),
  renderToStaticMarkup(createElement(IdeasPageView, { incoming: "shelf", learned: [], onBuild: () => {} })),
  renderToStaticMarkup(createElement(IdeasPageView, { incoming: "zzqx", learned: [], onBuild: () => {} })),
].join("\n");
if (STORE.test(html)) fail("store link in /ideas markup", html.match(STORE)?.[0]);
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
if (hrefs.some((h) => /^https?:/.test(h))) fail("outbound link on /ideas", hrefs);
if (!html.includes("data-ideas-build-instead")) fail("search lost the Build-instead row");
const feed = ideasFeed();
const types = feed.sections.flatMap((s) => s.cards.map((c) => c.buildType));
if (new Set(types).size !== types.length) fail("a build type appears twice", types);
for (const f of ["src/routes/ideas.tsx", "src/components/ideas/IdeasPageView.tsx", "src/components/ideas/IdeaCard.tsx", "src/components/ideas/IdeaDrawing.tsx", "src/lib/ideas/feed.ts"]) {
  const src = fs.readFileSync(f, "utf8");
  if (/@\/lib\/yard\/(prompt|recipeIdeas|recipeBuild|planStepPicture|report|shop|listings|outbound)\b/.test(src)) fail(`${f} imports the engine or store code`);
  if (STORE.test(src)) fail(`${f} names a store`);
}
console.log(`ideas guards ok: ${types.length} cards, 0 store links, 0 duplicate build types`);
