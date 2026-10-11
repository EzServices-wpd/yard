import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("Big Ben's belfry has a centre post on every face above the clock stage", () => {
  const p = generateFromPrompt("Big Ben from popsicle sticks");
  const H = p.overall.height;
  const mids = p.instances.filter((i) => i.role === "leg" && Math.abs(i.from.x * i.from.z) < 0.01 && (i.from.y + i.to.y) / 2 > 0.64 * H && (i.from.y + i.to.y) / 2 < 0.72 * H);
  assert.ok(mids.length >= 4, `${mids.length}`);
});
it("Golden Gate towers rise well above the deck, and the cut list is not empty", () => {
  const p = generateFromPrompt("Golden Gate Bridge from popsicle sticks");
  const deck = Math.min(...p.instances.filter((i) => i.role === "deck").map((i) => i.from.y));
  assert.ok(p.overall.height > deck * 3);
  assert.ok(buildPlan(p).cutList.length > 0);
});
it("Golden Gate main cables drape: lower at mid-span than at the tower tops", () => {
  const p = generateFromPrompt("Golden Gate Bridge from popsicle sticks");
  const ys = p.instances.filter((i) => i.role === "support").flatMap((i) => [i.from, i.to]);
  const mid = Math.min(...ys.filter((q) => Math.abs(q.x) < 2).map((q) => q.y));
  assert.ok(mid < 0.6 * p.overall.height, `${mid}`);
});
it("Big Ben shows a clock face on all four sides of the stage", () => {
  const p = generateFromPrompt("Big Ben from popsicle sticks");
  const H = p.overall.height;
  const dial = p.instances.filter((i) => i.role === "ring" && Math.abs(i.from.y - i.to.y) > 0.05 && i.from.y > 0.52 * H && i.from.y < 0.64 * H);
  const cx = 0, cz = 0;
  const faces = new Set(dial.map((i) => { const x = i.from.x - cx, z = i.from.z - cz; return Math.abs(x) > Math.abs(z) ? (x > 0 ? "E" : "W") : z > 0 ? "N" : "S"; }));
  assert.equal(faces.size, 4);
});
it("Golden Gate keeps its true length-to-height ratio and a narrow deck about 5 inches deep", () => {
  const p = generateFromPrompt("Golden Gate Bridge from popsicle sticks");
  assert.ok(Math.abs(p.overall.width / p.overall.height - 6450 / 746) < 1.2, `${p.overall.width}/${p.overall.height}`);
  assert.ok(p.overall.depth >= 4 && p.overall.depth <= 6, `${p.overall.depth}`);
});

it("a landmark with no size typed builds its signature towers at a readable height on the real ratio", () => {
  const p = generateFromPrompt("Brooklyn Bridge");
  assert.ok(p.overall.height >= 10 && p.overall.height <= 12.5, `${p.overall.height}`);
  assert.ok(Math.abs(p.overall.width / p.overall.height - 3455 / 276.5) < 1.2, `${p.overall.width}/${p.overall.height}`);
  const typed = generateFromPrompt("Brooklyn Bridge 48 long");
  assert.ok(Math.abs(typed.overall.width - 48) < 0.5, `${typed.overall.width}`);
});
