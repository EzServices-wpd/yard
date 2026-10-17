// Hotfix: the workbench title is exactly the plan header when there is a build ("Workbench" only when empty).
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

test("shell renders headerTitle() alone with a build, 'Workbench' only without one", () => {
  const src = readFileSync(new URL("../src/components/workspace/shell.tsx", import.meta.url), "utf8");
  const at = src.indexOf("data-yard-workbench-title");
  assert.ok(at > 0, "title element present");
  const el = src.slice(at, src.indexOf("</span>", at));
  assert.match(el, /pieceCount > 0 \? headerTitle\(project\) : "Workbench"/);
  assert.doesNotMatch(el, /Workbench ·/);
});
