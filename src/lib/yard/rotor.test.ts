import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

// A rotor: paddles stand past the rim, the hub is slotted for spokes, only the assembly turns, bearing holes keep wood around them.
it("water wheel is a real rotor", () => {
  const p = generateFromPrompt("water wheel");
  const rim = p.panels.find((x) => x.name === "wheel")!, axle = p.panels.find((x) => /^axle/.test(x.name))!;
  const hub = p.panels.find((x) => x.name === "hub")!;
  assert.match(hub.cutNote ?? "", /slot/);
  for (const pd of p.panels.filter((x) => /^Paddle/.test(x.name))) {
    const out = pd.position.y + pd.size.height > rim.position.y + rim.size.height + 0.5 || pd.position.y < rim.position.y - 0.5 || pd.position.z < rim.position.z - 0.5 || pd.position.z + pd.size.depth > rim.position.z + rim.size.depth + 0.5;
    assert.ok(out, `${pd.name} inside the rim`);
  }
  const top = axle.position.y + axle.size.height, d = axle.size.height;
  for (const post of p.panels.filter((x) => /post/.test(x.name))) assert.ok(post.position.y + post.size.height >= top + d / 2 - 0.01, post.name);
  for (const s of buildPlan(p).instructions) assert.ok(!/turns? free/i.test(s.description) || !/screw/i.test(s.description.replace(/no (glue or )?screws/gi, "")), s.title);
});
