/**
 * Stock-specific binders. PVC gets slip fittings, sticks get glue,
 * straws get tape — never one blob for every material.
 */
import { faceScrewInches } from "./shopJoin";
import { inchFrac } from "./inchText";
import { usesHotGlue, hotGlueBom } from "./adhesive";
import { screwTalk, stickJoints } from "./modelJoints";
import { getCatalogItem } from "./catalog";
import { fixedProfile } from "./geometry";
import type { BomLine, CatalogItem, JoinMethod, Panel, Vec3, YardInstance } from "./types";
import { dist } from "./connect";

/** Catalog ids binderBom adds for slip stock (cement and fittings), not cut parts. */
export const SLIP_FITTING_IDS = new Set(["pvc-cement", "pvc-tee", "pvc-elbow-90", "pvc-elbow-45", "pvc-side-outlet", "pvc-coupling"]);

/** Wood screws are bought by the box. Say the count inside so "2 boxes" never reads as 2 screws. */
export const SCREWS_PER_BOX = 50;
export function screwBoxUnit(boxes: number): string {
  return boxes === 1 ? `box (${SCREWS_PER_BOX} ct)` : `boxes (${SCREWS_PER_BOX} ct each)`;
}

export type BinderKind = "slip" | "glue" | "tape" | "fastener" | "friction";

export type JointClass = "ground" | "cap" | "coupling" | "elbow45" | "elbow90" | "tee" | "corner3" | "cross";

/** Two directions continue one straight pipe (the same test a coupling uses). */
const STRAIGHT = -0.82;
/** Shallower than a right angle, steeper than straight: a 45° elbow. */
const OBTUSE = -0.35;
/** A pair counts as square when it is within about 3° of 90° (sin 3° ≈ 0.052). */
const SQUARE = 0.05;

export type JointNode = {
  p: Vec3;
  r: number;
  dirs: Vec3[];
};

export const FRAME_ROLES = new Set(["leg", "rail", "ring", "support", "base", "tip"]);
export const SKIN_ROLES = new Set(["skin"]);

export function isFrameRole(role?: string): boolean {
  if (!role || role === "member") return true;
  return FRAME_ROLES.has(role);
}

export function isSkinRole(role?: string): boolean {
  return !!role && SKIN_ROLES.has(role);
}

export const JOIN_LABELS: Record<JoinMethod, string> = {
  glue: "Glue",
  notch: "Notch",
  solvent: "Solvent",
  friction: "Friction",
  tape: "Tape",
  screw: "Screw",
  nail: "Nail",
  pin: "Pin",
  slot: "Slot",
  cable_tie: "Cable tie",
  staple: "Staple",
  zip: "Zip tie",
  none: "None",
};

export function effectiveJoin(item: CatalogItem, override?: JoinMethod | null): JoinMethod {
  return override || item.preferredJoins?.[0] || "glue";
}

export function binderKind(item: CatalogItem, override?: JoinMethod | null): BinderKind {
  const j = effectiveJoin(item, override);
  if (j === "tape" || j === "cable_tie") return "tape";
  if (j === "screw" || j === "nail") return "fastener";
  if (item.category === "pvc_plumbing" || j === "solvent") return "slip";
  if (item.formFactor === "pipe" && j === "friction") return "slip";
  if (j === "friction" || j === "pin" || j === "slot") return "friction";
  return "glue";
}

function keyOf(p: Vec3) {
  return `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
}

export function jointNodes(
  members: { from?: Vec3; to?: Vec3; radius: number }[],
): JointNode[] {
  const map = new Map<string, JointNode>();
  for (const m of members) {
    if (!m.from || !m.to) continue;
    const ends: [Vec3, Vec3][] = [
      [m.from, m.to],
      [m.to, m.from],
    ];
    for (const [at, other] of ends) {
      const k = keyOf(at);
      let node = map.get(k);
      if (!node) {
        node = { p: at, r: m.radius, dirs: [] };
        map.set(k, node);
      } else if (m.radius > node.r) node.r = m.radius;
      const dx = other.x - at.x;
      const dy = other.y - at.y;
      const dz = other.z - at.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      if (!node.dirs.some((d) => d.x * dir.x + d.y * dir.y + d.z * dir.z > 0.97)) {
        node.dirs.push(dir);
      }
    }
  }
  return [...map.values()];
}

function pairDots(dirs: Vec3[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      out.push(dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z);
    }
  }
  return out;
}

/**
 * The fitting follows the pipes that meet, not the part name.
 * 2 at 90° is an elbow, 2 nearly straight is a coupling, 2 at 45° is a 45° elbow.
 * 3 pipes within about 3° of mutually perpendicular are a 3-way corner.
 * Any other meeting of 3 (a straight run with a branch, or an angled crown) is a tee.
 * Four pipes in one plane are a cross. A 4-way that leaves that plane, or 5 or more
 * pipes, is not a catalog cross.
 */
/**
 * A catalog cross is exactly four pipes in one plane.
 * A 5-way, a 6-way, or a 4-way that leaves the plane is not one, and is not sold as one.
 */
export function uncataloguedCrosses(members: { from?: Vec3; to?: Vec3; radius: number }[]): number {
  return jointNodes(members).filter((node) => node.dirs.length >= 4 && !(node.dirs.length === 4 && dirsSharePlane(node.dirs))).length;
}

export function dropUncataloguedCrosses<T extends { name: string; quantity: number; estimatedCost?: number }>(
  lines: T[],
  members: { from?: Vec3; to?: Vec3; radius: number }[],
): T[] {
  const extra = uncataloguedCrosses(members);
  if (!extra) return lines;
  return lines.flatMap((line) => {
    if (!/PVC cross/.test(line.name) || !(line.quantity > 0)) return [line];
    const qty = line.quantity - extra;
    if (qty <= 0) return [];
    const each = (line.estimatedCost ?? 0) / line.quantity;
    return [{ ...line, quantity: qty, estimatedCost: Math.round(qty * each * 100) / 100 }];
  });
}

/** Four directions are a catalog cross only when they lie in one plane. */
export function dirsSharePlane(dirs: Vec3[]): boolean {
  let normal: Vec3 | null = null;
  for (let i = 0; i < dirs.length && !normal; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const c = {
        x: dirs[i].y * dirs[j].z - dirs[i].z * dirs[j].y,
        y: dirs[i].z * dirs[j].x - dirs[i].x * dirs[j].z,
        z: dirs[i].x * dirs[j].y - dirs[i].y * dirs[j].x,
      };
      if (Math.hypot(c.x, c.y, c.z) > 0.2) {
        normal = c;
        break;
      }
    }
  }
  if (!normal) return true;
  const L = Math.hypot(normal.x, normal.y, normal.z);
  return dirs.every((d) => Math.abs(d.x * normal!.x + d.y * normal!.y + d.z * normal!.z) / L <= 0.08);
}

export function classifyJoint(node: JointNode): JointClass {
  const n = node.dirs.length;
  if (n <= 1 && node.p.y < 0.45) return "ground";
  if (n <= 1) return "cap";
  if (n >= 4) return "cross";
  if (n === 3) {
    const dots = pairDots(node.dirs);
    // A square corner: every pair is within about 3° of 90°. A straight run, or any angled meeting, stays a tee.
    const square = dots.length === 3 && dots.every((d) => Math.abs(d) <= SQUARE);
    return square ? "corner3" : "tee";
  }
  const d0 = node.dirs[0];
  const d1 = node.dirs[1];
  const dot = d0.x * d1.x + d0.y * d1.y + d0.z * d1.z;
  if (dot < STRAIGHT) return "coupling";
  if (dot < OBTUSE) return "elbow45";
  return "elbow90";
}

function longAxis(p: Panel): "x" | "y" | "z" {
  const ax = [
    ["x", p.size.width],
    ["y", p.size.height],
    ["z", p.size.depth],
  ] as const;
  return ax.slice().sort((a, b) => b[1] - a[1])[0][0];
}

function centerline(p: Panel): { id: string; axis: "x" | "y" | "z"; a: Vec3; b: Vec3 } {
  const axis = longAxis(p);
  const mid = {
    x: p.position.x + p.size.width / 2,
    y: p.position.y + p.size.height / 2,
    z: p.position.z + p.size.depth / 2,
  };
  const len = axis === "x" ? p.size.width : axis === "y" ? p.size.height : p.size.depth;
  return {
    id: p.id,
    axis,
    a: { ...mid, [axis]: mid[axis] - len / 2 },
    b: { ...mid, [axis]: mid[axis] + len / 2 },
  };
}

/**
 * A rail that stops on a fat drawn face is still aimed at the other centerline.
 * Extend it along its own axis, at most eight diameters, when the miss the other way is within one diameter.
 */
function aimedCenterline(
  s: { axis: "x" | "y" | "z"; a: Vec3; b: Vec3 },
  end: Vec3,
  o: { axis: "x" | "y" | "z"; a: Vec3; b: Vec3 },
  tol: number,
): Vec3 | null {
  if (s.axis === o.axis) return null;
  const third = (["x", "y", "z"] as const).find((a) => a !== s.axis && a !== o.axis)!;
  if (Math.abs(s.a[third] - o.a[third]) > tol) return null;
  const onO = s.a[o.axis];
  const o0 = Math.min(o.a[o.axis], o.b[o.axis]);
  const o1 = Math.max(o.a[o.axis], o.b[o.axis]);
  if (onO < o0 - tol || onO > o1 + tol) return null;
  const target = o.a[s.axis];
  const endAtMin = Math.abs(end[s.axis] - Math.min(s.a[s.axis], s.b[s.axis])) < 1e-4;
  const ext = endAtMin ? end[s.axis] - target : target - end[s.axis];
  if (ext <= tol || ext > 8 * tol) return null;
  return { ...o.a, [o.axis]: onO };
}

function closestOnSegment(p: Vec3, a: Vec3, b: Vec3): { d: number; q: Vec3 } {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  if (L2 < 1e-8) return { d: dist(p, a), q: a };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L2));
  const q = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
  return { d: dist(p, q), q };
}

/**
 * Recipe members are panels. Slip joints are where centerlines meet, within one catalog
 * pipe diameter — not the drawn box and not a board-joint threshold. Corners a frame-depth
 * apart stay separate; a fatter drawn post does not pull them together.
 * ponytail: straight centerlines of the box. A curved pipe waits until a recipe draws one.
 */
export function slipInstancesFromPanels(panels: Panel[], catalogId: string): YardInstance[] {
  const od = getCatalogItem(catalogId)?.dims.diameter ?? 1.05;
  const tol = Math.max(0.5, od);
  const mine = panels.filter((p) => p.materialId === catalogId && !p.polygon);
  if (mine.length < 2) return [];
  const segs = mine.map(centerline);
  const gap = (u: Vec3, v: Vec3) => dist(u, v);
  type Hit = { point: Vec3; ids: string[] };
  const hits: Hit[] = [];
  for (const s of segs) {
    for (const end of [s.a, s.b]) {
      const ids = [s.id];
      const snaps: Vec3[] = [];
      for (const o of segs) {
        if (o.id === s.id) continue;
        const hit = closestOnSegment(end, o.a, o.b);
        const aimed = hit.d <= tol + 1e-6 ? null : aimedCenterline(s, end, o, tol);
        if (hit.d <= tol + 1e-6 || aimed) {
          ids.push(o.id);
          snaps.push(aimed ?? hit.q);
        }
      }
      if (ids.length < 2) continue;
      const point = snaps.length === 1 ? snaps[0] : {
        x: snaps.reduce((n, q) => n + q.x, 0) / snaps.length,
        y: snaps.reduce((n, q) => n + q.y, 0) / snaps.length,
        z: snaps.reduce((n, q) => n + q.z, 0) / snaps.length,
      };
      hits.push({ point, ids });
    }
  }
  if (!hits.length) return [];
  const seen = hits.map(() => -1);
  const clusters: { point: Vec3; ids: Set<string> }[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (seen[i] >= 0) continue;
    const stack = [i];
    seen[i] = clusters.length;
    const group: Hit[] = [];
    while (stack.length) {
      const k = stack.pop()!;
      group.push(hits[k]);
      for (let j = 0; j < hits.length; j++) {
        if (seen[j] < 0 && gap(hits[k].point, hits[j].point) <= tol) {
          seen[j] = clusters.length;
          stack.push(j);
        }
      }
    }
    const ids = new Set(group.flatMap((g) => g.ids));
    if (ids.size < 2) continue;
    clusters.push({
      point: {
        x: group.reduce((s, g) => s + g.point.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.point.y, 0) / group.length,
        z: group.reduce((s, g) => s + g.point.z, 0) / group.length,
      },
      ids,
    });
  }
  const out: YardInstance[] = [];
  for (const p of mine) {
    const axis = longAxis(p);
    const pts: Vec3[] = [];
    for (const q of clusters.filter((c) => c.ids.has(p.id)).map((c) => c.point).sort((u, v) => u[axis] - v[axis])) {
      if (!pts.some((u) => gap(u, q) <= tol)) pts.push(q);
    }
    // One meeting: the other end is free, so the shared point still classifies (an elbow, not a cap).
    if (pts.length === 1) {
      const seg = segs.find((s) => s.id === p.id)!;
      const far = gap(seg.a, pts[0]) >= gap(seg.b, pts[0]) ? seg.a : seg.b;
      if (gap(pts[0], far) >= 0.5) {
        out.push({
          id: `${p.id}~0`,
          catalogId,
          position: pts[0],
          rotation: { x: 0, y: 0, z: 0 },
          from: pts[0],
          to: far,
        });
      }
      continue;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (gap(pts[i], pts[i + 1]) < 0.5) continue;
      out.push({
        id: `${p.id}~${i}`,
        catalogId,
        position: pts[i],
        rotation: { x: 0, y: 0, z: 0 },
        from: pts[i],
        to: pts[i + 1],
      });
    }
  }
  return out;
}

export function countSlipFittings(instances: YardInstance[], radius: number) {
  const nodes = jointNodes(
    instances.map((i) => ({ from: i.from, to: i.to, radius })),
  );
  const counts = { tees: 0, elbows90: 0, elbows45: 0, couplings: 0, crosses: 0, caps: 0, corners: 0 };
  for (const node of nodes) {
    const k = classifyJoint(node);
    if (k === "tee") counts.tees += 1;
    else if (k === "corner3") counts.corners += 1;
    else if (k === "elbow90") counts.elbows90 += 1;
    else if (k === "elbow45") counts.elbows45 += 1;
    else if (k === "coupling") counts.couplings += 1;
    else if (k === "cross") counts.crosses += 1;
    else if (k === "cap") counts.caps += 1;
  }
  return counts;
}

/** Bought slip fittings, in the same order and words Buy and the steps use. */
export function slipFittingPhrase(item: CatalogItem, counts: ReturnType<typeof countSlipFittings>): string {
  const size = pvcSizeLabel(item);
  const bits: string[] = [];
  const add = (qty: number, title: string, plural: string) => {
    if (qty > 0) bits.push(`${qty} ${size} PVC ${qty === 1 ? title : plural}`);
  };
  add(counts.corners, "3-way corner", "3-way corners");
  add(counts.couplings, "coupling", "couplings");
  add(counts.tees, "tee", "tees");
  add(counts.crosses, "cross", "crosses");
  add(counts.elbows90, "90° elbow", "90° elbows");
  add(counts.elbows45, "45° elbow", "45° elbows");
  if (!bits.length) return "";
  const list = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
  return `The fittings are ${list}, the same fittings on the Buy list.`;
}

function pvcSizeLabel(item: CatalogItem): string {
  const d = item.dims.diameter ?? 1.05;
  if (d < 0.95) return "1/2\"";
  if (d > 1.2) return "1\"";
  return "3/4\"";
}

/**
 * Couplings that join one straight run cut into sticks. A run that fits the stick needs none.
 * A collinear joint already drawn in the model stays as it was: counted, not bought.
 */
export function stockRunCouplings(panels: Panel[], item: CatalogItem): number {
  const stock = item.dims.length ?? 0;
  if (!fixedProfile(item) || !(stock > 0)) return 0;
  let n = 0;
  for (const p of panels) {
    if (p.materialId !== item.id) continue;
    const len = Math.max(p.size.width, p.size.height, p.size.depth);
    if (len > stock + 0.01) n += Math.ceil((len - 1e-6) / stock) - 1;
  }
  return n;
}

export function binderBom(
  item: CatalogItem,
  instances: YardInstance[],
  override?: JoinMethod | null,
  extraCouplings = 0,
): BomLine[] {
  const kind = binderKind(item, override);
  const joints = Math.max(1, Math.round(instances.length * 0.6));
  if (kind === "glue" && usesHotGlue(item)) return [{ ...hotGlueBom(), notes: `${hotGlueBom().notes} About ${joints} joints.` }];
  if (kind === "glue") {
    return [
      {
        name: item.category === "craft_wood" ? "Wood glue" : "Multi-purpose craft glue",
        quantity: 1,
        unit: "bottle",
        catalogId: "glue",
        searchQuery: "titebond wood glue 8 oz",
        estimatedCost: 5,
        notes: `Primary join: glue · ~${joints} joints`,
      },
    ];
  }
  if (kind === "tape") {
    return [
      {
        name: "Packing tape",
        quantity: 1,
        unit: "roll",
        catalogId: "tape-packing",
        searchQuery: "packing tape 1.88 inch",
        estimatedCost: 4,
        notes: `Wrap each joint. ~${joints} wraps.`,
      },
    ];
  }
  if (kind === "fastener") {
    // Screws follow the joints in the model: members meeting at welded ends, 2 per joint on lumber.
    const across = Math.max(item.dims.width ?? 0, item.dims.thickness ?? 0, item.dims.diameter ?? 0, 0.25);
    // Reach is the member as drawn: a 1" strip ripped from a sheet is 1" across, not the 48" sheet face.
    const reachOf = (i: YardInstance) => (i.section ? Math.max(i.section.width, i.section.height) : across) * 0.6 + 0.1;
    const talk = screwTalk(stickJoints(instances, item.category === "lumber" || item.category === "sheet_goods" || item.formFactor === "board" ? 2 : 1, reachOf));
    const screws = Math.max(4, talk.screws);
    // Screw length follows the stick's thickness: 3/4" boards take 1 1/4", a 2x (1 1/2") takes 2 1/2".
    const len = inchFrac(faceScrewInches(item.dims.thickness ?? item.dims.height ?? 0.75)).replace(" ", "-");
    return [
      {
        name: `#8 × ${len}" wood screws`,
        quantity: Math.ceil(screws / SCREWS_PER_BOX),
        unit: screwBoxUnit(Math.ceil(screws / SCREWS_PER_BOX)),
        catalogId: "screws-8",
        searchQuery: `#8 ${len} wood screws`,
        estimatedCost: 8,
        notes: talk.screws >= 4 ? talk.note : `${screws} screws for the few joints in the model.`,
      },
    ];
  }
  if (kind === "slip") {
    const r = (item.dims.diameter ?? 1.05) / 2;
    const c = countSlipFittings(instances, r);
    const size = pvcSizeLabel(item);
    const lines: BomLine[] = [
      {
        name: "PVC solvent cement",
        quantity: 1,
        unit: "can",
        catalogId: "pvc-cement",
        searchQuery: "PVC solvent cement",
        estimatedCost: 7,
        notes: "Dry-fit every joint. Cement is permanent.",
      },
    ];
    const push = (qty: number, name: string, id: string, q: string, cost: number, why?: string) => {
      if (qty <= 0) return;
      lines.push({
        name,
        quantity: qty,
        unit: "ea",
        catalogId: id,
        searchQuery: q,
        estimatedCost: qty * cost,
        notes: why ?? `Match ${size} pipe.`,
      });
    };
    push(c.corners, `${size} PVC 3-way corner`, "pvc-side-outlet", `${size} schedule 40 PVC 3-way elbow`, 2.37, "Side-outlet elbow. Three sockets at right angles, one along each axis.");
    push(extraCouplings, `${size} PVC coupling`, "pvc-coupling", `${size} schedule 40 PVC coupling`, 0.68);
    push(c.tees, `${size} PVC tee`, "pvc-tee", `${size} schedule 40 PVC tee`, 1.15);
    push(c.crosses, `${size} PVC cross`, "pvc-tee", `${size} schedule 40 PVC cross`, 2.4);
    push(c.elbows90, `${size} PVC 90° elbow`, "pvc-elbow-90", `${size} schedule 40 PVC 90 elbow`, 0.95);
    push(c.elbows45, `${size} PVC 45° elbow`, "pvc-elbow-45", `${size} schedule 40 PVC 45 elbow`, 0.95);
    return lines;
  }
  return [];
}

export function memberSpan(a?: Vec3, b?: Vec3): number {
  if (!a || !b) return 0;
  return dist(a, b);
}
