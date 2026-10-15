import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { supportsOf } from "./supportGraph.ts";

const p = generateFromPrompt("picnic table");
const plan = buildPlan(p);
const text = [...plan.instructions.map((s) => `${s.title} ${s.description}`), ...p.notes, ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n");

describe("picnic table part B", () => {
  it("one count: model parts = Buy/plan pieces = the header's 'N parts'", () => {
    const n = p.panels.length;
    assert.equal(plan.totals.pieces, n);
    assert.equal(plan.cutList.reduce((t, c) => t + c.quantity, 0), n);
    assert.match(plan.instructions[0].description, new RegExp(`\\b${n} parts on this list`));
  });
  it("has two diagonal braces, each touching a seat support and the center brace", () => {
    const d = p.panels.filter((q) => /^Diagonal brace/.test(q.name));
    assert.equal(d.length, 2);
    for (const b of d) {
      const top = b.position.y + b.size.height;
      assert.ok(p.panels.some((q) => /^Center brace/.test(q.name) && Math.abs(q.position.y - top) < 0.01));
      assert.ok(p.panels.some((q) => /^Seat support/.test(q.name) && Math.abs(q.position.y + q.size.height - top + b.size.height - 4.95) < 0.01 || /^Seat support/.test(q.name) && (Math.abs(q.position.z - (b.position.z + b.size.depth)) < 0.01 || Math.abs(q.position.z + q.size.depth - b.position.z) < 0.01)));
    }
  });
  it("one top-cleat size: 2×4 in the model, cut list and Buy", () => {
    const cleats = p.panels.filter((q) => /^Top cleat/.test(q.name));
    assert.ok(cleats.every((c) => c.materialId === "lumber-2x4-8" && Math.min(c.size.width, c.size.height, c.size.depth) === 1.5));
    assert.ok(plan.cutList.filter((c) => /Top cleat/.test(c.name)).every((c) => c.thicknessIn === 1.5 && /2x4/.test(c.id ?? "")));
    assert.ok(!plan.bom.some((b) => /1×4/.test(b.name)));
  });
  it("one fastener per joint: frames bolt (notes, Buy, steps agree); boards screw", () => {
    const bolts = plan.bom.find((b) => /carriage bolts/.test(b.name));
    assert.ok(bolts);
    const frames = plan.instructions.filter((s) => /A-frame$/.test(s.title));
    assert.ok(frames.length >= 2 && frames.every((s) => /carriage bolts/.test(s.description) && !/screws?/.test(s.description)));
  });
  it("no template leaks", () => assert.doesNotMatch(text, /\b1×6 arms\b|seat, back|shelf into cleat|left seat boards sit/i));
  it("Buy prices pressure-treated lumber", () => {
    const wood = plan.bom.filter((b) => /^lumber-/.test(b.catalogId ?? ""));
    assert.ok(wood.length && wood.every((b) => /pressure-treated/.test(b.name)));
  });
  it("supports go before what rests on them; no loose leg stands alone", () => {
    const at = placementIndex(p, plan.instructions);
    for (const [id, info] of supportsOf(p)) for (const s of info.on) if (at.has(s) && at.has(id)) assert.ok(at.get(s)! <= at.get(id)!, `${info.name} before its support`);
    assert.ok(!plan.instructions.some((s) => /^Stand the legs/.test(s.title)));
  });
});
