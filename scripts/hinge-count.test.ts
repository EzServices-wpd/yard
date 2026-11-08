/**
 * Row 207 (carcass probe, P1): the bench model drew 2 hinges on every door while the steps and Buy (correctly) said
 * 4–5 on tall doors (linen: 8 bought, 4 drawn). Class rule: the model draws exactly the door hinges Buy lists, where the
 * Where line puts them. One source, hingedLeaf.doorHingeLayout (count from hingeSpec, centres from hingeCenters);
 * hingedBuy sums it, placement prints it, stick-cloud draws it.
 *
 * For every Idea and a sweep of carcass builds across the hinge-count height bands (≤40, ≤60, ≤80, above):
 *   (1) model hinges (what the bench draws) = the door hinges Buy lists (concealed "N hinges for M doors", crate
 *       utility pairs, declared door leaves "k on the <door>"), and Buy's pairs = ceil(N / 2);
 *   (2) every door the model hangs gets hingeSpec's count for its height (2 / 3 / 4 / 5);
 *   (3) the step that hangs the doors names the same per-door counts;
 *   (4) the Where line's "up from the floor" hinge heights are the model's hinge heights (1/16").
 * Plus a source check that stick-cloud draws DoorHinges only from that layout and panelHardware has no hinge list.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { IDEAS } from "../src/lib/yard/ideas";
import { doorHingeLayout, hingeSpec, leavesOf } from "../src/lib/yard/hingedLeaf";

const SWEEP: string[] = [
  "linen closet 31.5 wide 78 tall 16 deep", "linen closet", "pantry cabinet 30 wide 84 tall 18 deep", "wardrobe",
  "wardrobe 48 wide 84 tall 24 deep", "kitchen base cabinet", "upper cabinet", "bookcase with doors", "cabinet with 2 doors",
  "medicine cabinet", "pocket vanity", "nightstand with door", "filing cabinet 30x30x24 2 doors 2 drawers", "dog crate",
  "chicken coop", "media console with doors", "shaker cabinet 2 doors", "broom closet 24 wide 84 tall", "wine cabinet",
  "ironing board cabinet", "hutch", "entryway cabinet 100 tall",
];
for (const h of [30, 40, 42, 60, 62, 72, 80, 82, 96]) {
  SWEEP.push(`storage cabinet 36 wide ${h} tall 18 deep`, `pantry cabinet 24 wide ${h} tall 16 deep`, `linen closet 30 wide ${h} tall 16 deep`);
}
const PROMPTS = [...new Set([...IDEAS.map((d) => d.prompt), ...SWEEP])];

const s16 = (x: number) => Math.round(x * 16) / 16;
/** 3 1/16" / 27" / 74 15/16" → inches. */
const inches = (t: string) => {
  const m = t.trim().match(/^(\d+)(?:\s+(\d+)\/(\d+))?$|^(\d+)\/(\d+)$/);
  if (!m) return NaN;
  return m[4] ? Number(m[4]) / Number(m[5]) : Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
};

const rows = PROMPTS.map((prompt) => {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return { prompt, project, plan, layout: doorHingeLayout(project) };
});

test("sweep has doors in every hinge band (2, 3, 4 and 5 per door)", () => {
  const seen = new Set<number>();
  for (const r of rows) for (const c of r.layout.values()) seen.add(c.length);
  for (const n of [2, 3, 4, 5]) assert.ok(seen.has(n), `no door with ${n} hinges in the sweep`);
});

for (const { prompt, project, plan, layout } of rows) {
  const doors = leavesOf(project).filter((l) => l.role === "door");
  if (!doors.length) continue;
  test(`${prompt}: the model draws exactly the door hinges Buy lists, where the steps put them`, () => {
    const model = [...layout.values()].reduce((a, c) => a + c.length, 0);
    // (1) Buy: concealed line ("N hinges for M doors"), crate utility pairs, declared door leaves ("k on the <door>").
    let buy = 0;
    for (const b of plan.bom) {
      const notes = b.notes ?? "";
      if (/concealed cabinet hinges/i.test(b.name)) {
        const n = Number(notes.match(/(\d+) hinges? for \d+ doors?/)?.[1] ?? NaN);
        assert.ok(Number.isFinite(n), `${b.name}: no hinge count in its notes`);
        assert.equal(b.quantity, Math.ceil(n / 2), `${b.name}: ${b.quantity} pairs for ${n} hinges`);
        buy += n;
      } else if (/utility hinges/i.test(b.name) && /on the door/i.test(notes)) {
        buy += b.quantity * 2;
      } else if (/hinge/i.test(b.name)) {
        for (const l of doors.filter((d) => d.part.hinged)) {
          const k = notes.match(new RegExp(`(\\d+) on the ${l.part.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`))?.[1];
          if (k) buy += Number(k);
        }
      }
    }
    assert.equal(model, buy, `model draws ${model} door hinges, Buy lists ${buy}`);
    // (2) every drawn door takes hingeSpec's count for its height (crate: 2 utility hinges).
    const crate = /crate/i.test(`${project.name} ${project.prompt ?? ""}`);
    for (const l of doors) {
      const c = layout.get(l.part.id);
      if (!c || l.part.hinged) continue;
      const want = crate ? 2 : hingeSpec({ role: "door", w: l.part.size.width, h: l.part.size.height, t: l.part.size.depth }).count;
      assert.equal(c.length, want, `${l.part.name} (${l.part.size.height}" tall): ${c.length} drawn, ${want} for its height`);
      for (const y of c) assert.ok(y > 0 && y < l.part.size.height, `${l.part.name}: hinge at ${y}" is off the door`);
    }
    const text = plan.instructions.map((s) => `${s.title}. ${s.description}`).join("\n");
    // (3) the hang step's per-door count ("4 concealed hinges each" / "Hang the door — 5 concealed hinges").
    const counts = [...new Set([...layout.entries()].filter(([id]) => doors.some((d) => d.part.id === id && !d.part.hinged)).map(([, c]) => c.length))];
    const each = text.match(/Hang \d+ doors — (\d+) concealed hinges each|Hang the door — (\d+) concealed hinges/);
    if (each && counts.length === 1) assert.equal(Number(each[1] ?? each[2]), counts[0], `step says ${each[0]}, model draws ${counts[0]} per door`);
    // (4) Where line hinge heights up from the floor = the model's hinge heights.
    const said = [...text.matchAll(/Hinge centers[^.]*?on the cabinet side that is ([^.]*?) up from the floor/g)]
      .flatMap((m) => m[1].split(/,\s*|\s+and\s+/).map((x) => s16(inches(x.replace(/["″]/g, "")))));
    if (said.length) {
      const drawn = new Set<number>();
      for (const l of doors) for (const y of layout.get(l.part.id) ?? []) drawn.add(s16(l.part.position.y + y));
      assert.deepEqual([...new Set(said)].sort((a, b) => a - b), [...drawn].sort((a, b) => a - b), "Where line heights vs model hinge heights");
    }
  });
}

test("the bench draws door hinges only from doorHingeLayout (no hinge count or list in the renderer)", () => {
  const cloud = fs.readFileSync(new URL("../src/components/workspace/stick-cloud.tsx", import.meta.url), "utf8");
  const hw = fs.readFileSync(new URL("../src/components/workspace/panelHardware.tsx", import.meta.url), "utf8");
  assert.equal((cloud.match(/<DoorHinges\b/g) ?? []).length, 1, "one DoorHinges call site");
  assert.match(cloud, /useYard\(\(s\) => doorHingeLayout\(s\.project\)\.get\(panel\.id\)\)/);
  assert.match(cloud, /<DoorHinges [^>]*centers=\{hingeCenters\}/);
  const body = hw.slice(hw.indexOf("export function DoorHinges"), hw.indexOf("export function BarPull"));
  assert.match(body, /const ys = centers\.map\(/);
  assert.doesNotMatch(body, /\[\s*h \/ 2 - [\d.]+,/, "no hard-coded top/bottom hinge pair");
});
