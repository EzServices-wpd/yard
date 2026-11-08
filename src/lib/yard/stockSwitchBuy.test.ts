import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { headerTitle } from "./pdf.ts";
import { stockThickness, partThickness, THICK_TOL } from "./stockThickness.ts";
import { isSolidDrawer, sheetWallT } from "./hollowDrawers.ts";
import { supportHangingBays } from "./hangingClearance.ts";
import { FORGE_CATALOG, getCatalogItem } from "./catalog.ts";
import { offline } from "../../../scripts/eval-lib.ts";
import type { Panel, YardProject } from "./types.ts";

// Row 626 (class): a stock switch (the Measure pick, or "in 1/2 inch plywood" typed) rebuilds every part in the
// new stock. Every part is the stock's thickness or whole glued layers of it, every cut row is bought, the glue-up
// step's layers make the part, notes and steps name only bought sheets, the title names only bought species,
// and the form (drawers, doors, shelves, size) is the same build the default stock makes. A ¼" pick is not a wall
// stock (its drawer sides and bay dividers stay ¾"): that is its own open row, not this test.
type Case = [prompt: string, stock?: string];
const CASES: Case[] = [
  ["wardrobe 36 wide 84 tall 24 deep with a rod and 2 drawers in 1/2 inch plywood"],
  ["wardrobe 36 wide 84 tall 24 deep with a rod and 2 drawers", "plywood-1-2-4x8"],
  ["dresser 36x40x18 4 drawers in 1/2 inch plywood"],
  ["dresser 36x40x18 4 drawers", "plywood-1-2-4x8"],
  ["nightstand 20x24x16 2 drawers in 1/2 inch plywood"],
  ["tv stand 60x24x18 2 drawers in 1/2 inch plywood"],
  ["desk 48x30x24 with 2 drawers", "plywood-1-2-4x8"],
  ["kitchen base cabinet 36x34x24 with a drawer and 2 doors", "plywood-1-2-4x8"],
  ["dresser 30x50x18 5 drawers poplar", "plywood-1-2-4x8"],
  ["linen cabinet 18x72x14 with a door and 5 shelves in 1/2\" plywood"],
  ["bookcase 28 5/8 x 48 x 11 1/4 oak 3 shelves", "plywood-1-2-4x8"],
  // controls: already right on release, must stay right
  ["dresser 36x40x18 4 drawers pine", "plywood-3-4-4x8"],
  ["nightstand 20x24x16 2 drawers", "lumber-1x4-8"],
];

const GLAZING = /\b(?:mirror|glass|glazing|acrylic)s?\b/i;
const cut = (p: Panel) =>
  !p.strut && !p.form && !p.outline && p.materialId !== "hardware" && !isSolidDrawer(p) && p.type !== "mirror" && !GLAZING.test(p.name) &&
  partThickness(p) > 0.02 && stockThickness(p.materialId) != null;
const byName = new Map(FORGE_CATALOG.map((i) => [i.name, i]));
// Row 683: "two ¾\" Counter plies" / "layers" claims count too, not only "… plywood".
const SHEET_WORD = /(?:^|[^\d/])(¼|½|¾|1\/4|1\/2|3\/4)["″]? ?(?:[A-Z][a-z]+ )?(?:plywood|plies|ply|layers)\b/gi;
const FRAC: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "1/4": 0.25, "1/2": 0.5, "3/4": 0.75 };
const SPECIES = /\b(oak|pine|poplar|maple|walnut|cherry|birch|cedar)\b/gi;
const formOf = (p: YardProject) => ({
  fronts: p.panels.filter((x) => /drawer\s*front/i.test(x.name)).length,
  doors: p.panels.filter((x) => x.type === "door").length,
  w: Math.round(p.overall.width), h: Math.round(p.overall.height),
  // each drawer box keeps its outside width: the walls thin inward, the box never shrinks
  boxes: [...new Set(p.panels.filter((x) => x.drawerPart === "side").map((x) => x.drawerId))].map((id) => {
    const s = p.panels.filter((x) => x.drawerId === id && x.drawerPart === "side");
    return Math.round((Math.max(...s.map((x) => x.position.x + x.size.width)) - Math.min(...s.map((x) => x.position.x))) * 16) / 16;
  }).sort((a, b) => a - b),
});

export function stockSwitchFailures(q: string, stock?: string): string[] {
  const p = stock ? generateFromPrompt(q, stock) : generateFromPrompt(q);
  const plan = buildPlan(p);
  const out: string[] = [];
  // 1. every part is its stock's thickness, or whole layers of it
  for (const x of p.panels.filter(cut)) {
    const T = stockThickness(x.materialId)!, t = partThickness(x), k = Math.round(t / T);
    if (k < 1 || Math.abs(t - k * T) > THICK_TOL) out.push(`${x.name} is ${t}" thick in ${x.materialId} (${T}")`);
  }
  // 1b. a drawer box closes: the back sits between the sides, the bottom behind the back
  for (const id of new Set(p.panels.filter((x) => x.drawerId && x.drawerPart === "side").map((x) => x.drawerId!))) {
    const part = (k: string) => p.panels.filter((x) => x.drawerId === id && x.drawerPart === k).sort((a, b) => a.position.x - b.position.x);
    const [l, r] = part("side"), [b] = part("back"), [f] = part("bottom");
    const gaps = [l.position.x + l.size.width - b.position.x, b.position.x + b.size.width - r.position.x, b.position.z + b.size.depth - f.position.z, f.position.z + f.size.depth - (l.position.z + l.size.depth)];
    if (gaps.some((g) => Math.abs(g) > THICK_TOL)) out.push(`${b.name}: box does not close (${gaps.map((g) => g.toFixed(3)).join(", ")})`);
  }
  // 2. a sheet's cut row is cut at that sheet's thickness (a thicker part is layers of it)
  for (const r of plan.cutList) {
    const it = byName.get(r.material);
    if (it?.formFactor === "sheet" && it.dims.thickness && Math.abs(r.thicknessIn - it.dims.thickness) > THICK_TOL) out.push(`cut row ${r.name} is ${r.thicknessIn}" from ${r.material}`);
  }
  // 3. every cut stock is bought, and enough sheet area is bought for its rows
  const bought = new Map<string, number>();
  for (const b of plan.bom) if (b.catalogId) bought.set(b.catalogId, (bought.get(b.catalogId) ?? 0) + b.quantity);
  const boughtNames = plan.bom.map((b) => `${b.name} ${b.catalogId ?? ""}`).join(" | ");
  const area = new Map<string, number>();
  for (const r of plan.cutList) {
    const it = byName.get(r.material);
    if (!it) { if (!boughtNames.includes(r.material)) out.push(`cut row ${r.name} (${r.material}) is not on the Buy list`); continue; }
    if (it.formFactor === "sheet") area.set(it.id, (area.get(it.id) ?? 0) + r.lengthIn * r.widthIn * r.quantity);
    else if (!bought.has(it.id) && !boughtNames.includes(r.material)) out.push(`cut row ${r.name} (${r.material}) is not on the Buy list`);
  }
  for (const [id, a] of area) {
    const it = getCatalogItem(id)!, sheet = (it.dims.length ?? 96) * (it.dims.width ?? 48);
    const same = [...bought].filter(([b]) => getCatalogItem(b)?.dims.thickness === it.dims.thickness && getCatalogItem(b)?.formFactor === "sheet").reduce((s, [, n]) => s + n, 0);
    if (a > same * sheet + 0.5) out.push(`${it.name}: ${Math.round(a / 144)} sq ft of cuts, ${same} sheet(s) bought`);
  }
  // 4. the glue-up step's layers make the part
  const glue = plan.instructions.find((s) => s.title === "Glue up the thick parts")?.description ?? "";
  for (const m of glue.matchAll(/([^:;.]+): (\d+) layers of ([^;.]+?)(?=;|\. )/g)) {
    const it = byName.get(m[3].trim()), part = p.panels.find((x) => x.name.replace(/ \d+$/, "") === m[1].trim());
    if (it?.dims.thickness && part && Math.abs(Number(m[2]) * it.dims.thickness - partThickness(part)) > THICK_TOL) out.push(`glue-up: ${m[1].trim()} ${m[2]} × ${it.dims.thickness}" ≠ ${partThickness(part)}"`);
  }
  // 5. notes, steps and Buy notes name only plywood that is bought
  const sheets = new Set([...bought.keys()].filter((b) => /^plywood-/.test(b)).map((b) => getCatalogItem(b)?.dims.thickness));
  const words = [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title}: ${s.description}`), ...plan.bom.map((b) => b.notes ?? "")];
  for (const w of words) for (const m of w.matchAll(SHEET_WORD)) if (!sheets.has(FRAC[m[1]])) out.push(`says "${m[0].trim()}" but buys ${[...sheets].join("/")}" plywood: ${w.slice(0, 90)}`);
  // 6. the title names only a species that is bought
  for (const m of headerTitle(p).matchAll(SPECIES)) if (!new RegExp(m[1], "i").test(boughtNames)) out.push(`title says ${m[1]} but the Buy list has none`);
  // 7. a screw goes through the part and bites the next one
  const T0 = stockThickness(p.primaryMaterialId) ?? 0.75;
  for (const s of plan.instructions) for (const m of s.description.matchAll(/#8 × (\d+)(?: (\d)\/(\d))?"/g)) {
    const L = Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
    if (L < T0 + 0.5) out.push(`${s.title}: #8 × ${L}" screw through ${T0}" stock`);
  }
  // 8. same form as the default stock's build
  if (stock) {
    const a = formOf(generateFromPrompt(q)), b = formOf(p);
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`form ${JSON.stringify(b)} ≠ default ${JSON.stringify(a)}`);
  }
  return out;
}

it("row 626: a stock switch rebuilds every part in the stock it buys (13 builds)", () =>
  offline(() => {
    const bad = CASES.flatMap(([q, s]) => stockSwitchFailures(q, s).map((m) => `${q}${s ? ` [→${s}]` : ""}: ${m}`));
    assert.deepEqual(bad, []);
  }));

it("row 626: a ¼\" pick is not a wall stock: drawer sides and bay dividers stay ¾\"", () =>
  offline(() => {
    const p = generateFromPrompt("wardrobe 36 wide 84 tall 24 deep with a rod and 2 drawers", "plywood-1-4-4x8");
    const walls = p.panels.filter((x) => x.drawerPart === "side" || /^Bay divider/.test(x.name));
    assert.ok(walls.length >= 5);
    assert.deepEqual(walls.filter((x) => partThickness(x) < 0.7).map((x) => x.name), []);
  }));

it("row 626: only a ½\" sheet is a thinner wall stock", () => {
  assert.equal(sheetWallT("plywood-1-2-4x8"), 0.5);
  for (const id of ["plywood-3-4-4x8", "plywood-1-4-4x8", "lumber-1x4-8", "lumber-2x4-8", "piece-clothespin", "nope"]) assert.equal(sheetWallT(id), 0.75, id);
});

it("row 626 (M12): a bay divider stood under a 60\" rod in a ½\" carcase is ½\", cut from the floor's sheet", () => {
  const P = (type: string, name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId = "plywood-1-2-4x8") =>
    ({ id: name, type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId }) as Panel;
  const panels = [
    P("side", "Left side", 0, 0, 0, 0.5, 84, 24), P("side", "Right side", 60.5, 0, 0, 0.5, 84, 24),
    P("bottom", "Bottom", 0.5, 0, 0, 60, 0.5, 24), P("top", "Top", 0.5, 83.5, 0, 60, 0.5, 24),
    P("rail", "Hanging rod", 0.5, 70, 11, 60, 1.25, 1.25, "hardware-closet-rod"),
  ];
  const out = supportHangingBays({ name: "synthetic", panels, primaryMaterialId: "plywood-1-2-4x8" } as unknown as YardProject);
  const div = out.panels.filter((p) => /^Bay divider\b/.test(p.name));
  assert.ok(div.length >= 1, "a divider stands under the 60\" rod");
  for (const d of div) {
    assert.equal(d.materialId, "plywood-1-2-4x8");
    assert.ok(Math.abs(Math.min(d.size.width, d.size.height, d.size.depth) - 0.5) < 0.01, `${d.name} ${JSON.stringify(d.size)}`);
  }
});

it("row 626 leaves the tipi's ½\" canvas cover where release has it (row 685 owns that wrong Buy list)", () =>
  offline(() => {
    const plan = buildPlan(generateFromPrompt("tipi", "plywood-1-2-4x8"));
    const cover = plan.cutList.find((c) => /canvas cover/i.test(c.name));
    assert.deepEqual(cover && [cover.quantity, cover.thicknessIn], [56, 0.75]);
  }));

it("row 683: the counter step's sentence is release's, with the count and ply read off the counter", () =>
  offline(() => {
    const said = (q: string, s?: string) => buildPlan(s ? generateFromPrompt(q, s) : generateFromPrompt(q)).instructions.map((st) => st.description.match(/Cut list has [^—]*—[^.]*thick/)?.[0]).filter(Boolean);
    assert.deepEqual(said("sink base cabinet 48 wide"), ['Cut list has two ¾" plies — glue them face-to-face (laminate) so the finished work surface is 1½" thick']);
    assert.deepEqual(said("sink base cabinet 48 wide in 1/2 inch plywood"), ['Cut list has three ½" plies — glue them face-to-face (laminate) so the finished work surface is 1½" thick']);
    assert.deepEqual(said("kitchen island", "plywood-1-2-4x8"), ['Cut list has three ½" Counter plies — glue them face-to-face (laminate) so the finished top is 1½" thick']);
  }));

it("row 690: the island note names the counter layers the step and cut list lay up (¾\" is release's)", () =>
  offline(() => {
    const clause = (q: string, s?: string) => (s ? generateFromPrompt(q, s) : generateFromPrompt(q)).notes?.map((n) => n.match(/counter is [^;]*;/)?.[0]).filter(Boolean);
    assert.deepEqual(clause("kitchen island"), ['counter is two ¾" plies laminated to 1½";']);
    assert.deepEqual(clause("kitchen island", "plywood-1-2-4x8"), ['counter is three ½" plies laminated to 1½";']);
    assert.deepEqual(clause("kitchen island in 1/2 inch plywood"), ['counter is three ½" plies laminated to 1½";']);
    assert.deepEqual(clause("kitchen island", "plywood-15-32-4x8-exterior"), ['counter is two ¾" plies laminated to 1½";']);
  }));
