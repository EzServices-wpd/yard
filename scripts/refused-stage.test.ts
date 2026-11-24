// A refused build draws no outline of the size it refused. bookcase 200 wide 2 tall 1 deep
// used to leave a 200-inch wire box on the stage behind "Nothing built".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { refusedEmpty, stageBox, stageOutlines } from "../src/components/workspace/refusedStage";

const REFUSED = "bookcase 200 wide 2 tall 1 deep";
const outlines = (p: ReturnType<typeof generateFromPrompt>, measureOpen: boolean, showHull: boolean) =>
  stageOutlines(p, { measureOpen, showHull, width: p.overall.width, height: p.overall.height, depth: p.overall.depth });

test("a refused build draws no outline and is not framed at the refused size", () => {
  const built = generateFromPrompt("bookcase 36 wide 72 tall 12 deep");
  assert.equal(refusedEmpty(built), false);
  assert.ok(outlines(built, true, false).length > 0, "a real build still draws its measure box");

  const p = generateFromPrompt(REFUSED);
  assert.ok(p.refused && p.panels.length === 0 && p.instances.length === 0);
  assert.ok(p.overall.width >= 200, "the solve still carries the refused width");
  assert.equal(refusedEmpty(p), true);
  assert.deepEqual(outlines(p, true, true), [], "measure wire and hull stay off");
  const span = stageBox(p).maxX - stageBox(p).minX;
  assert.ok(span < 50, `framed ${span} inches wide`);
  // After a build was on screen, the next project is what the stage reads. The refused one draws nothing.
  assert.ok(outlines(built, true, false).length > 0);
  assert.deepEqual(outlines(p, true, true), []);
});

test("the stage uses that guard for the wire, the shadow and the camera", () => {
  const src = fs.readFileSync(new URL("../src/components/workspace/canvas.tsx", import.meta.url), "utf8");
  assert.match(src, /measureOpen && !refusedEmpty\(project\)/);
  assert.match(src, /if \(refusedEmpty\(project\) \|\| !tex\) return null/);
  assert.match(src, /stageBox\(projectRef\.current\)/);
  assert.match(src, /showHull && !pending && !refusedEmpty\(project\)/);
});
