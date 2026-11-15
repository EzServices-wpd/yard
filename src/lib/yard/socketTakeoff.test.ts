/**
 * Pipe cuts are the centre-to-centre length minus the fitting take-off at each end
 * that meets a fitting. Assembling those cuts with the take-offs put back lands on
 * the size the build is drawn (the ladder's 60" height and 18" rail spacing, and the
 * same for the stool, trellis and shoe rack).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { openPipeDeal } from "./openPipeJoints.ts";
import { getCatalogItem } from "./catalog.ts";
import { clusterJointNodes } from "./joints.ts";
import { isWholeStock } from "./geometry.ts";
import { kerfFor, packLengths } from "./linearPack.ts";
import { typedExtents } from "./honesty.ts";
import {
  SCH40_SOCKET_TAKEOFF,
  fittingEndsAt,
  socketCutInches,
  socketTakeoffIn,
} from "./socketTakeoff.ts";
import type { Vec3, YardInstance } from "./types.ts";

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

test("3/4\" Sch 40 take-off is 9/16\", and the table is keyed by pipe size", () => {
  const row = SCH40_SOCKET_TAKEOFF.find((r) => r.nominal === '3/4"');
  assert.equal(row?.takeoffIn, 9 / 16);
  assert.equal(row?.odIn, 1.05);
  const pipe = getCatalogItem("pvc-3-4-sch40");
  assert.equal(socketTakeoffIn(pipe), 9 / 16);
  assert.equal(socketTakeoffIn(getCatalogItem("lumber-1x4-8")), 0);
});

/**
 * The priced segments: a split frame's pieces, otherwise the members on the project.
 * Each cut is the centre span minus 9/16" at every end that meets a fitting.
 */
function pricedSegments(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const item = getCatalogItem(project.primaryMaterialId ?? "")!;
  const deal = openPipeDeal(project);
  const segs = (deal?.split ? deal.segments : project.instances).filter(
    (inst): inst is YardInstance & { from: Vec3; to: Vec3 } =>
      !!inst.from && !!inst.to && inst.catalogId === item.id,
  );
  const takeoff = socketTakeoffIn(item);
  const nodes = clusterJointNodes(segs.map((inst) => ({ from: inst.from, to: inst.to, radius: (item.dims.diameter ?? 1.05) / 2 })));
  return { project, plan, item, segs, takeoff, nodes };
}

test("ladder, stool, trellis and shoe-rack assemble to the drawn height and width", () => {
  const want: Record<string, { height: number; width: number }> = {
    "pvc ladder 20x60": { height: 60, width: 18 },
    "20x60 pvc step stool": { height: 60, width: 18 },
    "pvc trellis": { height: 72, width: 24 },
    "pvc shoe rack": { height: 16.83, width: 34.4 },
  };
  for (const [prompt, size] of Object.entries(want)) {
    const { project, plan, item, segs, takeoff, nodes } = pricedSegments(prompt);
    assert.equal(takeoff, 9 / 16, prompt);
    const expected: number[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const inst of segs) {
      const span = dist(inst.from, inst.to);
      const ends = fittingEndsAt(inst.from, inst.to, nodes);
      const cut = socketCutInches(span, ends, takeoff) ?? inst.cutLength ?? span;
      expected.push(cut);
      const assembled = cut + takeoff * ends;
      assert.ok(Math.abs(assembled - span) <= 1 / 8, `${prompt} ${inst.role} assembles ${assembled} vs centre ${span}`);
      for (const p of [inst.from, inst.to]) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    const height = maxY - minY;
    const width = maxX - minX;
    assert.ok(Math.abs(height - size.height) <= 1 / 8, `${prompt} height ${height} vs ${size.height}`);
    assert.ok(Math.abs(width - size.width) <= 1 / 8, `${prompt} width ${width} vs ${size.width}`);
    // Stacked pieces on one line: the assembled run stays within 1/8" of that line.
    const chains = new Map<string, { lo: number; hi: number; asm: number; span: number }[]>();
    for (const inst of segs) {
      const span = dist(inst.from, inst.to);
      const ends = fittingEndsAt(inst.from, inst.to, nodes);
      const cut = socketCutInches(span, ends, takeoff) ?? inst.cutLength ?? span;
      const dx = Math.abs(inst.to.x - inst.from.x);
      const dy = Math.abs(inst.to.y - inst.from.y);
      const dz = Math.abs(inst.to.z - inst.from.z);
      const vertical = dy >= dx && dy >= dz;
      const along = vertical ? "y" : dx >= dz ? "x" : "z";
      const lo = Math.min(inst.from[along], inst.to[along]);
      const hi = Math.max(inst.from[along], inst.to[along]);
      const fixed = (["x", "y", "z"] as const).filter((a) => a !== along).map((a) => inst.from[a].toFixed(2)).join("|");
      const key = `${along}|${fixed}`;
      const list = chains.get(key) ?? [];
      list.push({ lo, hi, asm: cut + takeoff * ends, span });
      chains.set(key, list);
    }
    for (const [key, parts] of chains) {
      const ordered = parts.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
      let runAsm = 0;
      let runGeo = 0;
      let cursor = -Infinity;
      const flush = () => {
        if (runGeo > 0.5) assert.ok(Math.abs(runAsm - runGeo) <= 1 / 8, `${prompt} ${key} assembles ${runAsm} vs ${runGeo}`);
      };
      for (const part of ordered) {
        if (part.lo > cursor + 0.05) {
          flush();
          runAsm = 0;
          runGeo = 0;
        }
        runAsm += part.asm;
        runGeo += part.span;
        cursor = Math.max(cursor, part.hi);
      }
      flush();
    }
    const typed = typedExtents(prompt);
    if (typed?.height != null && Math.abs(size.height - typed.height) <= 1 / 8) {
      assert.ok(Math.abs(height - typed.height) <= 1 / 8, `${prompt} typed height`);
    }
    if (typed?.width != null && Math.abs(size.width - typed.width) <= 1 / 8) {
      assert.ok(Math.abs(width - typed.width) <= 1 / 8, `${prompt} typed width`);
    }
    const published = new Map<number, number>();
    for (const line of plan.cutList) {
      if (line.id.split("|")[0] !== item.id) continue;
      published.set(line.lengthIn, (published.get(line.lengthIn) ?? 0) + line.quantity);
    }
    const wanted = new Map<number, number>();
    for (const cut of expected) wanted.set(cut, (wanted.get(cut) ?? 0) + 1);
    assert.deepEqual([...published.entries()].sort(), [...wanted.entries()].sort(), `${prompt} cut list`);
    const packed = packLengths([...expected], item.dims.length ?? 120, kerfFor(item, isWholeStock(item)));
    const bought = plan.bom.find((line) => line.catalogId === item.id);
    assert.ok(bought && bought.quantity >= packed.sticks, `${prompt} buy ${bought?.quantity} covers ${packed.sticks}`);
    assert.ok(project.instances.length > 0);
  }
});
