/**
 * General form builders (house, figure, vehicle, etc.)
 */
import type { FormOp, Size3 } from "./formTypes";
import { classifyAnatomy } from "./anatomy";
import { bridgeOps } from "./formBuildersCore";

function taper(y0: number, y1: number, r0: number, r1: number, sides = 8, role = "leg"): FormOp {
  return { op: "taper", y0, y1, r0, r1, sides, role };
}

function shellOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.depth) / 2;
  return [{ op: "shell", y0: 0, y1: s.height, r, profile: "hemisphere", role: "ring" }];
}

export function houseOps(s: Size3): FormOp[] {
  const w = s.width;
  const h = s.height * 0.62;
  const d = s.depth;
  return [
    { op: "box", x: 0, y: h / 2, z: 0, w, h, d, role: "leg" },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: -w / 2, y: h, z: 0 },
        { x: 0, y: s.height, z: 0 },
        { x: w / 2, y: h, z: 0 },
      ],
    },
    { op: "arch", x0: -w * 0.12, z0: d / 2, x1: w * 0.12, z1: d / 2, y0: 0, crown: h * 0.45, role: "support" },
  ];
}

export function wallOps(s: Size3): FormOp[] {
  const ops: FormOp[] = [];
  const posts = Math.max(3, Math.round(s.width / 8));
  for (let i = 0; i < posts; i++) {
    const x = (i / (posts - 1 || 1)) * s.width;
    ops.push({ op: "column", x, z: 0, y0: 0, y1: s.height, role: "leg" });
  }
  ops.push({
    op: "poly",
    role: "rail",
    points: [
      { x: 0, y: s.height * 0.7, z: 0 },
      { x: s.width, y: s.height * 0.7, z: 0 },
    ],
  });
  return ops;
}

export function domeOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.height) / 2;
  return [{ op: "dome", y0: 0, r, role: "ring" }, { op: "ring", y: 0, rx: r, n: 12, role: "base" }];
}

/**
 * Garden / gateway arch: a walk-through portal.
 * Four posts, two crowns, side rails only — never an X across the opening.
 * Shop-length pipe: each member is one piece, not a lattice.
 */
export function archOps(s: Size3): FormOp[] {
  const H = Math.max(s.height, 12);
  const W = Math.max(s.width, H * 0.5, 18);
  const D = Math.min(Math.max(s.depth, 10), Math.max(12, H * 0.22));
  const x0 = -W / 2;
  const x1 = W / 2;
  const z0 = -D / 2;
  const z1 = D / 2;
  const spring = H * 0.62;
  const crown = H - spring;
  return [
    { op: "column", x: x0, z: z0, y0: 0, y1: spring, role: "leg" },
    { op: "column", x: x1, z: z0, y0: 0, y1: spring, role: "leg" },
    { op: "column", x: x0, z: z1, y0: 0, y1: spring, role: "leg" },
    { op: "column", x: x1, z: z1, y0: 0, y1: spring, role: "leg" },
    { op: "arch", x0: x0, z0: z0, x1: x1, z1: z0, y0: spring, crown, role: "support" },
    { op: "arch", x0: x0, z0: z1, x1: x1, z1: z1, y0: spring, crown, role: "support" },
    { op: "poly", role: "rail", points: [{ x: x0, y: spring, z: z0 }, { x: x0, y: spring, z: z1 }] },
    { op: "poly", role: "rail", points: [{ x: x1, y: spring, z: z0 }, { x: x1, y: spring, z: z1 }] },
    { op: "poly", role: "rail", points: [{ x: x0, y: spring * 0.45, z: z0 }, { x: x0, y: spring * 0.45, z: z1 }] },
    { op: "poly", role: "rail", points: [{ x: x1, y: spring * 0.45, z: z0 }, { x: x1, y: spring * 0.45, z: z1 }] },
  ];
}

export function ladderOps(s: Size3): FormOp[] {
  const H = Math.max(s.height, 36);
  const w = Math.max(14, Math.min(s.width, 22));
  const rungs = Math.max(5, Math.round(H / 12));
  const ops: FormOp[] = [
    { op: "column", x: -w / 2, z: 0, y0: 0, y1: H, role: "leg" },
    { op: "column", x: w / 2, z: 0, y0: 0, y1: H, role: "leg" },
  ];
  for (let i = 1; i <= rungs; i++) {
    const y = (i / (rungs + 1)) * H;
    ops.push({
      op: "poly",
      role: "rail",
      points: [
        { x: -w / 2, y, z: 0 },
        { x: w / 2, y, z: 0 },
      ],
    });
  }
  return ops;
}

export function frameOps(s: Size3): FormOp[] {
  return [{ op: "box", x: 0, y: s.height / 2, z: 0, w: s.width, h: s.height, d: s.depth, role: "leg" }];
}

export function towerOps(s: Size3): FormOp[] {
  return [taper(0, s.height, s.width * 0.45, s.width * 0.18, 6, "leg")];
}

export function chairOps(s: Size3): FormOp[] {
  const h = Math.max(s.height, 32);
  const w = Math.max(14, Math.min(s.width, 22));
  const d = Math.max(14, Math.min(s.depth, 20));
  const seat = h * 0.5;
  const hx = w / 2;
  const hz = d / 2;
  return [
    { op: "column", x: -hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: -hx, z: hz, y0: 0, y1: seat, role: "leg" },
    { op: "column", x: hx, z: hz, y0: 0, y1: seat, role: "leg" },
    { op: "poly", role: "rail", points: [{ x: -hx, y: seat, z: -hz }, { x: hx, y: seat, z: -hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: seat, z: hz }, { x: hx, y: seat, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: seat, z: -hz }, { x: -hx, y: seat, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: hx, y: seat, z: -hz }, { x: hx, y: seat, z: hz }] },
    { op: "poly", role: "brace", points: [{ x: -hx, y: h, z: -hz }, { x: hx, y: h, z: -hz }] },
    { op: "poly", role: "brace", points: [{ x: -hx, y: seat + (h - seat) * 0.55, z: -hz }, { x: hx, y: seat + (h - seat) * 0.55, z: -hz }] },
  ];
}

export function tableOps(s: Size3): FormOp[] {
  const h = Math.max(s.height, 28);
  const w = Math.max(s.width, 36);
  const d = Math.max(s.depth, 18);
  const hx = w / 2;
  const hz = d / 2;
  return [
    { op: "column", x: -hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: -hx, z: hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: hx, z: hz, y0: 0, y1: h, role: "leg" },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: -hz }, { x: hx, y: h, z: -hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: hz }, { x: hx, y: h, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: -hz }, { x: -hx, y: h, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: hx, y: h, z: -hz }, { x: hx, y: h, z: hz }] },
  ];
}

export function bedOps(s: Size3): FormOp[] {
  return [
    { op: "box", x: 0, y: s.height * 0.35, z: 0, w: s.width, h: s.height * 0.7, d: s.depth, role: "rail" },
    { op: "legs", count: 4, radius: Math.min(s.width, s.depth) * 0.45, y0: 0, y1: s.height * 0.35, role: "leg" },
  ];
}

export function benchOps(s: Size3): FormOp[] {
  const h = Math.max(s.height, 16);
  const w = Math.max(s.width, 24);
  const d = Math.max(6, s.depth);
  const hx = w / 2;
  const hz = d / 2;
  return [
    { op: "column", x: -hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: hx, z: -hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: -hx, z: hz, y0: 0, y1: h, role: "leg" },
    { op: "column", x: hx, z: hz, y0: 0, y1: h, role: "leg" },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: -hz }, { x: hx, y: h, z: -hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: hz }, { x: hx, y: h, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: -hx, y: h, z: -hz }, { x: -hx, y: h, z: hz }] },
    { op: "poly", role: "rail", points: [{ x: hx, y: h, z: -hz }, { x: hx, y: h, z: hz }] },
  ];
}

export function rocketOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.78, H * 0.12, H * 0.07, 8, "leg"), { op: "dome", y0: H * 0.78, r: H * 0.08, role: "tip" }];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: Math.cos(a) * H * 0.05, y: 0, z: Math.sin(a) * H * 0.05 },
        { x: Math.cos(a) * H * 0.22, y: 0, z: Math.sin(a) * H * 0.22 },
        { x: Math.cos(a) * H * 0.06, y: H * 0.22, z: Math.sin(a) * H * 0.06 },
      ],
    });
  }
  return ops;
}

export function planeOps(s: Size3): FormOp[] {
  const L = Math.max(s.width, s.height);
  return [
    taper(0, L * 0.15, L * 0.04, L * 0.06, 6, "leg"),
    { op: "column", x: 0, z: 0, y0: 0, y1: L * 0.08, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -L * 0.45, y: L * 0.08, z: 0 },
        { x: L * 0.45, y: L * 0.08, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: L * 0.08, z: -L * 0.12 },
        { x: 0, y: L * 0.08, z: L * 0.12 },
      ],
    },
  ];
}

export function wagonOps(s: Size3): FormOp[] {
  const w = s.width;
  const d = s.depth;
  return [
    { op: "box", x: 0, y: s.height * 0.45, z: 0, w, h: s.height * 0.4, d, role: "rail" },
    { op: "ring", y: s.height * 0.18, rx: s.height * 0.16, n: 8, role: "brace" },
    { op: "column", x: w * 0.35, z: d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: -w * 0.35, z: d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: w * 0.35, z: -d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: -w * 0.35, z: -d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
  ];
}

export function bikeOps(s: Size3): FormOp[] {
  const L = s.width;
  return [
    { op: "ring", y: L * 0.22, rx: L * 0.22, n: 10, role: "brace" },
    { op: "box", x: L * 0.55, y: L * 0.22, z: 0, w: 0.2, h: 0.2, d: 0.2, role: "ring" },
    {
      op: "poly",
      role: "leg",
      points: [
        { x: 0, y: L * 0.22, z: 0 },
        { x: L * 0.35, y: L * 0.42, z: 0 },
        { x: L * 0.55, y: L * 0.22, z: 0 },
      ],
    },
  ];
}

export function boatOps(s: Size3): FormOp[] {
  const L = s.width;
  const ops: FormOp[] = [
    {
      op: "poly",
      role: "leg",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: L, y: 0, z: 0 },
      ],
    },
    { op: "column", x: L * 0.4, z: 0, y0: 0, y1: s.height, role: "support" },
  ];
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ops.push({ op: "ring", y: s.height * 0.12, rx: s.depth * (0.2 + Math.sin(t * Math.PI) * 0.3), n: 8, role: "brace" });
  }
  return ops;
}

export function ferrisOps(s: Size3): FormOp[] {
  const r = Math.max(s.height, s.width) / 2;
  const ops: FormOp[] = [
    { op: "ring", y: r, rx: r, n: 16, role: "ring" },
    { op: "column", x: -r * 0.15, z: 0, y0: 0, y1: r, role: "support" },
    { op: "column", x: r * 0.15, z: 0, y0: 0, y1: r, role: "support" },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: r, z: 0 },
        { x: Math.cos(a) * r, y: r + Math.sin(a) * r, z: 0 },
      ],
    });
  }
  return ops;
}

export function treeOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [{ op: "column", x: 0, z: 0, y0: 0, y1: H * 0.55, role: "leg" }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: H * 0.45, z: 0 },
        { x: Math.cos(a) * H * 0.28, y: H * 0.75, z: Math.sin(a) * H * 0.28 },
      ],
    });
  }
  ops.push({ op: "dome", y0: H * 0.62, r: H * 0.28, role: "ring" });
  return ops;
}

export function dinoOps(s: Size3): FormOp[] {
  const H = s.height;
  const L = Math.max(s.width, H * 1.4);
  return [
    { op: "legs", count: 4, radius: L * 0.18, y0: 0, y1: H * 0.4, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -L * 0.35, y: H * 0.42, z: 0 },
        { x: 0, y: H * 0.5, z: 0 },
        { x: L * 0.25, y: H * 0.55, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "tip",
      points: [
        { x: L * 0.25, y: H * 0.55, z: 0 },
        { x: L * 0.4, y: H * 0.85, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: -L * 0.35, y: H * 0.42, z: 0 },
        { x: -L * 0.55, y: H * 0.2, z: 0 },
      ],
    },
  ];
}

export function robotOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    { op: "legs", count: 2, radius: H * 0.08, y0: 0, y1: H * 0.4, role: "leg" },
    { op: "box", x: 0, y: H * 0.58, z: 0, w: H * 0.28, h: H * 0.32, d: H * 0.18, role: "rail" },
    { op: "box", x: 0, y: H * 0.88, z: 0, w: H * 0.16, h: H * 0.14, d: H * 0.16, role: "tip" },
    { op: "column", x: H * 0.2, z: 0, y0: H * 0.45, y1: H * 0.75, role: "brace" },
    { op: "column", x: -H * 0.2, z: 0, y0: H * 0.45, y1: H * 0.75, role: "brace" },
  ];
}

export function giraffeOps(_s: Size3): FormOp[] {
  return [];
}

export function animalOps(_s: Size3): FormOp[] {
  return [];
}

export function figureOps(_s: Size3): FormOp[] {
  return [];
}

export function guitarOps(s: Size3): FormOp[] {
  const L = Math.max(s.height, s.width);
  return [
    { op: "ring", y: L * 0.22, rx: L * 0.18, n: 10, role: "ring" },
    { op: "column", x: 0, z: 0, y0: L * 0.35, y1: L, role: "leg" },
    { op: "box", x: 0, y: L * 0.96, z: 0, w: L * 0.14, h: L * 0.06, d: L * 0.04, role: "tip" },
  ];
}

export function swingOps(s: Size3): FormOp[] {
  const w = s.width;
  const h = s.height;
  return [
    { op: "column", x: -w / 2, z: -w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: -w / 2, z: w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: w / 2, z: -w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: w / 2, z: w * 0.2, y0: 0, y1: h, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -w / 2, y: h, z: 0 },
        { x: w / 2, y: h, z: 0 },
      ],
    },
  ];
}

export function guessOps(lower: string, s: Size3): FormOp[] {
  const hit = classifyAnatomy(lower);
  if (hit.anatomy === "shell") return shellOps(s);
  if (hit.anatomy === "loft") return [taper(0, s.height, s.width * 0.35, s.width * 0.14, 4, "leg")];
  if (hit.anatomy === "span") return bridgeOps(s);
  const ops: FormOp[] = [
    { op: "box", x: 0, y: s.height * 0.45, z: 0, w: s.width, h: s.height * 0.7, d: s.depth, role: "rail" },
  ];
  if (/leg|stand|foot/.test(lower)) {
    ops.push({ op: "legs", count: 4, radius: s.width * 0.38, y0: 0, y1: s.height * 0.4, role: "leg" });
  }
  return ops;
}
