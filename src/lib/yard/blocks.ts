/**
 * Weekend parts blocks: shared, subject-free building blocks any subject can combine.
 *   neck    - a long S-curve neck in 3+ joined bends, head forward of the chest, optional stilt legs or four legs
 *   wheels  - round discs on axles through a clearance (bearing) hole, wheels lowest, chassis plus body parts
 *   tube    - a cylinder of staves with a nose (pointed or rounded), fins, and an optional door for a kid inside
 *   perched - an upright body with a face disc on the front and a flat back and base
 *   figure  - a box figure (legs with a gap, arms, head) or a ball-jointed poseable figure
 *   towers  - tube towers joined by walls with a gate and drawbridge
 * Every block builds in the typed stock: lumber laminates whole pieces, craft sticks and dowels slat or cage,
 * sheet goods (cardboard, plywood) cut panels and strips. A subject is a combo of blocks.
 */
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { inchFrac } from "./inchText";
import { unionOutline } from "./shapeTemplates";
import type { CatalogItem, Panel, Vec3 } from "./types";

export type BlockPiece = {
  a: Vec3;
  b: Vec3;
  role: string;
  stock: string;
  /** Drawn and nested cross-section (strip width x thickness). */
  section?: { width: number; height: number };
  /** Thickness-axis normal. */
  face?: Vec3;
  /** Cut round: disc diameter; a to b runs through its thickness. */
  round?: number;
  /** Length of stock this piece uses (a disc uses its diameter). */
  cut?: number;
};

export type BlockCombo = "neck" | "wheels" | "tube" | "perched" | "figure" | "towers";

export type BlockSubject = {
  subject: string;
  label: string;
  blocks: BlockCombo[];
  neck?: "swim" | "wade" | "quad";
  /** A flat sheet profile of the same stance ("cutout", "silhouette", "flat"). */
  cutout?: boolean;
  vehicle?: "truck" | "bus" | "train" | "wagon" | "car" | "tractor";
  tube?: "rocket" | "submarine";
  perched?: "owl" | "penguin";
  figure?: "box" | "ball";
};

const SUBJECTS: { re: RegExp; s: BlockSubject }[] = [
  { re: /\bswans?\b|\bgeese\b|\bgoose\b/, s: { subject: "swan", label: "Swan", blocks: ["neck"], neck: "swim" } },
  { re: /\bflamingos?\b|\bflamingoes\b/, s: { subject: "flamingo", label: "Flamingo", blocks: ["neck"], neck: "wade" } },
  { re: /\bherons?\b|\begrets?\b|\bstorks?\b|\bibis(?:es)?\b|\b(?:sandhill|whooping|crowned|bird)\s+cranes?\b/, s: { subject: "heron", label: "Heron", blocks: ["neck"], neck: "wade" } },
  { re: /\bostrich(?:es)?\b|\bemus?\b/, s: { subject: "ostrich", label: "Ostrich", blocks: ["neck"], neck: "wade" } },
  { re: /\bgiraffes?\b|\bllamas?\b|\balpacas?\b/, s: { subject: "giraffe", label: "Giraffe", blocks: ["neck"], neck: "quad" } },
  { re: /\btrains?\b|\blocomotives?\b|\bsteam\s+engines?\b|\bchoo[\s-]*choo\b|\btrain\s+engine/, s: { subject: "train engine", label: "Train engine", blocks: ["wheels"], vehicle: "train" } },
  { re: /\bbus(?:es|ses)?\b|\bvans?\b/, s: { subject: "bus", label: "Bus", blocks: ["wheels"], vehicle: "bus" } },
  { re: /\bwagons?\b|\b(?:pull|toy|garden|kids?'?)\s+carts?\b/, s: { subject: "wagon", label: "Wagon", blocks: ["wheels"], vehicle: "wagon" } },
  { re: /\btrucks?\b|\bpickups?\b|\blorr(?:y|ies)\b|\bfire\s*engines?\b/, s: { subject: "truck", label: "Truck", blocks: ["wheels"], vehicle: "truck" } },
  { re: /\btractors?\b/, s: { subject: "tractor", label: "Tractor", blocks: ["wheels"], vehicle: "tractor" } },
  { re: /\b(?:race|toy|wooden|pine)\s+cars?\b|\bjeeps?\b|\brace\s*cars?\b/, s: { subject: "car", label: "Car", blocks: ["wheels"], vehicle: "car" } },
  { re: /\brockets?\b|\brocket\s*ships?\b|\bspace\s*ships?\b/, s: { subject: "rocket", label: "Rocket", blocks: ["tube"], tube: "rocket" } },
  { re: /\bsubmarines?\b/, s: { subject: "submarine", label: "Submarine", blocks: ["tube"], tube: "submarine" } },
  { re: /\bowls?\b/, s: { subject: "owl", label: "Owl", blocks: ["perched"], perched: "owl" } },
  { re: /\bpenguins?\b/, s: { subject: "penguin", label: "Penguin", blocks: ["perched"], perched: "penguin" } },
  { re: /\brobots?\b|\bandroids?\b|\bdroids?\b/, s: { subject: "robot", label: "Robot", blocks: ["figure"], figure: "box" } },
  { re: /\bcastles?\b|\bforts?\b/, s: { subject: "castle", label: "Castle", blocks: ["towers", "tube"] } },
];

/** Furniture or a house that carries the noun (train table, owl house, rocket shelf) is a different build. */
const NOT_THE_SUBJECT =
  /\b(?:table|desk|beds?|bunk|loft|shel(?:f|ves)|bookcase|bookshelf|cabinet|dresser|bench|stool|chair|storage|organizer|rack|house|coop|feeder|nest\s*box|sign|lamp|mirror|hooks?|hanger|planter|toy\s*box|garage|track|ramp|stand\s+for)\b|\bbird\s*house|birdhouse/;

export function detectBlockSubject(prompt: string): BlockSubject | null {
  const lower = prompt.toLowerCase();
  if (NOT_THE_SUBJECT.test(lower)) return null;
  for (const { re, s } of SUBJECTS) {
    if (!re.test(lower)) continue;
    const out: BlockSubject = { ...s };
    if (out.figure && /wood(?:en)?[\s-]*balls?|pose-?able|posable|articulated|jointed/.test(lower)) out.figure = "ball";
    if (out.neck && /\bcut\s*-?\s*outs?\b|\bsilhouette\b|\bflat\b/.test(lower)) out.cutout = true;
    return out;
  }
  return null;
}

/** Stock a block subject defaults to when none is typed (a pull wagon is plywood). */
export function defaultBlockStock(prompt: string): string | null {
  const s = detectBlockSubject(prompt);
  if (!s) return null;
  if (s.vehicle === "wagon") return "plywood-1-2-4x8";
  if (s.cutout) return "plywood-1-2-4x8";
  return null;
}

// ---------------------------------------------------------------- vector kit

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const unit = (a: Vec3) => mul(a, 1 / (len(a) || 1));
const X = v3(1, 0, 0);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const rad = (d: number) => (d * Math.PI) / 180;
const r16 = (n: number) => Math.round(n * 16) / 16;
const fmt = (n: number) => inchFrac(r16(n));

function basis(axis: Vec3): [Vec3, Vec3] {
  const a = unit(axis);
  const ref = Math.abs(a.y) < 0.9 ? Y : X;
  const u = unit(sub(ref, mul(a, dot(ref, a))));
  return [u, unit(cross(a, u))];
}

// ---------------------------------------------------------------- stock kit

type KitKind = "lumber" | "dowel" | "stick" | "sheet";
type Kit = { kind: KitKind; item: CatalogItem; W: number; T: number; S: number };

export function blockKit(item: CatalogItem): Kit {
  const prim = toPrimitive(item);
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") {
    return { kind: "sheet", item, W: 48, T: Math.max(0.06, item.dims.thickness ?? item.dims.height ?? 0.25), S: 96 };
  }
  if (item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe") return { kind: "dowel", item, W: prim.width, T: prim.width, S: prim.length };
  if (item.category === "lumber" || item.formFactor === "board" || prim.width >= 1.2) return { kind: "lumber", item, W: prim.width, T: prim.height, S: prim.length };
  return { kind: "stick", item, W: prim.width, T: Math.max(prim.height, 0.04), S: prim.length };
}

type Axis = "x" | "y" | "z";
const AXV: Record<Axis, Vec3> = { x: X, y: Y, z: Z };

class Bench {
  pieces: BlockPiece[] = [];
  panels: Panel[] = [];
  constructor(public kit: Kit) {}

  put(a: Vec3, b: Vec3, role: string, extra: Partial<BlockPiece> = {}) {
    this.pieces.push({ a, b, role, stock: extra.stock ?? this.kit.item.id, ...extra });
  }

  private faceFor(d: Vec3, face?: Vec3) {
    const f = face ?? (Math.abs(d.z) < 0.9 ? Z : X);
    const g = sub(f, mul(d, dot(f, d)));
    return len(g) > 1e-6 ? unit(g) : Math.abs(d.y) < 0.9 ? Y : X;
  }

  /** One straight member a to b. Sheet stock cuts a strip w wide; craft sticks longer than one stick lap end to end. */
  member(a: Vec3, b: Vec3, role: string, opt: { w?: number; face?: Vec3; stock?: string } = {}) {
    const k = this.kit;
    const L = len(sub(b, a));
    if (L < 0.05) return;
    const d = unit(sub(b, a));
    const face = this.faceFor(d, opt.face);
    if (opt.stock) {
      this.put(a, b, role, { stock: opt.stock, cut: r16(L), face });
      return;
    }
    if (k.kind === "sheet") {
      this.put(a, b, role, { section: { width: r16(opt.w ?? Math.max(1, 8 * k.T)), height: k.T }, face, cut: r16(L) });
      return;
    }
    const sec = k.kind === "lumber" ? { section: { width: k.W, height: k.T } } : {};
    if (L <= k.S + 1e-6) {
      const whole = k.kind === "stick" && Math.abs(L - k.S) < 0.07;
      this.put(a, b, role, { ...sec, face, ...(whole ? {} : { cut: r16(L) }) });
      return;
    }
    const lap = k.kind === "stick" ? Math.min(1, k.S * 0.25) : 0;
    const n = Math.ceil((L - lap) / (k.S - lap) - 1e-9);
    const step = (L - lap) / n;
    for (let i = 0; i < n; i++) {
      const p0 = add(a, mul(d, i * step));
      const p1 = add(a, mul(d, Math.min(L, i * step + step + lap)));
      const off = k.kind === "stick" && i % 2 ? mul(face, k.T) : v3(0, 0, 0);
      const seg = len(sub(p1, p0));
      const whole = k.kind === "stick" && Math.abs(seg - k.S) < 0.07;
      this.put(add(p0, off), add(p1, off), role, { ...sec, face, ...(whole ? {} : { cut: r16(seg) }) });
    }
  }

  /**
   * Solid block centred at c. Lumber laminates whole pieces along `run`; sticks build slatted walls with a deck;
   * dowels build a cage; sheet goods cut six faces (or stack layers when solid). Returns the size built.
   */
  block(c: Vec3, sx: number, sy: number, sz: number, role: string, opt: { run?: Axis; solid?: boolean; open?: "top"; widthAxis?: Axis } = {}): { sx: number; sy: number; sz: number } {
    const k = this.kit;
    const dims: Record<Axis, number> = { x: sx, y: sy, z: sz };
    if (k.kind === "lumber" || (k.kind === "sheet" && opt.solid)) {
      const run: Axis = opt.run ?? (sx >= sy && sx >= sz ? "x" : sy >= sz ? "y" : "z");
      const others = (["x", "y", "z"] as Axis[]).filter((q) => q !== run);
      const sheet = k.kind === "sheet";
      const count = (wA: Axis, tA: Axis) => ({ nw: sheet ? 1 : Math.max(1, Math.round(dims[wA] / k.W)), nt: Math.max(1, Math.round(dims[tA] / k.T)) });
      const err = (wA: Axis, tA: Axis) => {
        const { nw, nt } = count(wA, tA);
        return (sheet ? 0 : Math.abs(nw * k.W - dims[wA])) + Math.abs(nt * k.T - dims[tA]);
      };
      let [wA, tA] = others;
      if (opt.widthAxis && others.includes(opt.widthAxis)) {
        wA = opt.widthAxis;
        tA = others.find((q) => q !== wA)!;
      } else if (err(others[1], others[0]) < err(others[0], others[1])) [wA, tA] = [others[1], others[0]];
      const { nw, nt } = count(wA, tA);
      const pw = sheet ? dims[wA] : k.W;
      const out: Record<Axis, number> = { ...dims, [wA]: nw * pw, [tA]: nt * k.T } as Record<Axis, number>;
      for (let i = 0; i < nw; i++) {
        for (let j = 0; j < nt; j++) {
          const m = add(c, add(mul(AXV[wA], -out[wA] / 2 + pw * (i + 0.5)), mul(AXV[tA], -out[tA] / 2 + k.T * (j + 0.5))));
          const half = mul(AXV[run], out[run] / 2);
          this.put(sub(m, half), add(m, half), role, { section: { width: r16(pw), height: k.T }, face: AXV[tA], cut: r16(out[run]) });
        }
      }
      return { sx: out.x, sy: out.y, sz: out.z };
    }
    if (k.kind === "sheet") {
      const T = k.T;
      const faces: { n: Vec3; at: Vec3; along: Vec3; L: number; w: number }[] = [];
      const flat = (y: number) => faces.push({ n: Y, at: v3(0, y, 0), along: sx >= sz ? X : Z, L: Math.max(sx, sz), w: Math.min(sx, sz) });
      flat(-sy / 2 + T / 2);
      if (opt.open !== "top") flat(sy / 2 - T / 2);
      const hIn = sy - T * (opt.open === "top" ? 1 : 2);
      const yMid = opt.open === "top" ? T / 2 : 0;
      for (const s of [-1, 1]) {
        faces.push({ n: Z, at: v3(0, yMid, s * (sz / 2 - T / 2)), along: sx >= hIn ? X : Y, L: Math.max(sx, hIn), w: Math.min(sx, hIn) });
        const ez = sz - 2 * T;
        faces.push({ n: X, at: v3(s * (sx / 2 - T / 2), yMid, 0), along: ez >= hIn ? Z : Y, L: Math.max(ez, hIn), w: Math.min(ez, hIn) });
      }
      for (const f of faces) {
        const m = add(c, f.at);
        const half = mul(f.along, f.L / 2);
        this.put(sub(m, half), add(m, half), role, { section: { width: r16(f.w), height: T }, face: f.n, cut: r16(f.L) });
      }
      return { sx, sy, sz };
    }
    if (k.kind === "dowel") {
      const r = k.W / 2;
      const hx = sx / 2 - r, hy = sy / 2 - r, hz = sz / 2 - r;
      for (const xs of [-1, 1]) for (const zs of [-1, 1]) this.member(add(c, v3(xs * hx, -sy / 2, zs * hz)), add(c, v3(xs * hx, sy / 2, zs * hz)), role);
      for (const ys of [-1, 1]) {
        for (const zs of [-1, 1]) this.member(add(c, v3(-hx + r, ys * hy, zs * hz)), add(c, v3(hx - r, ys * hy, zs * hz)), role);
        for (const xs of [-1, 1]) this.member(add(c, v3(xs * hx, ys * hy, -hz + r)), add(c, v3(xs * hx, ys * hy, hz - r)), role);
      }
      for (const zs of [-1, 1]) this.member(add(c, v3(-hx + r, -hy + r, zs * hz)), add(c, v3(hx - r, hy - r, zs * hz)), role);
      return { sx, sy, sz };
    }
    // Craft sticks: slatted front/back walls, rails inside them, slatted end walls, and a top deck.
    const T = k.T;
    const nF = Math.max(2, Math.round(sx / k.W));
    const slatW = sx / nF;
    for (const zs of [-1, 1]) {
      const z = zs * (sz / 2 - T / 2);
      for (let i = 0; i < nF; i++) {
        const x = -sx / 2 + slatW * (i + 0.5);
        this.member(add(c, v3(x, -sy / 2, z)), add(c, v3(x, sy / 2, z)), role, { face: Z });
      }
      for (const ys of [-1, 1]) this.member(add(c, v3(-sx / 2, ys * (sy / 2 - k.W / 2), z - zs * T)), add(c, v3(sx / 2, ys * (sy / 2 - k.W / 2), z - zs * T)), role, { face: Z });
    }
    const inner = sz - 4 * T;
    const nE = Math.max(1, Math.round(inner / k.W));
    for (const xs of [-1, 1]) {
      const x = xs * (sx / 2 - T / 2);
      for (let i = 0; i < nE; i++) {
        const z = -inner / 2 + (inner / nE) * (i + 0.5);
        this.member(add(c, v3(x, -sy / 2, z)), add(c, v3(x, sy / 2, z)), role, { face: X });
      }
    }
    if (opt.open !== "top") {
      const nT = Math.max(1, Math.round(sz / k.W));
      for (let i = 0; i < nT; i++) {
        const z = -sz / 2 + (sz / nT) * (i + 0.5);
        this.member(add(c, v3(-sx / 2, sy / 2 + T / 2, z)), add(c, v3(sx / 2, sy / 2 + T / 2, z)), role, { face: Y });
      }
    }
    return { sx, sy, sz };
  }

  /**
   * Oval body (a bird or animal hull) centred at c: L long (x), H tall, W wide (z), oval in plan and
   * rounded in profile. Sticks stand slats around the oval with a deck across the top; dowels cage
   * it with oval rings; lumber stacks layers whose boards shorten toward the top and bottom.
   */
  oval(c: Vec3, L: number, H: number, W: number, role: string): { sx: number; sy: number; sz: number } {
    const k = this.kit;
    const a = L / 2, bz = W / 2;
    if (k.kind === "lumber") {
      const nt = Math.max(1, Math.round(H / k.T));
      const nw = Math.max(1, Math.round(W / k.W));
      const sy = nt * k.T, sz = nw * k.W;
      for (let j = 0; j < nt; j++) {
        const yv = -sy / 2 + k.T * (j + 0.5);
        const fy = Math.sqrt(Math.max(0.3, 1 - (yv / (sy / 2 + k.T * 0.3)) ** 2));
        for (let i = 0; i < nw; i++) {
          const z = -sz / 2 + k.W * (i + 0.5);
          const fz = nw === 1 ? 1 : Math.sqrt(Math.max(0.35, 1 - (z / (sz / 2 + k.W * 0.3)) ** 2));
          const half = a * fy * fz;
          this.put(add(c, v3(-half, yv, z)), add(c, v3(half, yv, z)), role, { section: { width: k.W, height: k.T }, face: Y, cut: r16(2 * half) });
        }
      }
      return { sx: L, sy, sz };
    }
    if (k.kind === "sheet") return this.block(c, L, H, W, role);
    const m = k.kind === "dowel" ? 10 : Math.max(12, Math.round((Math.PI * (3 * (a + bz) - Math.sqrt((3 * a + bz) * (a + 3 * bz)))) / k.W));
    const pts = Array.from({ length: m }, (_, i) => {
      const t = (2 * Math.PI * i) / m;
      return { x: a * Math.cos(t), z: bz * Math.sin(t), nx: Math.cos(t) / a, nz: Math.sin(t) / bz };
    });
    if (k.kind === "dowel") {
      const r = k.W / 2;
      for (const yy of [-H / 2 + r, H / 2 - r]) {
        for (let i = 0; i < m; i++) {
          const p0 = pts[i], p1 = pts[(i + 1) % m];
          this.member(add(c, v3(p0.x, yy, p0.z)), add(c, v3(p1.x, yy, p1.z)), role);
        }
      }
      for (let i = 0; i < m; i += 2) this.member(add(c, v3(pts[i].x, -H / 2, pts[i].z)), add(c, v3(pts[i].x, H / 2, pts[i].z)), role);
      this.member(add(c, v3(-a, H / 2 - r, 0)), add(c, v3(a, H / 2 - r, 0)), role);
      return { sx: L, sy: H, sz: W };
    }
    // Craft sticks: slats stand edge to edge around the oval, a band inside top and bottom, a deck across the top.
    for (const p of pts) {
      const n = unit(v3(p.nx, 0, p.nz));
      const base = add(c, v3(p.x - (n.x * k.T) / 2, 0, p.z - (n.z * k.T) / 2));
      this.member(add(base, v3(0, -H / 2, 0)), add(base, v3(0, H / 2, 0)), role, { face: n });
    }
    // Bands inside top and bottom: one short piece from slat to slat (every other slat), each touching both.
    for (const yy of [-H / 2 + k.W / 2, H / 2 - k.W / 2]) {
      for (let i = 0; i < m; i += 2) {
        const p0 = pts[i], p1 = pts[(i + 2) % m];
        const n0 = unit(v3(p0.nx, 0, p0.nz)), n1 = unit(v3(p1.nx, 0, p1.nz));
        const q0 = add(c, v3(p0.x - n0.x * 1.5 * k.T, yy, p0.z - n0.z * 1.5 * k.T));
        const q1 = add(c, v3(p1.x - n1.x * 1.5 * k.T, yy, p1.z - n1.z * 1.5 * k.T));
        const mid = unit(add(n0, n1));
        this.member(q0, q1, `${role} band`, { face: mid });
      }
    }
    const nD = Math.max(2, Math.round(W / k.W));
    for (let i = 0; i < nD; i++) {
      const z = -bz + (W / nD) * (i + 0.5);
      const half = a * Math.sqrt(Math.max(0.05, 1 - (z / bz) ** 2));
      this.member(add(c, v3(-half, H / 2 + k.T / 2, z)), add(c, v3(half, H / 2 + k.T / 2, z)), role, { face: Y });
    }
    return { sx: L, sy: H, sz: W };
  }

  /** A round disc centred at c, square to `axis`. Lumber and sheet cut it round; thin stock glues a raft of strips. */
  disc(c: Vec3, axis: Vec3, d: number, role: string, opt: { stock?: string } = {}): number {
    const k = this.kit;
    const ax = unit(axis);
    if (opt.stock) {
      const it = getCatalogItem(opt.stock);
      const t = it?.dims.thickness ?? it?.dims.height ?? 0.75;
      this.put(sub(c, mul(ax, t / 2)), add(c, mul(ax, t / 2)), role, { stock: opt.stock, round: r16(d), cut: r16(d), section: it?.formFactor === "sheet" ? { width: r16(d), height: t } : undefined });
      return d;
    }
    if (k.kind === "lumber" || k.kind === "sheet") {
      const dd = k.kind === "lumber" ? Math.min(d, k.W) : d;
      this.put(sub(c, mul(ax, k.T / 2)), add(c, mul(ax, k.T / 2)), role, { round: r16(dd), cut: r16(dd), section: { width: r16(k.kind === "lumber" ? k.W : dd), height: k.T } });
      return dd;
    }
    const [u, v] = basis(ax);
    const n = Math.max(3, Math.round(d / k.W));
    const pitch = d / n;
    for (let i = 0; i < n; i++) {
      const o = -d / 2 + pitch * (i + 0.5);
      const chord = 2 * Math.sqrt(Math.max(0.04, (d / 2) ** 2 - o * o));
      const m = add(c, mul(v, o));
      this.member(sub(m, mul(u, chord / 2)), add(m, mul(u, chord / 2)), role, { face: ax });
    }
    for (const s of [-1, 1]) {
      const m = add(add(c, mul(u, (s * d) / 4)), mul(ax, -k.T));
      const half = Math.sqrt(Math.max(0.04, (d / 2) ** 2 - (d / 4) ** 2));
      this.member(sub(m, mul(v, half)), add(m, mul(v, half)), role, { face: ax });
    }
    return d;
  }

  /** Tube of staves around `axis` from c0, outer diameter d, length L, with an optional door opening and its flap. */
  tube(c0: Vec3, axis: Vec3, d: number, L: number, role: string, opt: { n?: number; door?: { from: number; to: number; dir: Vec3; arc: number } } = {}) {
    const k = this.kit;
    const ax = unit(axis);
    const [u, v] = basis(ax);
    const T = k.T;
    const n = opt.n ?? (k.kind === "sheet" ? 4 : Math.max(8, Math.min(48, Math.round((Math.PI * d) / Math.max(k.W, 0.1)))));
    // Every stave's outer face sits on the named diameter: that is where a tower, fins or a cradle meet the
    // body. Four staves meet at their corners; the diameter is across the flats.
    const Rc = d / 2 - T / 2;
    const w = 2 * Rc * Math.tan(Math.PI / n);
    const door = opt.door;
    const doorTheta = door ? Math.atan2(dot(door.dir, v), dot(door.dir, u)) : 0;
    const doorIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      const th = (2 * Math.PI * i) / n;
      const rh = add(mul(u, Math.cos(th)), mul(v, Math.sin(th)));
      const base = add(c0, mul(rh, Rc));
      const sw = k.kind === "sheet" ? { w } : {};
      const dth = Math.abs(Math.atan2(Math.sin(th - doorTheta), Math.cos(th - doorTheta)));
      if (door && dth <= door.arc / 2 + 1e-9) {
        doorIdx.push(i);
        if (door.from > 0.05) this.member(base, add(base, mul(ax, door.from)), role, { ...sw, face: rh });
        if (L - door.to > 0.05) this.member(add(base, mul(ax, door.to)), add(base, mul(ax, L)), role, { ...sw, face: rh });
      } else {
        this.member(base, add(base, mul(ax, L)), role, { ...sw, face: rh });
      }
    }
    if (door && doorIdx.length) {
      // The flap is the cut-out staves in one piece, folded open on the hinge edge (the last door stave's far edge).
      const span = doorIdx.length * w;
      const offs = doorIdx.map((i) => Math.atan2(Math.sin((2 * Math.PI * i) / n - doorTheta), Math.cos((2 * Math.PI * i) / n - doorTheta)));
      const thHinge = doorTheta + Math.max(...offs) + Math.PI / n;
      const rE = add(mul(u, Math.cos(thHinge)), mul(v, Math.sin(thHinge)));
      const tBack = add(mul(u, Math.sin(thHinge)), mul(v, -Math.cos(thHinge)));
      const open = rad(75);
      const dirF = unit(add(mul(tBack, Math.cos(open)), mul(rE, Math.sin(open))));
      const hinge = add(c0, mul(rE, Rc + T / 2));
      const nF = unit(cross(ax, dirF));
      const half = mul(ax, (door.to - door.from) / 2);
      const mid = add(add(hinge, add(mul(dirF, span / 2), mul(nF, T / 2))), mul(ax, (door.from + door.to) / 2));
      if (k.kind === "sheet") this.put(sub(mid, half), add(mid, half), "door", { section: { width: r16(span), height: T }, face: nF, cut: r16(door.to - door.from) });
      else for (let j = 0; j < doorIdx.length; j++) {
        const m = add(add(hinge, add(mul(dirF, w * (j + 0.5)), mul(nF, T / 2))), mul(ax, (door.from + door.to) / 2));
        this.member(sub(m, half), add(m, half), "door", { face: nF });
      }
    }
    // Sticks and dowels: hoops inside both ends (and the middle of a long tube) hold the staves.
    if (k.kind === "stick" || k.kind === "dowel") {
      const at = L > 3 * k.S ? [k.W, L / 2, L - k.W] : [k.W, L - k.W];
      const Rh = Rc - T;
      const m = Math.max(6, Math.min(12, Math.round((2 * Math.PI * Rh) / Math.max(1, k.S * 0.8))));
      for (const h of at) {
        for (let i = 0; i < m; i++) {
          const t0 = (2 * Math.PI * i) / m, t1 = (2 * Math.PI * (i + 1)) / m;
          const p0 = add(add(c0, mul(ax, h)), add(mul(u, Rh * Math.cos(t0)), mul(v, Rh * Math.sin(t0))));
          const p1 = add(add(c0, mul(ax, h)), add(mul(u, Rh * Math.cos(t1)), mul(v, Rh * Math.sin(t1))));
          this.member(p0, p1, `${role} hoop`, { face: ax });
        }
      }
    }
    return { n, w };
  }

  /** Nose on a tube end: gores to a point, or a rounded two-bend nose with a cap. */
  nose(c0: Vec3, axis: Vec3, d: number, L: number, role: string, shape: "point" | "round") {
    const k = this.kit;
    const ax = unit(axis);
    const [u, v] = basis(ax);
    const n = k.kind === "sheet" ? 4 : Math.max(6, Math.min(24, Math.round((Math.PI * d) / Math.max(2 * k.W, 0.2))));
    // Outer faces on the named diameter, as the tube: the parts fixed to it meet it there.
    const Rc = d / 2 - k.T / 2;
    const w0 = 2 * Rc * Math.tan(Math.PI / n);
    const tip = add(c0, mul(ax, L));
    // A sheet nose has the tube's four staves, so each gore continues a stave face; a many-stave nose staggers its gores.
    const phase = k.kind === "sheet" ? 0 : 0.5;
    for (let i = 0; i < n; i++) {
      const th = (2 * Math.PI * (i + phase)) / n;
      const rh = add(mul(u, Math.cos(th)), mul(v, Math.sin(th)));
      const rim = add(c0, mul(rh, Rc));
      const strip = (w: number) => (k.kind === "sheet" ? { w, face: rh } : { face: rh });
      if (shape === "point") this.member(rim, tip, role, strip(w0 * 0.92));
      else {
        const mid = add(add(c0, mul(ax, L * 0.55)), mul(rh, Rc * 0.82));
        const end = add(add(c0, mul(ax, L * 0.97)), mul(rh, Rc * 0.3));
        this.member(rim, mid, role, strip(w0 * 0.9));
        this.member(mid, end, role, strip(w0 * 0.6));
      }
    }
    if (shape === "round") this.disc(add(c0, mul(ax, L * 0.97)), ax, Rc * 0.75, `${role} cap`);
  }

  /** A flat fin standing out along `rh` (unit, square to the axis) from its root on the tube. */
  fin(root: Vec3, axis: Vec3, rh: Vec3, span: number, chord: number, role: string) {
    const k = this.kit;
    const ax = unit(axis);
    const tang = unit(cross(ax, rh));
    if (k.kind === "sheet") {
      // Swept fin: a full-chord root strip and a shorter tip strip glued edge to edge.
      const m0 = add(root, mul(rh, span * 0.3));
      this.put(m0, add(m0, mul(ax, chord)), role, { section: { width: r16(span * 0.6), height: k.T }, face: tang, cut: r16(chord) });
      const m1 = add(root, mul(rh, span * 0.8));
      this.put(m1, add(m1, mul(ax, chord * 0.55)), role, { section: { width: r16(span * 0.4), height: k.T }, face: tang, cut: r16(chord * 0.55) });
      return;
    }
    const n = Math.max(2, Math.round(span / k.W));
    for (let i = 0; i < n; i++) {
      const o = (span / n) * (i + 0.5);
      const c = chord * (1 - (0.55 * i) / Math.max(1, n - 1));
      const p = add(root, mul(rh, o));
      this.member(p, add(p, mul(ax, c)), role, { face: tang });
    }
  }
}

// ---------------------------------------------------------------- results

export type BlockBuild = {
  subject: BlockSubject;
  label: string;
  kind: "figure" | "vehicle" | "castle" | "custom";
  pieces: BlockPiece[];
  panels: Panel[];
  params: Record<string, number>;
  notes: string[];
  stockId: string;
};

/** Lowest point a piece reaches (its centre line less half its cross-section, a disc's radius, a ball's radius). */
export function pieceLowY(p: BlockPiece): number {
  const it = getCatalogItem(p.stock);
  const d = unit(sub(p.b, p.a));
  const lo = Math.min(p.a.y, p.b.y);
  if (it?.shape === "ball") return (p.a.y + p.b.y) / 2 - (it.dims.diameter ?? 1) / 2;
  if (p.round) return (p.a.y + p.b.y) / 2 - (p.round / 2) * Math.sqrt(Math.max(0, 1 - d.y * d.y));
  if (it && (it.formFactor === "dowel" || it.formFactor === "tube" || it.formFactor === "pipe") && !p.section) {
    return lo - ((it.dims.diameter ?? toPrimitive(it).width) / 2) * Math.sqrt(Math.max(0, 1 - d.y * d.y));
  }
  const prim = it ? toPrimitive(it) : { width: 0.25, height: 0.25 };
  const w = p.section?.width ?? prim.width;
  const t = p.section?.height ?? prim.height;
  const f0 = p.face ?? (Math.abs(d.z) < 0.9 ? Z : X);
  const f = unit(sub(f0, mul(d, dot(f0, d))));
  const g = unit(cross(d, f));
  return lo - Math.abs(f.y) * (t / 2) - Math.abs(g.y) * (w / 2);
}

function finish(b: Bench, subject: BlockSubject, label: string, kind: BlockBuild["kind"], params: Record<string, number>, notes: string[], faceViewer = false): BlockBuild {
  // An upright figure is drawn facing +x; turn it to face the viewer (+z) so the 3/4 view shows its front.
  if (faceViewer) {
    const turn = (q: Vec3): Vec3 => v3(-q.z, q.y, q.x);
    for (const p of b.pieces) {
      p.a = turn(p.a);
      p.b = turn(p.b);
      if (p.face) p.face = turn(p.face);
    }
  }
  const ys = [...b.pieces.map(pieceLowY), ...b.panels.map((p) => p.position.y)];
  const lift = ys.length ? -Math.min(...ys) : 0;
  if (Math.abs(lift) > 1e-6) {
    for (const p of b.pieces) {
      p.a = add(p.a, v3(0, lift, 0));
      p.b = add(p.b, v3(0, lift, 0));
    }
    for (const p of b.panels) p.position = { ...p.position, y: p.position.y + lift };
  }
  return { subject, label, kind, pieces: b.pieces, panels: b.panels, params, notes, stockId: b.kit.item.id };
}

// ---------------------------------------------------------------- NECK block

/** S-curve neck from the chest in joined bends; each segment laps onto the next. */
function neckS(b: Bench, base: Vec3, length: number, angles: number[], width: number): { top: Vec3; segs: number } {
  const k = b.kit;
  const segL = length / angles.length;
  let p = base;
  angles.forEach((deg, i) => {
    const dir = v3(Math.cos(rad(deg)), Math.sin(rad(deg)), 0);
    const q = add(p, mul(dir, segL));
    const lapE = Math.min(k.kind === "sheet" ? width / 2 : 0.5, segL * 0.12);
    const z = v3(0, 0, k.kind === "stick" && i % 2 ? k.T : 0);
    const a0 = add(sub(p, mul(dir, i === 0 ? 0 : lapE)), z);
    const a1 = add(add(q, mul(dir, i === angles.length - 1 ? 0 : lapE)), z);
    b.member(a0, a1, "neck", k.kind === "sheet" ? { w: width, face: Z } : { face: Z });
    if (k.kind === "stick") {
      // Two sticks side by side make the neck read at a glance.
      const perp = v3(-dir.y * k.W * 0.9, dir.x * k.W * 0.9, 0);
      b.member(add(a0, perp), add(a1, perp), "neck", { face: Z });
    }
    p = q;
  });
  return { top: p, segs: angles.length };
}

function buildNeck(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  if (s.cutout || blockKit(item).kind === "sheet") return buildNeckCutout(prompt, s, item, typed);
  const b = new Bench(blockKit(item));
  const k = b.kit;
  const notes: string[] = [];
  const wade = s.neck === "wade";
  const quad = s.neck === "quad";
  const H = typed.height ?? (typed.length ? typed.length * (wade ? 1.4 : quad ? 1.2 : 0.9) : k.kind === "lumber" ? 30 : k.kind === "dowel" ? 18 : 10);
  const legL = wade ? H * 0.44 : quad ? H * 0.34 : 0;
  const bodyH0 = wade ? H * 0.15 : quad ? H * 0.2 : H * 0.26;
  const bodyL = wade ? bodyH0 * 2.0 : quad ? bodyH0 * 1.8 : bodyH0 * 3.2;
  const bodyW = Math.max(wade ? bodyH0 * 0.8 : quad ? bodyH0 * 0.9 : bodyH0 * 1.3, k.kind === "stick" ? 4 * k.W : 0);
  const bodyY = legL + bodyH0 / 2;
  const body = b.oval(v3(0, bodyY, 0), bodyL, bodyH0, bodyW, "body");
  /** Half-width of the oval at x (where side parts meet it). */
  const zAt = (x: number) => (body.sz / 2) * Math.sqrt(Math.max(0.15, 1 - (x / (body.sx / 2)) ** 2));
  const top = bodyY + body.sy / 2;
  const front = body.sx / 2;
  const headH = Math.max(H * (quad ? 0.07 : 0.07), k.W * 2);
  const angles = quad ? [64, 76, 84, 74] : wade ? [82, 112, 104, 58] : [76, 110, 120, 56];
  const base = v3(front - (quad ? body.sx * 0.06 : k.kind === "stick" ? k.T : 0), top - body.sy * (quad ? 0.2 : 0.3), 0);
  const rise = angles.reduce((a, d) => a + Math.sin(rad(d)), 0) / angles.length;
  const neckLen = Math.max(0.62 * body.sy, (H - base.y - headH * 0.75) / rise);
  const neck = neckS(b, base, neckLen, angles, 1);
  const headL = headH * (quad ? 2.0 : 1.6);
  const hc = add(neck.top, v3(headL / 2 - Math.min(headL * 0.25, 0.4), headH * 0.2, 0));
  const zH = k.kind === "stick" && angles.length % 2 === 0 ? k.T : 0;
  if (k.kind === "dowel") {
    // A closed frame: top and bottom rails, an upright at the back (on the neck) and one at the front (carries the beak).
    for (const ys of [-1, 1]) b.member(add(hc, v3(-headL / 2, (ys * (headH - k.W)) / 2, 0)), add(hc, v3(headL / 2, (ys * (headH - k.W)) / 2, 0)), "head");
    for (const xs of [-1, 1]) b.member(add(hc, v3((xs * (headL - k.W)) / 2, -headH / 2 + k.W, 0)), add(hc, v3((xs * (headL - k.W)) / 2, headH / 2 - k.W, 0)), "head");
  } else {
    b.member(add(hc, v3(-headL / 2, -k.W / 2, zH)), add(hc, v3(headL / 2, -k.W / 2, zH)), "head", { face: Z });
    b.member(add(hc, v3(-headL / 2, k.W / 2, zH + k.T)), add(hc, v3(headL / 2 - 0.1, k.W / 2, zH + k.T)), "head", { face: Z });
  }
  const beakL = headL * (wade ? 0.9 : quad ? 0.4 : 0.55);
  const beakDeg = s.subject === "flamingo" ? -50 : wade ? -10 : -18;
  const b0 = add(hc, v3(headL / 2 - (k.kind === "dowel" ? k.W / 2 : Math.min(0.3, headL * 0.15)), 0, zH));
  detail(b, b0, add(b0, v3(beakL * Math.cos(rad(beakDeg)), beakL * Math.sin(rad(beakDeg)), 0)), quad ? "muzzle" : "beak", Z);
  if (quad) {
    // Ossicones stand on the head's top, one against each face.
    const oz = k.kind === "stick" ? [zH, zH + 2 * k.T] : k.kind === "dowel" ? [-0.95 * k.W, 0.95 * k.W] : [-k.T / 2 - 0.25, k.T / 2 + 0.25];
    for (const z of oz) {
      const o = v3(hc.x - headL * 0.3, hc.y + (k.kind === "dowel" ? (headH - k.W) / 2 : k.W / 2), z);
      detail(b, o, add(o, v3(-0.1, headH * 0.6 + k.W / 2, 0)), "ossicone");
    }
  }
  // Thin stock: a hip bar across the body bottom carries the legs (lumber is solid there).
  const hipY = legL + (k.kind === "lumber" ? Math.min(body.sy * 0.3, 1) : k.W / 2);
  if ((wade || quad) && k.kind !== "lumber") {
    const xb = wade ? [0] : [front - k.W - body.sx * 0.05, -front + k.W + body.sx * 0.05];
    for (const x of xb) b.member(v3(x, hipY, -zAt(x)), v3(x, hipY, zAt(x)), "hip bar", { face: Y });
  }
  if (wade || quad) {
    const xs = wade ? [0] : [front - k.W - body.sx * 0.05, -front + k.W + body.sx * 0.05];
    for (const x of xs) {
      for (const zs of [-1, 1]) {
        const z = zs * (wade ? Math.max(body.sz * 0.22, k.W) : Math.max(k.W, zAt(x) - k.W / 2));
        const hip = v3(x, hipY + (k.kind === "stick" ? k.T : 0), z);
        if (wade) {
          const knee = v3(x - legL * 0.06, legL * 0.5, z);
          b.member(hip, knee, "leg", { face: Z });
          b.member(knee, v3(x, k.T, z), "leg", { face: Z });
          b.member(v3(x - 0.4, k.T / 2, z), v3(x + Math.max(1.5, legL * 0.12), k.T / 2, z), "foot", { face: Y });
        } else {
          b.member(hip, v3(x, 0, z), "leg", { face: X });
        }
      }
    }
  }
  const tb = k.kind === "dowel" ? v3(-front + k.W / 2, top - k.W / 2, 0) : v3(-front + k.T / 2, top - body.sy * 0.25, 0);
  b.member(tb, add(tb, v3(-body.sx * 0.2, body.sy * (quad ? -0.5 : 0.35), 0)), "tail", { face: Z });
  if (s.neck === "swim") {
    for (const zs of [-1, 1]) {
      const w0 = v3(front * 0.35, top - body.sy * 0.2, zs * (zAt(front * 0.35) + k.T / 2));
      b.member(w0, add(w0, v3(-body.sx * 0.65, body.sy * 0.15, 0)), "wing", { face: Z });
    }
  }
  const headFwd = hc.x - front;
  notes.push(`${s.label} · neck block: an S-curve neck in ${neck.segs} bends lapped and glued at each joint, ${fmt(neckLen)}" long, the head ${fmt(Math.max(0, headFwd))}" forward of the chest.${wade ? " Two thin stilt legs with a backward knee." : quad ? " Four legs under the body." : " It floats on its belly with no legs."}`);
  if (k.kind === "dowel") notes.push("Dowel joints: drill a hole the dowel's size where one dowel meets another (or lash the crossing with thread), then glue.");
  if (wade && /\blawn\b|\byard\b|\bgarden\b/.test(prompt.toLowerCase())) notes.push("Lawn figure: push the stilt feet 2-3\" into the ground, or screw the feet to a scrap board.");
  return finish(b, s, s.label, "figure", { neckSegs: neck.segs, neckLen: r16(neckLen), bodyH: r16(body.sy), headFwd: r16(headFwd), legs: wade ? 2 : quad ? 4 : 0 }, notes);
}

type P2 = [number, number];
function quadPoly(a: P2, b: P2, t: number): P2[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (t / 2), ny = (dx / L) * (t / 2);
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}
function ellipsePoly(cx: number, cy: number, rx: number, ry: number, n = 20): P2[] {
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)] as P2);
}

/** Flat cutout: body, S neck, head, beak and stilt legs in one side profile, standing on a base with foot cleats. */
function buildNeckCutout(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const isSheet = item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard";
  const sheet = isSheet ? item : getCatalogItem("plywood-1-2-4x8")!;
  const b = new Bench(blockKit(sheet));
  const T = b.kit.T;
  const H = typed.height ?? 30;
  const wade = s.neck !== "swim";
  const baseT = T;
  const legL = wade ? H * 0.4 : 0;
  const bodyH = H * (wade ? 0.17 : 0.3);
  const bodyL = bodyH * 2.1;
  const y0 = baseT + legL;
  const parts: P2[][] = [ellipsePoly(0, y0 + bodyH / 2, bodyL / 2, bodyH / 2)];
  const neckW = Math.max(1.25, H * 0.045);
  const angles = wade ? [104, 80, 60, 98] : [110, 86, 62, 100];
  const headH = H * 0.07;
  const startY = y0 + bodyH * 0.7;
  const rise = angles.reduce((a, d) => a + Math.sin(rad(d)), 0) / angles.length;
  const neckLen = (H - startY - headH * 0.6) / rise;
  let p: P2 = [bodyL * 0.36, startY];
  for (const a of angles) {
    const q: P2 = [p[0] + Math.cos(rad(a)) * (neckLen / angles.length), p[1] + Math.sin(rad(a)) * (neckLen / angles.length)];
    parts.push(quadPoly(p, q, neckW));
    parts.push(ellipsePoly(q[0], q[1], neckW / 2, neckW / 2, 10));
    p = q;
  }
  const headL = headH * 1.7;
  const hc: P2 = [p[0] + headL * 0.3, p[1]];
  parts.push(ellipsePoly(hc[0], hc[1], headL / 2, headH / 2));
  const beakL = headL * 1.1;
  const bd = rad(s.subject === "flamingo" ? -50 : -8);
  parts.push([[hc[0] + headL * 0.4, hc[1] + headH * 0.2], [hc[0] + headL * 0.4 + beakL * Math.cos(bd), hc[1] + beakL * Math.sin(bd)], [hc[0] + headL * 0.4, hc[1] - headH * 0.25]]);
  parts.push([[-bodyL / 2 + 0.3, y0 + bodyH * 0.6], [-bodyL / 2 - bodyL * 0.2, y0 + bodyH * 0.8], [-bodyL / 2 + 0.6, y0 + bodyH * 0.25]]);
  const legW = Math.max(1, T * 2);
  const legXs = wade ? [-bodyL * 0.12, bodyL * 0.14] : [];
  for (const x of legXs) {
    const knee: P2 = [x - legL * 0.05, baseT + legL * 0.5];
    parts.push(quadPoly([x, y0 + bodyH * 0.3], knee, legW));
    parts.push(quadPoly(knee, [x, baseT], legW));
    parts.push(ellipsePoly(knee[0], knee[1], legW / 2, legW / 2, 8));
  }
  // A swimmer sits on a flat waterline so the hull stands on its base along a full edge.
  if (!wade) parts.push([[-bodyL * 0.32, baseT], [bodyL * 0.32, baseT], [bodyL * 0.32, baseT + bodyH * 0.3], [-bodyL * 0.32, baseT + bodyH * 0.3]]);
  const outline = unionOutline(parts);
  const minX = Math.min(...outline.map((q) => q[0]));
  const maxX = Math.max(...outline.map((q) => q[0]));
  const minY = Math.min(...outline.map((q) => q[1]));
  const maxY = Math.max(...outline.map((q) => q[1]));
  const r8 = (n: number) => Math.round(n * 8) / 8;
  b.panels.push({
    id: `profile-${s.subject}`,
    type: "upright",
    name: "Body profile",
    position: { x: r8(minX), y: r8(minY), z: -T / 2 },
    size: { width: r8(maxX - minX), height: r8(maxY - minY), depth: T },
    materialId: sheet.id,
    polygon: { plane: "xy", pts: outline.map(([x, y]) => [r16(x - r8(minX)), r16(y - r8(minY))] as P2) },
    cutNote: `Side profile: body, ${angles.length}-bend S neck, head, beak${wade ? " and both stilt legs" : ""} in one piece. Trace the outline and cut it with a jigsaw.`,
  });
  const baseL = r8(Math.max(bodyL * 0.9, 8)), baseW = r8(Math.max(6, H * 0.25));
  b.panels.push({ id: `base-${s.subject}`, type: "bottom", name: "Base", position: { x: r8(-baseL / 2), y: 0, z: r8(-baseW / 2) }, size: { width: baseL, height: baseT, depth: baseW }, materialId: sheet.id });
  const cleatL = r8(Math.max(3, Math.abs(legXs[1] ?? 0) + Math.abs(legXs[0] ?? 0) + 3));
  const cleatH = r8(Math.max(1.5, legL * 0.12));
  for (const zs of [-1, 1]) {
    b.panels.push({ id: `cleat-${zs > 0 ? "front" : "back"}`, type: "cleat", name: "Foot cleat", position: { x: r8((legXs[0] ?? 0) - 1.5), y: baseT, z: zs > 0 ? T / 2 : -T / 2 - T }, size: { width: cleatL, height: cleatH, depth: T }, materialId: sheet.id });
  }
  const headFwd = hc[0] - bodyL / 2;
  return finish(b, s, `${s.label} cutout`, "figure", { neckSegs: angles.length, neckLen: r16(neckLen), bodyH: r16(bodyH), headFwd: r16(headFwd), legs: wade ? 2 : 0, cutout: 1 }, [
    `${s.label} cutout · neck block as a flat profile: body, an S neck in ${angles.length} bends, the head forward of the chest, beak${wade ? ", two thin stilt legs" : ""}, all one piece of ${sheet.name}.`,
    `It stands on a ${fmt(baseL)}" x ${fmt(baseW)}" base; a foot cleat on each face screws to the base and through the legs.`,
  ]);
}

/** Small details (beak, tufts, feet): the kit stock, or a 1/2" dowel offcut when the kit is chunky lumber. */
function detail(b: Bench, a: Vec3, c: Vec3, role: string, face?: Vec3) {
  if (b.kit.kind === "lumber") b.member(a, c, role, { stock: "dowel-1-2-36", face });
  else b.member(a, c, role, face ? { face } : {});
}

// ---------------------------------------------------------------- WHEELS block

const SPIN_GAP = 0.1875;

/** Wheels on axles: an axle block (the bearing), a dowel axle through it, and a round wheel on each end with a spin gap. */
function wheelSet(b: Bench, xs: number[], halfZ: number, d: number, axleStock: string) {
  const k = b.kit;
  const ax = getCatalogItem(axleStock)!;
  const axD = ax.dims.diameter ?? 0.25;
  const yA = d / 2;
  const blockH = k.kind === "sheet" ? Math.max(2 * k.T, axD + 0.5) : k.kind === "lumber" ? k.T * Math.max(1, Math.ceil((axD + 0.4) / k.T)) : axD + 0.4;
  const wheelT = k.kind === "lumber" || k.kind === "sheet" ? k.T : 0.5;
  for (const x of xs) {
    const blockL = k.kind === "lumber" ? k.W : Math.max(1.5, axD * 4);
    b.block(v3(x, yA, 0), blockL, blockH, 2 * halfZ, "axle block", { run: "z", widthAxis: "x", solid: true });
    const zOut = halfZ + SPIN_GAP + wheelT + 0.25;
    b.member(v3(x, yA, -zOut), v3(x, yA, zOut), "axle", { stock: axleStock });
    for (const zs of [-1, 1]) b.disc(v3(x, yA, zs * (halfZ + SPIN_GAP + wheelT / 2)), Z, d, "wheel");
  }
  return { yTop: yA + blockH / 2, blockH, wheelT, axD };
}

function buildWheels(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const b = new Bench(blockKit(item));
  const k = b.kit;
  const veh = s.vehicle ?? "car";
  const notes: string[] = [];
  const lumber = k.kind === "lumber";
  const sheet = k.kind === "sheet";
  const L = typed.length ?? (veh === "wagon" ? 30 : veh === "bus" ? 14 : veh === "train" ? 12 : lumber ? 12 : 10);
  const width = lumber ? k.W : veh === "wagon" ? L * 0.5 : L * 0.36;
  const halfZ = width / 2;
  const wheelD = lumber ? Math.min(k.W - 0.25, L * 0.22) : veh === "wagon" ? Math.max(5, L * 0.24) : L * 0.22;
  const axleStock = wheelD > 4 || sheet ? "dowel-1-2-36" : "dowel-1-4-36";
  const axleXs = veh === "train" ? [L * 0.32, 0, -L * 0.32] : [L / 2 - wheelD * 0.75, -L / 2 + wheelD * 0.75];
  const ws = wheelSet(b, axleXs, halfZ, wheelD, axleStock);
  const deckT = lumber || sheet ? k.T : Math.max(k.T * 2, 0.2);
  const deck = b.block(v3(0, ws.yTop + deckT / 2, 0), L, deckT, width, "chassis", { run: "x", widthAxis: "z", solid: true });
  const deckTop = ws.yTop + deck.sy;
  if (veh === "truck" || veh === "tractor") {
    const cabL = L * (veh === "tractor" ? 0.35 : 0.3);
    const cabH = L * (veh === "tractor" ? 0.35 : 0.28);
    const cabX = veh === "tractor" ? -L / 2 + cabL / 2 + L * 0.1 : L / 2 - cabL / 2;
    const cab = b.block(v3(cabX, deckTop + cabH / 2, 0), cabL, cabH, width, "cab", { run: "z", widthAxis: "x" });
    if (veh === "truck") {
      const bedL = L - cab.sx;
      const sideH = lumber ? k.W : L * 0.12;
      const sideT = k.T;
      const x0 = -L / 2, x1 = -L / 2 + bedL;
      for (const zs of [-1, 1]) {
        const z = zs * (halfZ - sideT / 2);
        b.put(v3(x0 + sideT, deckTop + sideH / 2, z), v3(x1, deckTop + sideH / 2, z), "bed side", { section: { width: r16(sideH), height: sideT }, face: Z, cut: r16(x1 - x0 - sideT) });
      }
      b.put(v3(x0 + sideT / 2, deckTop + sideH / 2, -halfZ), v3(x0 + sideT / 2, deckTop + sideH / 2, halfZ), "tailgate", { section: { width: r16(sideH), height: sideT }, face: X, cut: r16(width) });
    } else {
      const hoodL = L - cab.sx - L * 0.1;
      b.block(v3(L / 2 - hoodL / 2, deckTop + cabH * 0.3, 0), hoodL, cabH * 0.6, width, "hood", { run: "x", widthAxis: "z" });
    }
  } else if (veh === "bus") {
    const H = L * 0.36;
    const hoodL = L * 0.16;
    const bodyL = L - hoodL;
    b.block(v3(-L / 2 + bodyL / 2, deckTop + H / 2, 0), bodyL, H, width, "body", { run: "x", widthAxis: "z" });
    b.block(v3(L / 2 - hoodL / 2, deckTop + H * 0.22, 0), hoodL, H * 0.44, width, "hood", { run: "x", widthAxis: "z" });
    notes.push("A long box body with a short hood in front, school-bus style. Paint the windows and door on.");
  } else if (veh === "car") {
    const bodyH = L * 0.14;
    const body = b.block(v3(0, deckTop + bodyH / 2, 0), L, bodyH, width, "body", { run: "x", widthAxis: "z" });
    b.block(v3(-L * 0.05, deckTop + body.sy + bodyH * 0.6, 0), L * 0.4, bodyH * 1.2, width, "cabin", { run: "z", widthAxis: "x" });
  } else if (veh === "train") {
    const boilerL = L * 0.55;
    const bx0 = L / 2 - boilerL;
    let boilerD: number;
    if (lumber) {
      boilerD = getCatalogItem("closet-rod")?.dims.diameter ?? 1.25;
      b.put(v3(bx0, deckTop + boilerD / 2, 0), v3(L / 2, deckTop + boilerD / 2, 0), "boiler", { stock: "closet-rod", cut: r16(boilerL) });
      b.put(v3(L / 2 - boilerL * 0.3, deckTop + boilerD - 0.15, 0), v3(L / 2 - boilerL * 0.3, deckTop + boilerD + L * 0.14, 0), "smokestack", { stock: "closet-rod", cut: r16(L * 0.14 + 0.15) });
      notes.push("Boiler and smokestack: 1-1/4\" closet rod (or a 1-1/4\" dowel offcut). Plane a flat along the boiler so it sits on the chassis; cup the stack's foot to the boiler with a rasp; glue both.");
    } else {
      boilerD = width * 0.75;
      b.tube(v3(bx0, deckTop + boilerD / 2, 0), X, boilerD, boilerL, "boiler");
      b.tube(v3(L / 2 - boilerL * 0.3, deckTop + boilerD - 0.2, 0), Y, boilerD * 0.4, L * 0.14, "smokestack");
    }
    const cabL = L - boilerL;
    const cabH = Math.max(L * 0.33, boilerD + 1.5);
    b.block(v3(-L / 2 + cabL / 2, deckTop + cabH / 2, 0), cabL, cabH, width, "cab", { run: "z", widthAxis: "x" });
  } else if (veh === "wagon") {
    const bedH = Math.max(4, L * 0.18);
    b.block(v3(0, deckTop + bedH / 2, 0), L, bedH, width, "bed", { open: "top" });
    const brW = Math.max(2, width * 0.2);
    b.block(v3(L / 2 + 0.75, ws.yTop + deck.sy / 2, 0), 1.5, deck.sy, brW, "handle bracket", { run: "z", solid: true });
    const pivot = v3(L / 2 + 0.75, ws.yTop + deck.sy / 2, 0);
    const hl = Math.min(34, Math.max(18, L * 0.9));
    const up = rad(35);
    const tip = add(pivot, v3(hl * Math.cos(up), hl * Math.sin(up), 0));
    const hStock = sheet || k.kind === "stick" ? "dowel-1-2-36" : undefined;
    b.member(pivot, tip, "handle", hStock ? { stock: hStock } : {});
    b.member(add(tip, v3(0, 0, -3)), add(tip, v3(0, 0, 3)), "handle grip", { stock: "dowel-1-2-36" });
    notes.push("The handle pivots on a 1/4\" bolt through the bracket (nut and washer under it) so it swings up and down. It carries toys, not a rider.");
  }
  const holeTxt = axleStock === "dowel-1-2-36" ? "9/16\"" : "9/32\"";
  notes.unshift(`${s.label} · wheels block: ${axleXs.length * 2} round wheels ${fmt(wheelD)}" across, glued onto ${axleXs.length} ${axleStock === "dowel-1-2-36" ? "1/2\"" : "1/4\""} dowel axles. Each axle turns in a ${holeTxt} hole drilled through its axle block; the wheels sit ${fmt(SPIN_GAP)}" off the body and are the only parts on the ground.`);
  notes.push(`Cut the wheels round with ${wheelD <= 3.5 ? `a ${fmt(wheelD)}" hole saw (its pilot hole is the axle hole)` : "a jigsaw, then drill the axle hole at the centre"}, and sand the rims.`);
  return finish(b, s, s.label, "vehicle", { wheels: axleXs.length * 2, axles: axleXs.length, wheelD: r16(wheelD), spinGap: SPIN_GAP, length: r16(L) }, notes);
}

// ---------------------------------------------------------------- TUBE block

function buildTube(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const b = new Bench(blockKit(item));
  const k = b.kit;
  const lower = prompt.toLowerCase();
  const kid = /\bkids?\b[^.]{0,24}\b(?:fits?|sits?|inside|in it|climbs?)\b|\bplayhouse\b|\bride[- ]?in\b|\bsit inside\b/.test(lower);
  const notes: string[] = [];
  const T = k.T;
  if (s.tube === "submarine") {
    const L = typed.length ?? (k.kind === "sheet" ? 48 : 12);
    const d = kid ? Math.max(20, L * 0.4) : L * 0.33;
    const noseL = d * 0.55, tailL = d * 0.8;
    const tubeL = L - noseL - tailL;
    const Rc = d / 2 - T / 2;
    const finSpan = Math.max(0.22 * d, 1);
    const cradleH = finSpan + 0.75;
    const yA = cradleH + d / 2;
    const x0 = -L / 2 + tailL;
    const door = kid ? { from: tubeL * 0.3, to: tubeL * 0.3 + Math.min(18, tubeL * 0.45), dir: Z, arc: rad(80) } : undefined;
    b.tube(v3(x0, yA, 0), X, d, tubeL, "hull", door ? { door } : {});
    b.nose(v3(x0 + tubeL, yA, 0), X, d, noseL, "nose", "round");
    b.nose(v3(x0, yA, 0), v3(-1, 0, 0), d, tailL, "tail", "point");
    const [u, v] = basis(X);
    const r0 = Rc * 0.45 - T / 2;
    const span = d / 2 - r0 + finSpan;
    for (const rh of [u, mul(u, -1), v, mul(v, -1)]) b.fin(add(v3(x0 - tailL * 0.55, yA, 0), mul(rh, r0)), X, rh, span, tailL * 0.4, "tail fin");
    const twL = Math.max(L * 0.18, 4), twH = d * 0.4, twW = d * 0.32;
    const tw = b.block(v3(x0 + tubeL * 0.62, yA + d / 2 + twH / 2 - T, 0), twL, twH, twW, "tower");
    const pz = v3(x0 + tubeL * 0.62 + twL * 0.25, yA + d / 2 + tw.sy - T, 0);
    b.member(sub(pz, v3(0, 0.5, 0)), add(pz, v3(0, d * 0.3, 0)), "periscope", k.kind === "sheet" ? { w: 1.5 } : {});
    b.member(add(pz, v3(-0.4, d * 0.3 - 0.5, 0)), add(pz, v3(2, d * 0.3 - 0.5, 0)), "periscope", k.kind === "sheet" ? { w: 1.5 } : {});
    for (const x of [x0 + tubeL * 0.2, x0 + tubeL * 0.8]) b.block(v3(x, (cradleH + d * 0.08) / 2, 0), k.kind === "sheet" ? 3 * T : 3, cradleH + d * 0.08, d * 0.7, "cradle", { run: "z", solid: true, widthAxis: "y" });
    notes.push(`Submarine · tube block laid level: a ${fmt(d)}" hull, ${fmt(L)}" long overall, with a rounded nose, a cross-shaped tail of four fins, and a conning tower with a periscope on top.${kid ? ` A ${fmt(door!.to - door!.from)}" hatch in the side lets a kid climb in (${fmt(d - 2 * T)}" inside).` : ""} Two saddles hold it level.`);
    if (k.kind === "sheet") notes.push("Score one long strip at each stave line and roll it into the hull (or tape the staves edge to edge inside and out), then tape the nose and tail gores to the hull ends.");
    return finish(b, s, s.label, "custom", { tubeD: r16(d), length: r16(L), inside: r16(d - 2 * T), fins: 4, crossTail: 1, tower: 1, horizontal: 1, door: kid ? 1 : 0 }, notes);
  }
  const H = typed.height ?? (k.kind === "sheet" ? 36 : 14);
  const nFins = /\b(?:three|3)\s+fins/.test(lower) ? 3 : 4;
  const finOut = (dd: number) => Math.max(0.3 * dd, 2);
  // A typed width is the rocket's width across the fins: solve the body diameter for it.
  const across = (dd: number) => 2 * Math.max(dd / 2, ...Array.from({ length: nFins }, (_, i) => Math.abs(Math.cos((2 * Math.PI * (i + 0.5)) / nFins)) * (dd / 2 + finOut(dd))));
  let d = kid ? Math.max(20, H * 0.5) : H * 0.22;
  if (typed.width && !kid) for (let i = 0; i < 6; i++) d *= typed.width / across(d);
  const noseL = Math.min(H * 0.32, d * 0.9);
  const finSpan = finOut(d);
  const finChord = Math.min(H * 0.3, d * 0.6);
  const tubeL = H - noseL;
  const door = kid ? { from: 2, to: Math.min(tubeL - 2.5, 2 + Math.max(18, tubeL * 0.6)), dir: X, arc: rad(80) } : undefined;
  b.tube(v3(0, 0, 0), Y, d, tubeL, "body", door ? { door } : {});
  b.nose(v3(0, tubeL, 0), Y, d, noseL, "nose cone", "point");
  const [u, v] = basis(Y);
  for (let i = 0; i < nFins; i++) {
    const th = (2 * Math.PI * (i + 0.5)) / nFins;
    const rh = add(mul(u, Math.cos(th)), mul(v, Math.sin(th)));
    b.fin(mul(rh, d / 2 - T), Y, rh, finSpan, finChord, "fin");
  }
  if (kid) b.disc(v3(0, T / 2, 0), Y, d - 2 * T, "floor");
  notes.push(`Rocket · tube block: a ${fmt(d)}" body ${fmt(tubeL)}" tall, a pointed nose cone ${fmt(noseL)}" tall, and ${nFins} fins around the base reaching ${fmt(finSpan)}" out. ${fmt(H)}" tall overall.${kid ? ` A kid fits inside: ${fmt(d - 2 * T)}" across inside, a ${fmt(door!.to - door!.from)}" tall door that folds open, and a floor.` : ""}`);
  if (k.kind === "sheet") notes.push("Score one long strip at each stave line and roll it into the body (or tape the staves edge to edge inside and out), tape the nose gores to a point, and tape each fin to the body on both faces.");
  return finish(b, s, s.label, "custom", { tubeD: r16(d), height: r16(H), inside: r16(d - 2 * T), fins: nFins, finSpan: r16(finSpan), noseL: r16(noseL), door: kid ? 1 : 0, doorH: kid ? r16(door!.to - door!.from) : 0 }, notes);
}

// ---------------------------------------------------------------- PERCHED body block

function buildPerched(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const b = new Bench(blockKit(item));
  const k = b.kit;
  const lower = prompt.toLowerCase();
  const bookend = /\bbook\s*-?\s*ends?\b/.test(lower);
  const owl = s.perched === "owl";
  const lumber = k.kind === "lumber";
  const H = typed.height ?? (lumber ? (owl ? 9 : 11) : 7);
  const baseT = lumber || k.kind === "sheet" ? k.T : Math.max(2 * k.T, 0.15);
  const bodyH = H - baseT;
  const bodyD = lumber ? 2 * k.T : bodyH * 0.45;
  const bodyW = lumber ? k.W : bodyH * (owl ? 0.6 : 0.5);
  const behind = bookend ? Math.max(4.5, bodyD * 1.3) : 0.5;
  const ahead = owl ? 0.5 : 2;
  const baseL = bodyD + behind + ahead;
  const base = b.block(v3(bodyD / 2 + ahead - baseL / 2, baseT / 2, 0), baseL, baseT, bodyW, "base", { run: "x", widthAxis: "z", solid: true });
  const body = b.block(v3(0, base.sy + bodyH / 2, 0), bodyD, bodyH, bodyW, "body", { run: "y", widthAxis: "z" });
  const yTop = base.sy + body.sy;
  const front = body.sx / 2;
  const faceT = lumber || k.kind === "sheet" ? k.T : k.T * 2;
  const faceD = Math.min(body.sz * (owl ? 1.0 : 0.8), body.sy * (owl ? 0.45 : 0.32));
  const faceY = yTop - faceD / 2 - body.sy * (owl ? 0.05 : 0.08);
  const fd = b.disc(v3(front + faceT / 2, faceY, 0), X, faceD, "face disc");
  const bk = v3(front + faceT * 0.8, faceY - fd * 0.12, 0);
  detail(b, bk, add(bk, v3(Math.max(0.6, fd * 0.22), -Math.max(0.4, fd * 0.15), 0)), "beak", Z);
  if (owl) {
    for (const zs of [-1, 1]) {
      const p = v3(0, yTop - 0.4, zs * (body.sz / 2 - 0.5));
      detail(b, p, add(p, v3(0, Math.max(1.25, body.sy * 0.14), zs * Math.max(0.5, body.sz * 0.12))), "ear tuft", X);
    }
    for (const zs of [-1, 1]) {
      const w = v3(-body.sx * 0.05, base.sy + body.sy * 0.5, zs * (body.sz / 2 + k.T / 2));
      b.member(add(w, v3(0, body.sy * 0.25, 0)), add(w, v3(-body.sx * 0.1, -body.sy * 0.25, 0)), "wing", { face: Z });
    }
  } else {
    for (const zs of [-1, 1]) {
      const sh = v3(0, base.sy + body.sy * 0.7, zs * (body.sz / 2 + k.T / 2));
      b.member(sh, add(sh, v3(0.2, -body.sy * 0.4, 0)), "flipper", { face: Z });
    }
    for (const zs of [-1, 1]) {
      const f = v3(front, base.sy + 0.25, zs * body.sz * 0.25);
      detail(b, sub(f, v3(0.5, 0, 0)), add(f, v3(Math.max(1.25, ahead * 0.8), 0, 0)), "foot", Y);
    }
  }
  const notesOut = [
    `${s.label} · perched block: an upright body with a ${fmt(fd)}" face disc on the front${owl ? ", ear tufts on the top corners and a wing on each side" : ", a flipper on each side and two feet, no ear tufts"}, standing on a flat base with no legs. Paint the eyes on the disc.`,
  ];
  if (bookend) notesOut.push(`Bookend: books lean on the flat back (${fmt(body.sy)}" tall) and stand on the ${fmt(behind)}" of base behind it, so their weight holds it in place.`);
  if (lumber) notesOut.push("Beak and small details: 1/2\" dowel offcuts glued into 1/2\" holes.");
  return finish(b, s, bookend ? `${s.label} bookend` : s.label, "figure", { faceD: r16(fd), backH: r16(body.sy), baseBehind: r16(behind), bookend: bookend ? 1 : 0, earTufts: owl ? 2 : 0 }, notesOut, true);
}

// ---------------------------------------------------------------- FIGURE block

function buildFigure(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const kit0 = blockKit(item);
  const limbStock = s.figure === "ball" && kit0.kind !== "dowel" ? getCatalogItem("dowel-1-4-36")! : item;
  const b = new Bench(blockKit(limbStock));
  const k = b.kit;
  const out: string[] = [];
  if (s.figure === "ball") {
    const H = typed.height ?? 12;
    const ball = getCatalogItem("wood-ball-1")!;
    const headBall = getCatalogItem("wood-ball-1-1-2")!;
    const bd = ball.dims.diameter ?? 1;
    const hd = headBall.dims.diameter ?? 1.5;
    const putBall = (c: Vec3, role: string, it = ball) => {
      const r = (it.dims.diameter ?? 1) / 2;
      b.put(sub(c, v3(0, r, 0)), add(c, v3(0, r, 0)), role, { stock: it.id });
    };
    const limb = (p: Vec3, q: Vec3, role: string) => {
      const dd = unit(sub(q, p));
      b.member(add(p, mul(dd, bd / 2 - 0.15)), sub(q, mul(dd, bd / 2 - 0.15)), role);
    };
    const legH = H * 0.45, torsoH = H * 0.28;
    const hipY = legH, shY = legH + torsoH;
    const hipZ = Math.max(bd * 0.75, H * 0.06), shZ = Math.max(bd * 1.25, H * 0.11);
    for (const zs of [-1, 1]) b.member(v3(0, hipY, zs * hipZ * 0.4), v3(0, shY, zs * hipZ * 0.4), "torso");
    b.member(v3(0, shY, -shZ + bd / 2 - 0.15), v3(0, shY, shZ - bd / 2 + 0.15), "shoulder bar");
    b.member(v3(0, hipY, -hipZ + bd / 2 - 0.15), v3(0, hipY, hipZ - bd / 2 + 0.15), "hip bar");
    const neckTop = shY + H * 0.05;
    b.member(v3(0, shY, 0), v3(0, neckTop + 0.2, 0), "neck");
    putBall(v3(0, neckTop + hd / 2, 0), "head", headBall);
    let pivots = 0;
    for (const zs of [-1, 1]) {
      const sh = v3(0, shY, zs * shZ);
      const el = v3(H * 0.03, shY - H * 0.16, zs * (shZ + H * 0.02));
      const hand = v3(H * 0.08, shY - H * 0.3, zs * (shZ + H * 0.03));
      putBall(sh, "shoulder joint");
      putBall(el, "elbow joint");
      putBall(hand, "hand");
      limb(sh, el, "upper arm");
      limb(el, hand, "forearm");
      const hp = v3(0, hipY, zs * hipZ);
      const kn = v3(H * 0.02, hipY - legH * 0.48, zs * hipZ);
      const ft = v3(0, bd / 2, zs * hipZ);
      putBall(hp, "hip joint");
      putBall(kn, "knee joint");
      putBall(ft, "foot");
      limb(hp, kn, "thigh");
      limb(kn, ft, "shin");
      pivots += 4;
    }
    out.push(`Poseable robot · figure block: ${pivots} pivot joints. Shoulders, elbows, hips and knees are 1" wood balls, and the head is a 1-1/2" ball.`);
    out.push("Pivot joints: drill each joint ball 1/4\" x 3/8\" deep where a limb dowel meets it. Glue one end of each limb; leave the other end a snug dry fit that turns, so the figure holds a pose. Pin the foot balls to a scrap base to stand it up.");
    return finish(b, s, "Poseable robot", "figure", { ballJoints: pivots, arms: 2, legs: 2, height: r16(H) }, out, true);
  }
  const H = typed.height ?? (k.kind === "lumber" ? 18 : 10);
  const lumber = k.kind === "lumber";
  const legGap = lumber ? Math.max(1, k.T * 0.75) : H * 0.06;
  const legT = lumber ? k.T : H * 0.09;
  const depth = lumber ? k.W : H * 0.2;
  const hipT = lumber ? k.T : H * 0.06;
  const torsoH = H * 0.32, headH = H * 0.17;
  const legH = H - hipT - torsoH - headH;
  for (const zs of [-1, 1]) {
    const z = zs * (legGap / 2 + legT / 2);
    if (lumber) b.put(v3(0, 0, z), v3(0, legH, z), "leg", { section: { width: k.W, height: k.T }, face: Z, cut: r16(legH) });
    else b.block(v3(0, legH / 2, z), depth, legH, legT, "leg", { run: "y" });
  }
  const hipW = legGap + 2 * legT;
  if (lumber) b.put(v3(0, legH + hipT / 2, -hipW / 2), v3(0, legH + hipT / 2, hipW / 2), "hips", { section: { width: k.W, height: k.T }, face: Y, cut: r16(hipW) });
  else b.block(v3(0, legH + hipT / 2, 0), depth, hipT, hipW, "hips", { run: "z" });
  const torsoW = lumber ? k.T * Math.max(3, Math.round((hipW + k.T) / k.T)) : hipW * 1.3;
  const torso = b.block(v3(0, legH + hipT + torsoH / 2, 0), depth, torsoH, torsoW, "torso", { run: "y", widthAxis: "x" });
  const armL = torso.sy * 0.95 + legH * 0.15;
  for (const zs of [-1, 1]) {
    const z = zs * (torso.sz / 2 + legT / 2);
    const top = legH + hipT + torso.sy - 0.25;
    if (lumber) b.put(v3(0, top - armL, z), v3(0, top, z), "arm", { section: { width: k.W, height: k.T }, face: Z, cut: r16(armL) });
    else b.block(v3(0, top - armL / 2, z), depth * 0.8, armL, legT, "arm", { run: "y" });
  }
  b.block(v3(0, legH + hipT + torso.sy + headH / 2, 0), depth, headH, torso.sz * 0.75, "head", { run: "z", widthAxis: "x" });
  out.push(`Robot · figure block: two legs with a ${fmt(legGap)}" gap, a hip bar across them, a torso, an arm on each side and a head${lumber ? ", each piece a whole 2x4 face glued and screwed to the next" : ""}.`);
  return finish(b, s, s.label, "figure", { arms: 2, legs: 2, legGap: r16(legGap), height: r16(H) }, out, true);
}

// ---------------------------------------------------------------- TOWERS block (castle)

function buildCastle(prompt: string, s: BlockSubject, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild {
  const b = new Bench(blockKit(item));
  const k = b.kit;
  const lower = prompt.toLowerCase();
  const sheet = k.kind === "sheet";
  const S = typed.length ?? (sheet ? 24 : 10);
  const towerD = S * 0.28;
  const towerH = typed.height ?? S * 0.75;
  const wallH = towerH * 0.62;
  const nT = /\b(?:two|2)\s+towers/.test(lower) ? 2 : 4;
  const h = S / 2 - towerD / 2;
  const corners = nT === 4 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
  for (const [cx, cz] of corners) {
    b.tube(v3(cx * h, 0, cz * h), Y, towerD, towerH, "tower");
    b.nose(v3(cx * h, towerH - 0.25, cz * h), Y, towerD, towerD * 0.9, "tower roof", "point");
  }
  const T = k.T;
  const run = 2 * h - towerD + 0.4;
  const gateW = S * 0.3, gateH = wallH * 0.6;
  const wall = (c: Vec3, along: Vec3, Lw: number, Hw: number, role: string) => {
    const n = unit(cross(along, Y));
    if (sheet || k.kind === "lumber") b.put(sub(c, mul(along, Lw / 2)), add(c, mul(along, Lw / 2)), role, { section: { width: r16(Hw), height: T }, face: n, cut: r16(Lw) });
    else {
      const cnt = Math.max(2, Math.round(Lw / k.W));
      for (let i = 0; i < cnt; i++) {
        const p = add(c, mul(along, -Lw / 2 + (Lw / cnt) * (i + 0.5)));
        b.member(sub(p, v3(0, Hw / 2, 0)), add(p, v3(0, Hw / 2, 0)), role, { face: n });
      }
    }
  };
  if (nT === 4) {
    wall(v3(-h, wallH / 2, 0), Z, run, wallH, "wall");
    wall(v3(0, wallH / 2, h), X, run, wallH, "wall");
    wall(v3(0, wallH / 2, -h), X, run, wallH, "wall");
  }
  const sideL = (run - gateW) / 2;
  for (const zs of [-1, 1]) wall(v3(h, wallH / 2, zs * (gateW / 2 + sideL / 2)), Z, sideL, wallH, "wall");
  wall(v3(h, gateH + (wallH - gateH) / 2, 0), Z, gateW + 0.4, wallH - gateH, "gate lintel");
  const dbL = gateH * 0.95;
  const dbW = gateW + 0.3;
  if (sheet || k.kind === "lumber") b.put(v3(h, T / 2, 0), v3(h + dbL, T / 2, 0), "drawbridge", { section: { width: r16(dbW), height: T }, face: Y, cut: r16(dbL) });
  else {
    const cnt = Math.max(2, Math.round(dbW / k.W));
    for (let i = 0; i < cnt; i++) {
      const z = -dbW / 2 + (dbW / cnt) * (i + 0.5);
      b.member(v3(h, T / 2, z), v3(h + dbL, T / 2, z), "drawbridge", { face: Y });
    }
  }
  const merl = Math.max(1.5, S * 0.06);
  const tops: [Vec3, Vec3, number][] = nT === 4 ? [[v3(-h, wallH, 0), Z, run], [v3(0, wallH, h), X, run], [v3(0, wallH, -h), X, run]] : [];
  for (const [c, along, Lw] of tops) {
    const m = Math.max(2, Math.floor(Lw / (merl * 2)));
    const n = unit(cross(along, Y));
    for (let i = 0; i < m; i++) {
      const p = add(add(c, mul(along, -Lw / 2 + merl / 2 + (Lw - merl) * (i / Math.max(1, m - 1)))), v3(0, merl / 2 - 0.4, 0));
      if (sheet || k.kind === "lumber") b.put(sub(p, mul(along, merl / 2)), add(p, mul(along, merl / 2)), "battlement", { section: { width: r16(merl), height: T }, face: n, cut: r16(merl) });
      else b.member(sub(p, v3(0, merl / 2, 0)), add(p, v3(0, merl / 2, 0)), "battlement", { face: n });
    }
  }
  const out = [`Castle · towers block: ${nT} round towers ${fmt(towerD)}" across with pointed roofs, walls between them with battlements, a ${fmt(gateW)}" gate and a drawbridge that lets down on two strings.`];
  if (sheet) out.push(`All cut from ${k.item.name}: score the tower staves and roll them round, tape the roof gores to a point, and slot the walls into the towers.`);
  return finish(b, s, s.label, "castle", { towers: nT, drawbridge: 1, gateW: r16(gateW), towerD: r16(towerD) }, out);
}

// ---------------------------------------------------------------- entry

export function buildBlocks(prompt: string, item: CatalogItem, typed: { length?: number; height?: number; width?: number }): BlockBuild | null {
  const s = detectBlockSubject(prompt);
  if (!s) return null;
  if (s.blocks.includes("towers")) return buildCastle(prompt, s, item, typed);
  if (s.neck) return buildNeck(prompt, s, item, typed);
  if (s.vehicle) return buildWheels(prompt, s, item, typed);
  if (s.tube) return buildTube(prompt, s, item, typed);
  if (s.perched) return buildPerched(prompt, s, item, typed);
  if (s.figure) return buildFigure(prompt, s, item, typed);
  return null;
}

/** Axis-aligned bounds of a block build (pieces with their cross-sections, plus panels). */
export function pieceBounds(b: BlockBuild): { min: Vec3; max: Vec3 } {
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  const grow = (p: Vec3) => {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  };
  for (const p of b.pieces) {
    const h = pieceHalf(p);
    for (const q of [p.a, p.b]) {
      grow(sub(q, h));
      grow(add(q, h));
    }
  }
  for (const p of b.panels) {
    grow(p.position);
    grow(add(p.position, v3(p.size.width, p.size.height, p.size.depth)));
  }
  return { min, max };
}

/** Half-extent along x, y, z of a piece's cross-section about its centre line. */
function pieceHalf(p: BlockPiece): Vec3 {
  const it = getCatalogItem(p.stock);
  const d = unit(sub(p.b, p.a));
  if (it?.shape === "ball") {
    const r = (it.dims.diameter ?? 1) / 2;
    const l = len(sub(p.b, p.a)) / 2;
    return v3(r, Math.max(0, r - l), r);
  }
  if (p.round) {
    const r = p.round / 2;
    return v3(r * Math.sqrt(Math.max(0, 1 - d.x * d.x)), r * Math.sqrt(Math.max(0, 1 - d.y * d.y)), r * Math.sqrt(Math.max(0, 1 - d.z * d.z)));
  }
  const prim = it ? toPrimitive(it) : { width: 0.25, height: 0.25 };
  const w = p.section?.width ?? prim.width;
  const t = p.section?.height ?? prim.height;
  const f0 = p.face ?? (Math.abs(d.z) < 0.9 ? Z : X);
  const f = unit(sub(f0, mul(d, dot(f0, d))));
  const g = unit(cross(d, f));
  return v3(Math.abs(f.x) * t / 2 + Math.abs(g.x) * w / 2, Math.abs(f.y) * t / 2 + Math.abs(g.y) * w / 2, Math.abs(f.z) * t / 2 + Math.abs(g.z) * w / 2);
}

/** Drop sizes that name the stock ("from 1/4 inch dowels", "3/4 in plywood") so only the build's own size is read. */
export function stripStockSizes(prompt: string): string {
  return prompt.replace(/\b\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?\s*-?\s*(?:in|inch|inches|")?\s*(?:dowels?|plywood|ply|boards?|sticks?|rods?|pipes?|lumber|mdf|skewers?|wood[\s-]*balls?|balls?)\b/gi, " ");
}
