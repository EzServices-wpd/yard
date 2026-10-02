/**
 * Climb builds and Buy-reads-the-model guards.
 *
 * Climb: step stools and kitchen steps get real treads at the typed height, adult-load lumber/plywood
 * sections (no ripped 1" strips, no cut row wider than its stock), a handrail when asked, and a base
 * that stays planted.
 * Buy: "Cut to" matches the cut list; species boards are priced by species; plywood legs ride the
 * sheet nest; sticks/dowels are packed by cut length with kerf; screws are the sum over the model's
 * joints, at most 4 per joint.
 *
 *   npx tsx scripts/yard-climb-buy-guards.ts
 */
import { getCatalogItem } from "../src/lib/yard/catalog";
import { panelWorldCorners } from "../src/lib/yard/geometry";
import { inchFrac } from "../src/lib/yard/inchText";
import { kerfFor, packLengths } from "../src/lib/yard/linearPack";
import { panelJoints, screwTalk } from "../src/lib/yard/modelJoints";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import type { Panel } from "../src/lib/yard/types";
import { guardFail, guardStart } from "./guard-known-failures";

const G = "climb-buy";
guardStart(G);
const fail = (msg: string, extra?: unknown) => guardFail(G, "", msg, extra);

const box = (p: Panel) => {
  const c = panelWorldCorners(p);
  const xs = c.map((q) => q.x), ys = c.map((q) => q.y), zs = c.map((q) => q.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) };
};

// ---------------------------------------------------------------- Climb
type ClimbCase = { prompt: string; top?: number; handrail?: boolean; steps?: number };
const CLIMBS: ClimbCase[] = [
  { prompt: "step stool" },
  { prompt: "step stool 18 tall with handrail", top: 18, handrail: true },
  { prompt: "kitchen step stool" },
  { prompt: "2-step stool", steps: 2 },
  { prompt: "three step stool 27 inches tall", top: 27, steps: 3 },
  { prompt: "pine step stool 20 inches tall", top: 20 },
  { prompt: "redwood two-step stool", steps: 2 },
  { prompt: 'weekend craft: step-up stool — one climb step, 8" rise × 10" run, holds a kid standing to reach a shelf', top: 8, steps: 1 },
  { prompt: "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread", top: 10, steps: 1 },
  { prompt: "plywood step stool 24 inches tall with a handrail", top: 24, handrail: true },
];
let climbs = 0;
for (const c of CLIMBS) {
  const p = generateFromPrompt(c.prompt);
  const plan = buildPlan(p);
  if (!p.climb) {
    fail(`climb: ${c.prompt} is not the climb panel model`, { name: p.name, kind: p.kind, panels: p.panels.length, inst: p.instances.length });
    continue;
  }
  if (!/^Step stool/.test(p.name)) fail(`climb: ${c.prompt} title`, p.name);
  const treads = p.panels.filter((x) => x.type === "top" && /tread/i.test(x.name));
  if (!treads.length) {
    fail(`climb: ${c.prompt} has no tread`, p.panels.map((x) => x.name));
    continue;
  }
  const tb = treads.map(box);
  const topY = Math.max(...tb.map((b) => b.y1));
  const topTread = tb.find((b) => b.y1 === topY)!;
  if (c.top != null && Math.abs(topY - c.top) > 0.5) fail(`climb: ${c.prompt} top tread at ${topY}, typed ${c.top}`);
  if (c.steps != null && treads.length !== c.steps) fail(`climb: ${c.prompt} has ${treads.length} treads, asked ${c.steps}`);
  if (topTread.z1 - topTread.z0 < 10 - 1e-6) fail(`climb: ${c.prompt} top tread only ${topTread.z1 - topTread.z0}" deep`);
  if (topTread.x1 - topTread.x0 < 14 - 1e-6) fail(`climb: ${c.prompt} top tread only ${topTread.x1 - topTread.x0}" wide`);
  // Adult-load stock: lumber or plywood only, no ripped strips, posts at least 1 1/2" square.
  for (const x of p.panels) {
    if (!/^(?:lumber|plywood)-/.test(x.materialId ?? "")) fail(`climb: ${c.prompt} ${x.name} on ${x.materialId}`);
    const b = box(x);
    const dims = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0].sort((a, b2) => a - b2);
    if (dims[0] < 0.75 - 1e-6) fail(`climb: ${c.prompt} ${x.name} thinner than 3/4"`, dims);
    if (/^Leg|post/i.test(x.name) && dims[1] < 1.5 - 1e-6) fail(`climb: ${c.prompt} ${x.name} post under 1 1/2" square`, dims);
  }
  if (p.instances.length) fail(`climb: ${c.prompt} still carries stick-lattice members`, p.instances.length);
  // No cut row wider or thicker than its stock (sheet up to 48"; lumber its own section; species boards edge-glue).
  for (const row of plan.cutList) {
    const item = getCatalogItem(row.id.split("|")[0]);
    if (!item || item.formFactor === "board") continue;
    const across = [row.widthIn ?? 0, row.thicknessIn ?? 0].sort((a, b2) => a - b2);
    const stock = [item.dims.width ?? 48, item.dims.thickness ?? item.dims.height ?? 0.75].sort((a, b2) => a - b2);
    if (across[0] > stock[0] + 1 / 16 || across[1] > stock[1] + 1 / 16) fail(`climb: ${c.prompt} cut row ${row.name} ${across.join("×")} wider than ${item.name}`);
  }
  const all = p.panels.map(box);
  const maxY = Math.max(...all.map((b) => b.y1));
  if (c.handrail) {
    if (maxY < topY + 12 - 1e-6) fail(`climb: ${c.prompt} handrail only ${maxY - topY}" above the top tread`);
    if (!p.panels.some((x) => /handrail/i.test(x.name))) fail(`climb: ${c.prompt} no handrail parts`);
  }
  // Base footprint: deep enough not to tip when you lean, wide enough to stand on.
  const legs = all.filter((_, i) => p.panels[i].type === "upright" && all[i].y0 < 0.01);
  const baseD = Math.max(...legs.map((b) => b.z1)) - Math.min(...legs.map((b) => b.z0));
  const baseW = Math.max(...legs.map((b) => b.x1)) - Math.min(...legs.map((b) => b.x0));
  if (treads.length > 1 && baseD < 0.55 * topY) fail(`climb: ${c.prompt} base ${baseD}" deep under a ${topY}" top tread`);
  if (baseD < 0.5 * topY) fail(`climb: ${c.prompt} base ${baseD}" deep under a ${topY}" top tread`);
  if (baseW < 14 - 1e-6) fail(`climb: ${c.prompt} base ${baseW}" wide`);
  // The plan speaks the rise and run it builds, never a placeholder.
  const blob = [...p.notes, ...plan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (/typed rise × run/.test(blob)) fail(`climb: ${c.prompt} plan says "typed rise × run"`);
  if (!new RegExp(`${inchFrac(topY).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(p.notes.join(" "))) fail(`climb: ${c.prompt} notes never name the top tread height`, p.notes);
  climbs++;
}
// Craft and toy stock stay craft; the generic stick ladder stays the stick ladder.
for (const prompt of ["popsicle stick step stool 12 tall with handrail", "doll step stool", "ladder from 2x4", "6 foot ladder from 2x4", "towel ladder"]) {
  const p = generateFromPrompt(prompt);
  if (p.climb) fail(`climb: ${prompt} must stay on its own path`, p.name);
}
console.log(`PASS climb: ${climbs} stool prompts — real treads at the typed height, adult-load stock, handrail when asked, planted base`);

// ---------------------------------------------------------------- Buy reads the model
const lines = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p) };
};

// 1. "Cut to" lists are the cut list.
{
  const { plan } = lines("bamboo 5x7 picture frame");
  for (const b of plan.bom) {
    const m = b.notes?.match(/Cut to: ([^·]*)/);
    if (!m) continue;
    const said = m[1].split(",").map((s) => s.trim().replace(/"$/, "")).filter(Boolean).sort();
    const rows = [...new Set(plan.cutList.filter((r) => r.id.split("|")[0] === b.catalogId).map((r) => inchFrac(Math.round(r.lengthIn * 16) / 16)))].sort();
    if (said.join("|") !== rows.join("|")) fail("buy: bamboo 5x7 frame Cut to ≠ cut list", { said, rows });
  }
}
// 2. Species boards are priced by species.
{
  const per = (prompt: string, re: RegExp) => {
    const { plan } = lines(prompt);
    const row = plan.bom.find((b) => re.test(b.name) && b.quantity > 0);
    return row ? row.estimatedCost / row.quantity : NaN;
  };
  const oak = per("oak table with walnut legs", /^Oak/);
  const walnut = per("oak table with walnut legs", /^Walnut/);
  const pine = per("pine coffee table", /pine/i);
  if (!(oak > pine && walnut > oak)) fail("buy: species price per board must run pine < oak < walnut", { pine, oak, walnut });
}
// 3. Plywood legs ride the sheet nest: one sheet for a small plywood animal.
for (const prompt of ["plywood dachshund shelf", "plywood cat bookend"]) {
  const { plan } = lines(prompt);
  const sheets = plan.bom.filter((b) => /plywood/i.test(b.name)).reduce((s, b) => s + b.quantity, 0);
  if (sheets !== 1) fail(`buy: ${prompt} buys ${sheets} sheets (legs belong on the nest)`, plan.bom.map((b) => `${b.quantity} ${b.name}`));
  if (plan.bom.some((b) => /shelf pins/i.test(b.name))) fail(`buy: ${prompt} buys shelf pins with no uprights to hold them`);
}
// 4. Sticks and dowels are packed by cut length with kerf, never one stock piece per cut.
{
  let checked = 0;
  for (const prompt of ["dowel robot", "giraffe from dowels", "dowel dog", "dowel bridge", "dog from bamboo skewers", "bamboo 5x7 picture frame", "popsicle stick bridge"]) {
    const { p, plan } = lines(prompt);
    for (const b of plan.bom) {
      const item = getCatalogItem(b.catalogId);
      if (!item || !/stick|dowel/.test(item.formFactor ?? "")) continue;
      const rows = plan.cutList.filter((r) => r.id.split("|")[0] === b.catalogId && !r.whole);
      if (!rows.length) continue;
      const stockLen = item.dims.length ?? 0;
      const cuts = rows.flatMap((r) => Array.from({ length: r.quantity }, () => r.lengthIn));
      const kerf = kerfFor(item, false);
      const total = cuts.reduce((s, c) => s + c + kerf, 0);
      const bought = Number(b.notes?.match(/from (\d+) whole/)?.[1] ?? (b.unit === "ea" ? b.quantity : NaN));
      const floor = Math.ceil(total / stockLen);
      const packed = packLengths(cuts, stockLen, kerf).sticks;
      // Length floor; short leftovers that fit no other cut can push a first-fit pack above it, never past 1.5×.
      if (!(bought >= floor && bought <= Math.ceil(floor * 1.5) + 1)) {
        fail(`buy: ${prompt} buys ${bought} × ${item.name} for ${Math.round(total)}" of cuts (needs about ${floor})`, b.notes);
      }
      if (bought !== packed) fail(`buy: ${prompt} Buy ${bought} ≠ packer ${packed}`, b.notes);
      if (cuts.length > 3 && bought >= cuts.length) fail(`buy: ${prompt} one stock piece per cut`, { bought, cuts: cuts.length });
      checked++;
    }
    if (prompt === "dowel robot") {
      const row = plan.bom.find((b) => /dowel/i.test(b.name));
      if (!row || row.quantity > 5) fail("buy: dowel robot must buy about 4 dowels", row);
      if (p.instances.length < 30) fail("buy: dowel robot model shrank", p.instances.length);
    }
  }
  if (checked < 5) fail("buy: too few stick/dowel lines checked", checked);
  console.log(`PASS dowel/stick packing: ${checked} Buy lines packed by cut length with kerf`);
}
// 5. Screws are the sum over the model's joints, at most 4 per joint.
{
  const parse = (notes?: string) => {
    const m = notes?.match(/(\d+) screws from the model's joints: ([^.]*)/);
    if (!m) return null;
    let sum = 0, joints = 0, framed = 0, framedScrews = 0;
    for (const part of m[2].matchAll(/(\d+) for (\d+) ([a-z -]+?)(?:,|$)/g)) {
      sum += Number(part[1]);
      joints += Number(part[2]);
      // Butt and frame joints take 2–4 screws each; a back edge or face glue-up is screwed along its length.
      if (/butt|frame/.test(part[3])) {
        framed += Number(part[2]);
        framedScrews += Number(part[1]);
      }
    }
    return { total: Number(m[1]), sum, joints, framed, framedScrews };
  };
  let checked = 0;
  for (const prompt of ["coffee table 40x20x18", "nightstand 20 wide 16 deep 24 tall with one drawer", "dresser 36 wide with 4 drawers", "bookshelf", "step stool 18 tall with handrail", "ladder from 2x4", "2x4 robot", "kitchen chair from 1x4", "plywood robot", "3 tier plant stand"]) {
    const { p, plan } = lines(prompt);
    const row = plan.bom.find((b) => /wood screws/i.test(b.name));
    if (!row) continue;
    const s = parse(row.notes);
    if (!s) {
      fail(`screws: ${prompt} note does not derive from the model's joints`, row.notes);
      continue;
    }
    if (s.total !== Math.max(4, s.sum)) fail(`screws: ${prompt} total ${s.total} ≠ sum of per-joint counts ${s.sum}`, row.notes);
    if (s.joints < 1) fail(`screws: ${prompt} no joints named`, row.notes);
    if (s.framedScrews > 4 * s.framed) fail(`screws: ${prompt} ${s.framedScrews} screws for ${s.framed} butt/frame joints (over 4 per joint)`, row.notes);
    if (row.quantity !== Math.ceil(s.total / 50)) fail(`screws: ${prompt} boxes ${row.quantity} do not hold ${s.total}`);
    // Panel builds with no pinned shelves: the count is the model's joint count, recomputed here.
    if (p.panels.length && !p.instances.length && !plan.bom.some((b) => /shelf pins/i.test(b.name)) && !/drawer/i.test(prompt)) {
      const again = Math.max(4, screwTalk(panelJoints(p.panels)).screws);
      if (again !== s.total) fail(`screws: ${prompt} Buy ${s.total} ≠ model joints ${again}`);
    }
    checked++;
  }
  if (checked < 8) fail("screws: too few builds checked", checked);
  console.log(`PASS screws: ${checked} builds — Buy screws = sum over model joints, ≤ 4 per joint`);
}
console.log("PASS climb-buy guards");
