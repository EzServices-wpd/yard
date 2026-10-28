// Hotfix: the workbench title is exactly the plan header when there is a build or a refusal ("Workbench" only on an empty bench).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { headerTitle } from "../src/lib/yard/pdf";

export const LINEN_PROMPT = "linen closet 31.5 wide 78 tall 16 deep";
export const LINEN_HEADER = 'Linen · 31 1/2" W × 16" D × 78" H';

test("the linen header the workbench title must read", () => {
  assert.equal(headerTitle(generateFromPrompt(LINEN_PROMPT)), LINEN_HEADER);
});

test("shell renders headerTitle() alone with a build or a refusal, the typed object on a not-learned placeholder (row 517), 'Workbench' only on an empty bench", () => {
  const src = readFileSync(new URL("../src/components/workspace/shell.tsx", import.meta.url), "utf8");
  const at = src.indexOf("data-yard-workbench-title");
  assert.ok(at > 0, "title element present");
  const el = src.slice(at, src.indexOf("</span>", at));
  assert.match(el, /pieceCount > 0 \|\| project\.refused\s*\?\s*headerTitle\(project\)\s*:\s*project\.displayOnly[^?]*\?\s*`\$\{project\.name\.split\([^`]*\} · not learned yet`\s*:\s*"Workbench"/);
  assert.doesNotMatch(el, /Workbench ·/);
});

test("a refused build's title names what was asked for and that nothing was built, never 'Workbench'", () => {
  const p = generateFromPrompt("abacus 2 wide");
  assert.ok(p.refused && !p.panels.length);
  assert.equal(headerTitle(p), "Abacus · nothing built");
});

test("row 517: on a not-learned placeholder the header names the typed object; row 578: the tab never cuts typed words", async () => {
  const shell = readFileSync(new URL("../src/components/workspace/shell.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/routes/workspace.tsx", import.meta.url), "utf8");
  assert.ok(/project\.name\.split\(\/\[,\\d\]\/\)\[0\]\.trim\(\)/.test(shell), "the header cuts the noun");
  // Row 578 (was: the tab cut the same noun from the typed prompt): the route title is the engine's header only
  // (scripts/share-title.test.ts), so a placeholder, which the engine never names, keeps the plain workbench title.
  assert.doesNotMatch(route, /\.split\(\/\[,\\d\]\/\)/, "the route cuts no typed noun");
  const { roughBlock } = await import("../src/lib/yard/recipeBuild");
  for (const [q, want] of [["toolbox", "Toolbox"], ["toolbox 18x16x18", "Toolbox"], ["lattice tower 24.5 tall", "Lattice tower"]]) {
    const name = roughBlock(q, generateFromPrompt(q)).name;
    assert.equal(name.split(/[,\d]/)[0].trim(), want, `${q}: header noun`);
  }
});

