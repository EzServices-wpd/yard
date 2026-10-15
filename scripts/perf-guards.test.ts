import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// F28 (mobile Lighthouse regression): cheap static guards. The real numbers come from Lighthouse on the preview.
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/routes/index.tsx", import.meta.url), "utf8");

test("F28 CLS: each late web font has a metric-matched local fallback right after it", () => {
  for (const [web, fb] of [["Figtree", "Figtree Fallback"], ["Newsreader", "Newsreader Fallback"]]) {
    const face = css.match(new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*"${fb}"[^}]*\\}`))?.[0] ?? "";
    for (const k of ["size-adjust", "ascent-override", "descent-override", "src: local("]) assert.ok(face.includes(k), `${fb} lacks ${k}`);
    assert.match(css, new RegExp(`"${web}",\\s*"${fb}"`), `${web} stack must name ${fb} next`);
  }
});

test("F28 TBT: the home page never imports the engine in a plain mount effect", () => {
  assert.doesNotMatch(home, /^import\s+\{[^}]*\}\s+from\s+"@\/lib\/yard\/(prompt|promptHelpers|promptMain|homeShowcase)"/m);
  assert.doesNotMatch(home, /useEffect\(\(\)\s*=>\s*\{\s*void import\(/);
  // The showcases come from the route loader (server-rendered), never a client effect.
  assert.match(home, /loader:\s*async\s*\(\)\s*=>\s*\(\{\s*shows:\s*await homeShows\(\)/);
  assert.doesNotMatch(home, /setShows/);
});

test("F29 one tap: the stock merge preloads at idle, and the chip toggles on a plain click with no load gate", () => {
  assert.match(home, /requestIdleCallback\(load/);
  assert.match(home, /import\("@\/lib\/yard\/promptHelpers"\)/);
  const chip = home.match(/aria-pressed=\{on\}\s*onClick=\{\(\) => pickStock\(s\.id\)\}/);
  assert.ok(chip, "Material chip must toggle straight from onClick");
  assert.match(home, /function pickStock\(id: StockId\) \{\s*setStockId\(\(cur\) => \(cur === id \? null : id\)\);/);
});
