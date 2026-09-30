import { createId } from "@/lib/utils";
import { looksLikePocket } from "./pocket";
import { detectWeekendFamily } from "./weekendFamily";
import type { Panel, Vec3, YardInstance, YardProject } from "./types";

/**
 * Two or more named products in one sentence ("coat rack with bench",
 * "desk and a bookcase") are both built, then joined. A later noun must
 * not erase the earlier one.
 *
 * A wall piece (coat rack, frame, mirror) stands on the back of the floor
 * piece, high enough to use. Two floor pieces sit side by side.
 *
 * A part of one product (lower shelf, two drawers, knee space) stays on
 * that product. A pocket survey is one room, not a list of products.
 */

const FEATURE = new Set([
  "drawer",
  "drawers",
  "door",
  "doors",
  "shelves",
  "hook",
  "hooks",
  "peg",
  "pegs",
  "cubby",
  "cubbies",
  "rod",
  "rods",
  "cushion",
  "cushions",
  "mattress",
  "mattresses",
  "knob",
  "knobs",
  "pull",
  "pulls",
  "hinge",
  "hinges",
  "glass",
  "knee space",
  "opening",
  "lid",
  "lids",
  "legs",
  "apron",
  "hardware",
]);

/** Longest pattern first so "coffee table" does not become a bare table. */
const PRODUCTS: [RegExp, string][] = [
  [/picture\s*frames?|photo\s*frames?/, "Picture frame"],
  [/coat\s*racks?|hall\s*trees?|coat\s*trees?|entry\s*trees?/, "Coat rack"],
  [/shoe\s*racks?/, "Shoe rack"],
  [/bookcases?|bookshelves|bookshelfs?|book\s*shel(?:f|ves)/, "Bookcase"],
  [/coffee\s*tables?/, "Coffee table"],
  [/dining\s*tables?/, "Dining table"],
  [/nightstands?|bedside\s*tables?/, "Nightstand"],
  [/window\s*seats?/, "Window seat"],
  [/planter\s*box(?:es)?/, "Planter box"],
  [/potting\s*benches/, "Potting bench"],
  [/work\s*benches|workbenches/, "Workbench"],
  [/garden\s*arches|\bgarden\s*arch\b/, "Garden arch"],
  [/eiffel(?:\s*towers?)?/, "Eiffel"],
  [/\bbridges?\b/, "Bridge"],
  [/catapults?|trebuchets?/, "Catapult"],
  [/\bbunk\s*beds?\b/, "Bunk bed"],
  [/\bloft\s*beds?\b/, "Loft bed"],
  [/\bday\s*beds?\b/, "Daybed"],
  [/\bplatform\s*beds?\b/, "Platform bed"],
  [/\bheadboards?\b/, "Headboard"],
  [/rocking\s*chairs?/, "Rocking chair"],
  [/lounge\s*chairs?/, "Lounge chair"],
  [/adirondack\s*chairs?/, "Adirondack chair"],
  [/\bottomans?\b/, "Ottoman"],
  [/\bvanit(?:y|ies)\b/, "Vanity"],
  [/\bdressers?\b/, "Dresser"],
  [/\bwardrobes?\b/, "Wardrobe"],
  [/\bpantr(?:y|ies)\b/, "Pantry"],
  [/media\s*consoles?|\btv\s*consoles?\b/, "Media console"],
  [/\bsideboards?\b/, "Sideboard"],
  [/\bbuffets?\b/, "Buffet"],
  [/\bcredenzas?\b/, "Credenza"],
  [/\bclosets?\b/, "Closet"],
  [/\bhutch(?:es)?\b/, "Hutch"],
  [/\bdesks?\b/, "Desk"],
  [/\bbenches\b|\bbench\b/, "Bench"],
  [/\btables?\b/, "Table"],
  [/\bshelves\b|\bshelf\b/, "Shelf"],
  [/\bracks?\b/, "Rack"],
  [/\bmirrors?\b/, "Mirror"],
  [/\bladders?\b/, "Ladder"],
  [/\bstools?\b/, "Stool"],
  [/\bchairs?\b/, "Chair"],
  [/\bchests?\b/, "Chest"],
  [/\bbeds?\b/, "Bed"],
];

type Part = { stem: string; clause: string; project: YardProject };

function clauseCore(clause: string): string {
  return clause
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\b\d[\d\s./"'×x-]*\s*(?:inch(?:es)?|in|ft|foot|feet|wide|width|deep|depth|tall|high|height|long|by)?/gi, " ")
    .replace(/\bfrom\s+.*/i, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function partNotProduct(core: string): boolean {
  if (FEATURE.has(core)) return true;
  if (/\bknee(?:\s*space)?\b/.test(core) && !/\b(?:desk|bench|vanity|table)\b/.test(core)) return true;
  // "two shelves", "one lower shelf", "four hooks" belong to the host.
  // Bare "shelf" does not — "picture frame with a shelf" is two products.
  if (
    /^(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:lower\s+|upper\s+|bottom\s+|top\s+|adjustable\s+)?(?:shel(?:f|ves)|drawers?|doors?|hooks?|pegs?|cubbies|bins?|rungs?|arms?|brackets?|slots?|legs?|lids?)$/.test(
      core,
    )
  ) {
    return true;
  }
  if (/^(?:lower|upper|bottom|top|middle|inner|interior|adjustable)\s+shel(?:f|ves)$/.test(core)) return true;
  if (/^open\s+knee\s+space$/.test(core)) return true;
  return false;
}

function stemOf(clause: string): string | null {
  const core = clauseCore(clause);
  if (!core || partNotProduct(core)) return null;
  // A survey sentence mentions products in passing. A product clause is short.
  if (core.split(/\s+/).length > 8) return null;
  if (/\b(?:space|area|zone)\b/.test(core)) return null;
  for (const [re, stem] of PRODUCTS) {
    if (re.test(clause)) return stem;
  }
  const weekend = detectWeekendFamily(clause);
  if (weekend?.name) return weekend.name;
  return null;
}

function accessory(stem: string, others: string[]): boolean {
  const rest = others.join(" ").toLowerCase();
  if (stem === "Mirror" && /vanity|dresser|medicine/.test(rest)) return true;
  if (stem === "Ladder" && /bunk|loft/.test(rest)) return true;
  if (stem === "Shelf" && /bookcase|bookshelf|closet|hutch|dresser|wardrobe|pantry|linen/.test(rest)) return true;
  if (stem === "Rack" && /shoe rack|coat rack/.test(rest)) return true;
  if (stem === "Table" && /coffee table|dining table|nightstand/.test(rest)) return true;
  if (stem === "Bench" && /potting bench|workbench/.test(rest)) return true;
  if (stem === "Bed" && /bunk|loft|daybed|platform bed/.test(rest)) return true;
  return false;
}

function shareStock(clause: string, full: string): string {
  if (/\bfrom\b/i.test(clause)) return clause;
  const m = full.match(/\bfrom\s+[^,.]*/i);
  return m ? `${clause} ${m[0].trim()}` : clause;
}

function vecs(p: YardProject): Vec3[] {
  const out: Vec3[] = [];
  for (const panel of p.panels) {
    out.push(panel.position);
    out.push({
      x: panel.position.x + panel.size.width,
      y: panel.position.y + panel.size.height,
      z: panel.position.z + panel.size.depth,
    });
  }
  for (const i of p.instances) {
    if (i.position) out.push(i.position);
    if (i.from) out.push(i.from);
    if (i.to) out.push(i.to);
  }
  return out;
}

function span(p: YardProject) {
  const pts = vecs(p);
  if (!pts.length) return { minX: 0, minY: 0, minZ: 0, width: p.overall.width, height: p.overall.height, depth: p.overall.depth };
  const minX = Math.min(...pts.map((q) => q.x));
  const minY = Math.min(...pts.map((q) => q.y));
  const minZ = Math.min(...pts.map((q) => q.z));
  const maxX = Math.max(...pts.map((q) => q.x));
  const maxY = Math.max(...pts.map((q) => q.y));
  const maxZ = Math.max(...pts.map((q) => q.z));
  return { minX, minY, minZ, width: maxX - minX, height: maxY - minY, depth: maxZ - minZ };
}

function movePoint(p: Vec3, dx: number, dy: number, dz: number, sx = 1, originX = 0): Vec3 {
  return { x: originX + (p.x - originX) * sx + dx, y: p.y + dy, z: p.z + dz };
}

function mapPiece(p: YardProject, dx: number, dy: number, dz: number, sx = 1): YardProject {
  const box = span(p);
  const originX = box.minX;
  const panel = (panel0: Panel): Panel => {
    const pos = movePoint(panel0.position, dx, dy, dz, sx, originX);
    const poly = panel0.polygon
      ? {
          ...panel0.polygon,
          pts: panel0.polygon.pts.map(([a, b]) => [a * sx, b] as [number, number]),
        }
      : panel0.polygon;
    return {
      ...panel0,
      id: createId("pan"),
      position: pos,
      size: { ...panel0.size, width: panel0.size.width * sx },
      polygon: poly,
    };
  };
  const inst = (i: YardInstance): YardInstance => {
    const from = i.from ? movePoint(i.from, dx, dy, dz, sx, originX) : undefined;
    const to = i.to ? movePoint(i.to, dx, dy, dz, sx, originX) : undefined;
    const cut =
      from && to ? Math.round(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) * 10) / 10 : i.cutLength;
    return { ...i, id: createId("mem"), position: movePoint(i.position, dx, dy, dz, sx, originX), from, to, cutLength: cut };
  };
  return {
    ...p,
    panels: p.panels.map(panel),
    instances: p.instances.map(inst),
    overall: {
      width: Math.round(box.width * sx * 10) / 10,
      height: Math.round(box.height * 10) / 10,
      depth: Math.round(box.depth * 10) / 10,
    },
  };
}

function isWall(p: YardProject): boolean {
  const blob = `${p.name} ${p.prompt}`.toLowerCase();
  const hang = /coat|hook|peg|hat|towel|mirror|frame|picture|ledge|hall tree/.test(blob);
  return hang && p.overall.depth <= 14 && p.overall.height <= 40;
}

function hangBottom(wall: YardProject, host: YardProject): number {
  const blob = `${wall.name} ${wall.prompt}`.toLowerCase();
  const coats = /coat|hook|peg|hat|towel|hall/.test(blob);
  if (coats) return Math.max(host.overall.height, 66 - wall.overall.height);
  return Math.max(host.overall.height, 42);
}

function growPosts(host: YardProject, top: number): YardProject {
  let grew = false;
  const panels = host.panels.map((p) => {
    if (!/upright|side|post/i.test(p.name) && p.type !== "upright") return p;
    const need = top - p.position.y;
    if (need <= p.size.height + 0.5) return p;
    grew = true;
    return { ...p, size: { ...p.size, height: Math.round(need * 10) / 10 } };
  });
  if (grew) return { ...host, panels };
  const t = 0.75;
  const posts: Panel[] = [0, Math.max(host.overall.width - t, 0)].map((x, i) => ({
    id: createId("pan"),
    type: "upright",
    name: i === 0 ? "Left back post" : "Right back post",
    position: { x, y: 0, z: 0 },
    size: { width: t, height: Math.round(top * 10) / 10, depth: t },
    materialId: host.primaryMaterialId,
  }));
  return { ...host, panels: [...host.panels, ...posts] };
}

function footprint(p: YardProject): number {
  return Math.max(p.overall.width, 1) * Math.max(p.overall.depth, 1);
}

export function composeProducts(
  prompt: string,
  build: (clause: string) => YardProject,
): YardProject | null {
  if (looksLikePocket(prompt)) return null;
  if (!/\b(?:with|plus|and)\b/i.test(prompt)) return null;
  const clauses = prompt
    .split(/\s+(?:with|plus|\+|and)\s+(?:an?\s+|the\s+)?/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (clauses.length < 2) return null;
  const found = clauses
    .map((clause) => ({ clause, stem: stemOf(clause) }))
    .filter((c): c is { clause: string; stem: string } => !!c.stem);
  const kept = found.filter((c) => !accessory(c.stem, found.filter((o) => o !== c).map((o) => o.stem)));
  if (kept.length < 2) return null;

  // Coat rack + bench is one hall tree. Stacking the wall rack on the seat
  // stretches the bench sides into fins and runs the pegs across the seat.
  const stems = kept.map((c) => c.stem);
  if (stems.length === 2 && stems.includes("Coat rack") && stems.includes("Bench")) return null;

  const parts: Part[] = [];
  for (const c of kept) {
    const project = build(shareStock(c.clause, prompt));
    if (!project.panels.length && !project.instances.length) continue;
    parts.push({ stem: c.stem, clause: c.clause, project });
  }
  if (parts.length < 2) return null;

  const floors = parts.filter((p) => !isWall(p.project));
  const hostPart = (floors.length ? floors : parts).slice().sort((a, b) => footprint(b.project) - footprint(a.project))[0];
  let host = mapPiece(hostPart.project, -span(hostPart.project).minX, -span(hostPart.project).minY, -span(hostPart.project).minZ);
  const extras = parts.filter((p) => p !== hostPart);
  const placed: YardProject[] = [];
  let cursor = host.overall.width;
  let stackTop = 0;
  for (const extra of extras) {
    const normalized = mapPiece(extra.project, -span(extra.project).minX, -span(extra.project).minY, -span(extra.project).minZ);
    if (isWall(normalized)) {
      const sx = host.overall.width > 1 ? host.overall.width / Math.max(normalized.overall.width, 1) : 1;
      const fitted = mapPiece(normalized, 0, 0, 0, Math.min(Math.max(sx, 0.4), 4));
      const y = stackTop > 0 ? stackTop : hangBottom(fitted, host);
      const hung = mapPiece(fitted, 0, y, 0);
      stackTop = y + hung.overall.height;
      host = growPosts(host, stackTop);
      placed.push(hung);
    } else {
      placed.push(mapPiece(normalized, cursor, 0, 0));
      cursor += normalized.overall.width;
    }
  }

  const panels = [...host.panels, ...placed.flatMap((p) => p.panels)];
  const instances = [...host.instances, ...placed.flatMap((p) => p.instances)];
  const box = span({ ...host, panels, instances });
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const name = parts.map((p) => p.stem).join(" with ");
  const overall = {
    width: r1(box.width),
    height: r1(box.height),
    depth: r1(Math.max(box.depth, host.overall.depth)),
  };
  return {
    ...host,
    id: createId("proj"),
    name,
    prompt,
    panels,
    instances,
    overall,
    fitted: undefined,
    pocket: undefined,
    opening: undefined,
    windowPkg: undefined,
    notes: [
      `Combined: ${name}. ${parts.map((p) => p.stem).join(" and ")} are both here — neither one was dropped.`,
      ...host.notes.filter((n) => !n.startsWith("Combined:")),
    ],
  };
}
