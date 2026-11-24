// Yard Critic 2 (#436): a card the gate catalog adds prints the size its own tap prompt builds (picture = opened build).
// Fails on a2c6952b for 'dollhouse' (fallback page: 12 x 12 3/8 x 16 picture, 'doll house' builds 24 x 12 x 30).
import test from "node:test";
import assert from "node:assert/strict";
import { curatedFeed } from "../src/lib/ideas/feed";
import { liveFeed } from "../src/lib/ideas/liveFeed";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { headerSize } from "../src/lib/yard/headerSize";
import RECIPES from "../src/lib/ideas/recipes.json";

test("every Catalog card (live or fallback feed) is drawn at the size its prompt builds", () => {
  const at = "2026-11-24T19:00:00.000Z";
  const feed = liveFeed({ at, live: false, rows: [], popular: [], recent: [] } as never, curatedFeed(RECIPES as never), new Date(at));
  const off: string[] = [];
  for (const c of (feed.all ?? []).filter((x) => x.section === "Catalog" && x.drawing?.dims)) {
    const hs = headerSize(generateFromPrompt(c.examplePrompt));
    const d = c.drawing!.dims!;
    const near = (a: number, b: number) => Math.abs(a - b) < 1 / 8;
    if (!(near(d.width, hs.width) && near(d.depth, hs.depth) && near(d.height, hs.height)) && !(near(d.width, hs.depth) && near(d.depth, hs.width) && near(d.height, hs.height)))
      off.push(`${c.slug}: card ${c.size}, '${c.examplePrompt}' builds ${hs.width}x${hs.depth}x${hs.height}`);
  }
  assert.deepEqual(off, []);
});
