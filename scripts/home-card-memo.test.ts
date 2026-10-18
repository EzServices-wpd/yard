// Home cards: each card's engine drawing is a memoized component with string-only props, so a parent re-render
// (the idle stock-merge load ~1 s after hydration) never re-sets its innerHTML and swaps the SVG the door swings
// animate. Browser check: scripts/e2e/home-card-memo.py.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync("src/routes/index.tsx", "utf8");

test("the card drawing is memoized with string props only", () => {
  const m = home.match(/const ShowcaseArt = memo\(function ShowcaseArt\(\{ ([^}]*) \}: \{ ([^}]*) \}\)/);
  assert.ok(m, "ShowcaseArt is wrapped in memo()");
  assert.deepEqual(m![1].split(/,\s*/).sort(), ["id", "label", "svg"]);
  assert.equal(m![2], "id: string; label: string; svg: string", "primitive props, so memo's shallow compare holds across re-renders");
});

test("the only innerHTML on home cards is inside ShowcaseArt", () => {
  const art = home.slice(home.indexOf("const ShowcaseArt"), home.indexOf("});", home.indexOf("const ShowcaseArt")));
  assert.match(art, /data-yard-showcase=\{id\}[^>]*dangerouslySetInnerHTML=\{\{ __html: svg \}\}/);
  assert.equal(home.split("dangerouslySetInnerHTML").length - 1, 1, "no other dangerouslySetInnerHTML on the home page");
  assert.match(home, /<ShowcaseArt id=\{h\.id\} label=\{`Yard drawing of the \$\{h\.label\}, \$\{shows\[h\.id\]!\.sizeAria\}`\} svg=\{shows\[h\.id\]!\.svg\} \/>/);
});
