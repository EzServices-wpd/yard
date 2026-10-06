import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { uniqueSteps } from "./steps";

const names = (p: ReturnType<typeof generateFromPrompt>) => p.panels.map((x) => x.name);
const has = (p: ReturnType<typeof generateFromPrompt>, re: RegExp) => names(p).filter((n) => re.test(n));
const JARGON = /Topology|Resolution ·|mosaic cell|queried wire|Parametric form|not a hull|nodes · \d+ members before|aggressiveness/;

describe("outdoor sheds are real-scale framed sheds", () => {
  for (const prompt of ["firewood shed from 2x4", "log store from 4x4 and 1x6", "tool shed from 2x4", "wood shed"]) {
    it(prompt, () => {
      const p = generateFromPrompt(prompt);
      assert.match(p.name, /shed|store/i, p.name);
      assert.ok(p.overall.width >= 60 && p.overall.height >= 60 && p.overall.depth >= 36, JSON.stringify(p.overall));
      for (const re of [/skid/i, /post/i, /^Floor joist/, /^Floor board/, /header/i, /^Rafter/, /^Roof board/]) assert.ok(has(p, re).length > 0, `${prompt}: ${re}`);
      const notes = p.notes.join(" ");
      assert.doesNotMatch(notes, /No class matched|cannot|don't|do not|never/i);
      assert.doesNotMatch(notes, JARGON);
    });
  }
  it("the typed 2x4 drives posts, headers and rafters", () => {
    const p = generateFromPrompt("firewood shed from 2x4");
    for (const re of [/post/i, /header/i, /^Rafter/]) {
      const xs = p.panels.filter((x) => re.test(x.name));
      assert.ok(xs.every((x) => [x.size.width, x.size.height, x.size.depth].some((d) => Math.abs(d - 1.5) < 0.01)), `${re} is 1 1/2 thick`);
    }
  });
  it("an untyped size is assumed honestly", () => {
    const p = generateFromPrompt("firewood shed from 2x4");
    assert.ok(p.notes.some((n) => /Assumed/.test(n)), JSON.stringify(p.notes));
  });
  it("steps go skids/posts → floor → walls → roof", () => {
    const p = generateFromPrompt("tool shed from 2x4");
    const titles = uniqueSteps(p).map((s) => s.title);
    const at = (re: RegExp) => titles.findIndex((t) => re.test(t));
    const order = [/skids/, /posts/, /floor boards/, /walls/, /roof boards/].map(at);
    assert.ok(order.every((i) => i >= 0), titles.join(" | "));
    assert.deepEqual([...order].sort((a, b) => a - b), order, titles.join(" | "));
  });
});

describe("a named landmark keeps its name and drops engine words from notes", () => {
  for (const [prompt, title] of [
    ["Big Ben from popsicle sticks 18 inches tall", "Big Ben"],
    ["Tower Bridge from popsicle sticks", "Tower Bridge"],
    ["Leaning Tower of Pisa from craft sticks", "Leaning Tower of Pisa"],
    ["Elizabeth Tower from craft sticks", "Elizabeth Tower"],
  ] as const) {
    it(prompt, () => {
      const p = generateFromPrompt(prompt);
      assert.equal(p.name, title);
      assert.doesNotMatch(p.notes.join(" "), JARGON);
    });
  }
  it("Big Ben 18 inches tall is exactly 18 tall", () => assert.equal(generateFromPrompt("Big Ben from popsicle sticks 18 inches tall").overall.height, 18));
  it("a generic clock tower keeps its family name", () => assert.equal(generateFromPrompt("clock tower from craft sticks").name, "Clock tower"));
});
