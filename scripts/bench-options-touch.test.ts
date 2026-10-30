// Critic 2 advisory on #176: the bench Options rows Scale (figure), Props and Camera are touch controls, so every
// button in them has a 44 px minimum hit area both ways. The View in your room chip in the same block is already
// min-h-11. Other Options rows keep their compact release size.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const ui = read("src/components/workspace/bench-options.tsx");
const fn = (name: string) => ui.slice(ui.indexOf(`function ${name}(`), ui.indexOf("\n}\n", ui.indexOf(`function ${name}(`)));
const row = (label: string) => {
  const at = ui.indexOf(`<Row label="${label}">`);
  assert.ok(at > 0, `${label} row exists`);
  return ui.slice(at, ui.indexOf("</Row>", at));
};

test("Seg and Toggle: touch gives h-11/min-h-11 and min-w-11 (44 px); otherwise the release size", () => {
  const seg = fn("Seg");
  assert.match(seg, /touch\?: boolean/);
  assert.match(seg, /\$\{touch \? "h-11" : "h-9"\} min-w-11/, "touch segments are 44 px tall and at least 44 px wide");
  const toggle = fn("Toggle");
  assert.match(toggle, /touch\?: boolean/);
  assert.match(toggle, /touch \? "min-h-11 min-w-11" : ""/, "a touch toggle is at least 44 x 44 px");
});

test("the Scale, Props and Camera rows use the touch size", () => {
  // The first Scale row is the true-scale figure (View section); the Build section's Scale row is build size.
  assert.match(row("Scale"), /<Seg\s+touch\s/, "Scale (figure) segments are 44 px");
  assert.match(row("Camera"), /<Seg\s+touch\s/, "Camera segments are 44 px");
  const props = ui.slice(ui.indexOf("data-yard-scale-props"), ui.indexOf("</div>", ui.indexOf("data-yard-scale-props")));
  assert.match(props, /<Toggle touch on=\{scale\.props\}/, "the Props toggle is 44 px");
});

test("the View in your room chip beside them is already 44 px tall", () => {
  assert.match(read("src/components/workspace/view-in-room-button.tsx"), /className="min-h-11 /);
});
