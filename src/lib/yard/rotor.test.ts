import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { shapeTouch } from "./solids.ts";

// A rotor: paddles stand past the rims, only the assembly turns, it goes on the axle part by part from the glued
// end, every "fasten it to" names a part it really touches, and the collars hold it centred.
it("water wheel is a real rotor", () => {
  const p = generateFromPrompt("water wheel");
  const rims = p.panels.filter((x) => /^Rim \d$/.test(x.name)), axle = p.panels.find((x) => /^axle/.test(x.name))!;
  const rim = rims[0];
  for (const pd of p.panels.filter((x) => /^Paddle/.test(x.name))) {
    const out = pd.position.y + pd.size.height > rim.position.y + rim.size.height + 0.5 || pd.position.y < rim.position.y - 0.5 || pd.position.z < rim.position.z - 0.5 || pd.position.z + pd.size.depth > rim.position.z + rim.size.depth + 0.5;
    assert.ok(out, `${pd.name} inside the rim`);
  }
  const top = axle.position.y + axle.size.height, d = axle.size.height;
  for (const post of p.panels.filter((x) => /post/.test(x.name))) assert.ok(post.position.y + post.size.height >= top + d / 2 - 0.01, post.name);
  // Centred between the posts.
  const posts = p.panels.filter((x) => /post/.test(x.name)).sort((a, b) => a.position.x - b.position.x);
  const wLo = Math.min(...p.panels.filter((x) => x.turns && x !== axle).map((x) => x.position.x)), wHi = Math.max(...p.panels.filter((x) => x.turns && x !== axle).map((x) => x.position.x + x.size.width));
  assert.ok(Math.abs(wLo - (posts[0].position.x + posts[0].size.width) - (posts[1].position.x - wHi)) < 0.01, "wheel centred between the posts");
  // A cross rail ties the posts, clear of the wheel.
  const rail = p.panels.find((x) => /cross rail/i.test(x.name))!;
  assert.ok(posts.every((q) => shapeTouch(rail, q, 0.04)), "cross rail meets both posts");
  const st = buildPlan(p).instructions;
  const text = st.map((s) => s.description).join(" ");
  assert.ok(!/Set the \w+ (?:wheel|Rim \d) on the \w+ hub/.test(text), "no rim set on a hub it never touches");
  assert.ok(!/each axle/.test(text), "one axle is the axle");
  const at = (n: string) => st.findIndex((s) => (s.partsUsed ?? []).includes(n));
  const axleAt = at(axle.name);
  const leftPost = at(posts[0].name);
  for (const q of p.panels.filter((x) => x.turns && x !== axle || /^Collar/.test(x.name))) {
    assert.ok(at(q.name) > axleAt && at(q.name) < leftPost, `${q.name} goes on between the axle and the free post`);
  }
  // Every "fasten it to the X" in a rotor step names a part the rotor part touches.
  for (const s of st.filter((s) => (s.partsUsed ?? []).some((n) => /^(?:Spoke|hub|Rim|Paddle)/.test(n)))) {
    for (const n of s.partsUsed ?? []) {
      const part = p.panels.find((x) => x.name === n)!;
      const m = new RegExp(`(?:the [A-Z] )?${n} [^.]*?(?:fasten it to|to) ((?:the [^.]*?))(?: with )`).exec(s.description);
      if (!m) continue;
      for (const other of p.panels.filter((x) => x !== part && new RegExp(`\\b${x.name}\\b`).test(m[1]))) assert.ok(shapeTouch(part, other, 0.04), `${n} fastened to ${other.name} it never touches`);
    }
    assert.ok(!/Where: Top edges? of/.test(s.description), `${s.title}: no floor heights for a rotor part`);
  }
  for (const s of st) assert.ok(!/turns? free/i.test(s.description) || !/screw/i.test(s.description.replace(/no (glue or )?screws/gi, "")), s.title);
});
