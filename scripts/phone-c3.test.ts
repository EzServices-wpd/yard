// Batch C3 (phones): one nav label everywhere ("Workbench", as #72's title), 44px+ targets on phones.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync("src/routes/index.tsx", "utf8");
const chrome = fs.readFileSync("src/components/site/chrome.tsx", "utf8");
const plan = fs.readFileSync("src/routes/plans/$slug.tsx", "utf8");

test("the nav names the workspace 'Workbench' on home and on every chrome page", () => {
  assert.match(chrome, /label: "Workbench"/);
  const nav = home.slice(home.indexOf("<nav className=\"flex items-center gap-1\">"), home.indexOf("</nav>"));
  assert.match(nav, />\s*Workbench\s*</);
  assert.doesNotMatch(nav, />\s*Bench\s*</);
});

test("phone targets: the home prompt input keeps 48px in the column layout; Free plans links and /plans buttons are 44px below lg", () => {
  assert.match(home, /id="dream"[\s\S]{0,300}className="h-12 min-h-12 /);
  assert.match(home, /\{p\.name\}<\/Link>/);
  assert.match(home, /max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">\{p\.name\}/);
  for (const label of ["Open the 3D model", "Make it your size"]) assert.match(plan, new RegExp(`max-lg:min-h-11 max-lg:items-center">${label}`));
});
