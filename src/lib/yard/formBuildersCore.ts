/**
 * Form geometry builders — continuous wires for each anatomy class.
 * Imported by form.ts so HITS can call them.
 */
import type { FormOp, Size3 } from "./formTypes";

function taper(y0: number, y1: number, r0: number, r1: number, sides = 8, role = "leg"): FormOp {
  return { op: "taper", y0, y1, r0, r1, sides, role };
}


export function tajOps(s: Size3): FormOp[] {
  const H = s.height;
  const plat = H * 0.62;
  const body = plat * 0.38;
  return [
    { op: "grid", y: 0.5, w: plat * 2, d: plat * 2, nx: 4, nz: 4, role: "base" },
    { op: "shell", y0: H * 0.18, y1: H * 0.52, r: body, profile: "drum", role: "leg" },
    { op: "shell", y0: H * 0.5, y1: H, r: body * 0.92, profile: "onion", role: "ring" },
    { op: "column", x: plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "shell", x: plat * 0.82, z: plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: -plat * 0.82, z: plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: plat * 0.82, z: -plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: -plat * 0.82, z: -plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "arch", x0: -body, z0: -body, x1: body, z1: -body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: -body, z0: body, x1: body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: -body, z0: -body, x1: -body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: body, z0: -body, x1: body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
  ];
}

export function pyramidOps(s: Size3): FormOp[] {
  const H = s.height;
  const half = (s.width > H * 0.7 ? s.width : H * (230.3 / 146.6)) / 2;
  return [taper(0, H, half, Math.max(half * 0.04, 0.4), 4, "leg")];
}

export function colosseumOps(s: Size3): FormOp[] {
  const H = s.height;
  const rx = s.width / 2;
  const rz = s.depth / 2;
  const ops: FormOp[] = [];
  for (let i = 0; i <= 3; i++) {
    ops.push({ op: "ring", y: (i / 3) * H, rx, rz, n: 16, role: i === 0 ? "base" : "ring" });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const a2 = ((i + 1) / 12) * Math.PI * 2;
    ops.push({
      op: "arch",
      x0: Math.cos(a) * rx,
      z0: Math.sin(a) * rz,
      x1: Math.cos(a2) * rx,
      z1: Math.sin(a2) * rz,
      y0: 0,
      crown: H * 0.28,
      role: "support",
    });
  }
  return ops;
}

export function libertyOps(s: Size3): FormOp[] {
  const H = s.height;
  return [taper(0, H * 0.48, H * 0.2, H * 0.14, 4, "leg")];
}

export function clockOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.78, H * 0.18, H * 0.14, 4, "leg"),
    { op: "box", x: 0, y: H * 0.82, z: 0, w: H * 0.22, h: H * 0.16, d: H * 0.22, role: "ring" },
    { op: "column", x: 0, z: 0, y0: H * 0.9, y1: H, role: "tip" },
  ];
}

export function obeliskOps(s: Size3): FormOp[] {
  return [taper(0, s.height * 0.92, s.height * 0.08, s.height * 0.035, 4, "leg"), { op: "column", x: 0, z: 0, y0: s.height * 0.9, y1: s.height, role: "tip" }];
}

export function empireStateOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.38, H * 0.22, H * 0.16, 4, "leg"),
    taper(H * 0.36, H * 0.72, H * 0.16, H * 0.1, 4, "leg"),
    taper(H * 0.7, H * 0.9, H * 0.1, H * 0.045, 4, "leg"),
    { op: "column", x: 0, z: 0, y0: H * 0.88, y1: H, role: "tip" },
    { op: "ring", y: H * 0.38, rx: H * 0.18, n: 8, role: "rail" },
    { op: "ring", y: H * 0.72, rx: H * 0.12, n: 8, role: "rail" },
  ];
}

export function spaceNeedleOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.72, H * 0.14, H * 0.035, 8, "leg"),
    { op: "ring", y: H * 0.78, rx: H * 0.16, n: 12, role: "rail" },
    { op: "shell", y0: H * 0.72, y1: H * 0.86, r: H * 0.14, profile: "drum", role: "ring" },
    { op: "column", x: 0, z: 0, y0: H * 0.84, y1: H, role: "tip" },
  ];
}

export function pisaOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.92, H * 0.14, H * 0.12, 8, "leg")];
  for (let i = 0; i < 7; i++) {
    ops.push({ op: "ring", y: (i / 6) * H * 0.88, rx: H * 0.15, n: 10, role: i === 0 ? "base" : "ring" });
  }
  ops.push({ op: "column", x: 0, z: 0, y0: H * 0.9, y1: H, role: "tip" });
  return ops;
}

export function goldenGateOps(s: Size3): FormOp[] {
  const span = Math.max(s.width, s.height * 1.6);
  const h = s.height;
  const t0 = span * 0.22;
  const t1 = span * 0.78;
  return [
    { op: "column", x: t0, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "column", x: t1, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "column", x: t0, z: Math.max(6, s.depth * 0.2), y0: 0, y1: h, role: "leg" },
    { op: "column", x: t1, z: Math.max(6, s.depth * 0.2), y0: 0, y1: h, role: "leg" },
    { op: "grid", y: h * 0.42, w: span, d: Math.max(6, s.depth * 0.35), nx: 10, nz: 2, x: span / 2, role: "rail" },
    {
      op: "poly",
      role: "support",
      points: [
        { x: 0, y: h * 0.42, z: 0 },
        { x: t0 * 0.5, y: h * 0.7, z: 0 },
        { x: t0, y: h, z: 0 },
        { x: (t0 + t1) / 2, y: h * 0.62, z: 0 },
        { x: t1, y: h, z: 0 },
        { x: t1 + (span - t1) * 0.5, y: h * 0.7, z: 0 },
        { x: span, y: h * 0.42, z: 0 },
      ],
    },
  ];
}

export function arcOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width;
  return [
    { op: "box", x: 0, y: H * 0.55, z: 0, w, h: H * 0.9, d: Math.max(s.depth, w * 0.35), role: "leg" },
    { op: "arch", x0: -w * 0.28, z0: 0, x1: w * 0.28, z1: 0, y0: 0, crown: H * 0.42, role: "support" },
    { op: "ring", y: H, rx: w * 0.48, rz: s.depth * 0.4, n: 8, role: "rail" },
  ];
}

export function parthenonOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width;
  const d = s.depth;
  const ops: FormOp[] = [{ op: "grid", y: H * 0.12, w, d, nx: 6, nz: 3, role: "base" }];
  const cols = 6;
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + (i / (cols - 1)) * w;
    ops.push({ op: "column", x, z: -d / 2, y0: H * 0.12, y1: H * 0.78, role: "leg" });
    ops.push({ op: "column", x, z: d / 2, y0: H * 0.12, y1: H * 0.78, role: "leg" });
  }
  ops.push({ op: "grid", y: H * 0.8, w: w * 1.05, d: d * 1.05, nx: 5, nz: 3, role: "rail" });
  ops.push({
    op: "poly",
    role: "tip",
    points: [
      { x: -w / 2, y: H * 0.82, z: 0 },
      { x: 0, y: H, z: 0 },
      { x: w / 2, y: H * 0.82, z: 0 },
    ],
  });
  return ops;
}

export function stonehengeOps(s: Size3): FormOp[] {
  const H = s.height;
  const r = Math.max(s.width, s.depth) / 2;
  const ops: FormOp[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ops.push({
      op: "column",
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y0: 0,
      y1: H * 0.78,
      role: "leg",
    });
  }
  ops.push({ op: "ring", y: H * 0.82, rx: r, n, role: "rail" });
  return ops;
}

export function sydneyOps(s: Size3): FormOp[] {
  const H = s.height;
  const r = Math.max(s.width, s.depth) / 2;
  return [
    { op: "grid", y: H * 0.08, w: r * 2.2, d: r * 1.4, nx: 5, nz: 3, role: "base" },
    { op: "shell", x: -r * 0.35, z: 0, y0: H * 0.08, y1: H * 0.78, r: r * 0.55, profile: "hemisphere", role: "ring" },
    { op: "shell", x: r * 0.25, z: 0, y0: H * 0.08, y1: H, r: r * 0.48, profile: "hemisphere", role: "ring" },
    { op: "shell", x: r * 0.7, z: r * 0.15, y0: H * 0.08, y1: H * 0.62, r: r * 0.32, profile: "hemisphere", role: "ring" },
  ];
}

export function lighthouseOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.82, H * 0.16, H * 0.08, 8, "leg"),
    { op: "ring", y: H * 0.86, rx: H * 0.12, n: 8, role: "rail" },
    { op: "column", x: 0, z: 0, y0: H * 0.82, y1: H, role: "tip" },
  ];
}

export function windmillOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.72, H * 0.16, H * 0.1, 8, "leg")];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: H * 0.72, z: 0 },
        { x: Math.cos(a) * H * 0.35, y: H * 0.72 + Math.sin(a) * H * 0.35, z: H * 0.12 },
      ],
    });
  }
  return ops;
}

export function pagodaOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const r = H * 0.22 * (1 - t0 * 0.35);
    ops.push(taper(t0 * H, t1 * H * 0.92, r, r * 0.85, 8, "leg"));
    ops.push({ op: "ring", y: t1 * H * 0.92, rx: r * 1.25, n: 8, role: "rail" });
  }
  return ops;
}

export function castleOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width / 2;
  const ops: FormOp[] = [{ op: "box", x: 0, y: H * 0.35, z: 0, w: w * 2, h: H * 0.7, d: w * 2, role: "ring" }];
  for (const [x, z] of [
    [w, w],
    [-w, w],
    [w, -w],
    [-w, -w],
  ] as const) {
    ops.push({ op: "column", x, z, y0: 0, y1: H, role: "leg" });
    ops.push({ op: "ring", y: H, rx: H * 0.06, n: 6, role: "tip" });
  }
  return ops;
}

/**
 * Continuous Warren girder bridge.
 * Span is primary (X). Two parallel truss planes, long top/bottom chords,
 * Warren zigzag, deck beams, end posts to ground. Nothing floats.
 */
export function bridgeOps(s: Size3): FormOp[] {
  const span = Math.max(s.width, s.height * 1.8, 24);
  const pierH = Math.max(Math.min(s.height, span * 0.28), 8);
  const depth = Math.max(s.depth, Math.min(span * 0.12, pierH * 0.55), 6);
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const panels = Math.max(4, Math.min(14, Math.round(span / Math.max(pierH * 0.85, 8))));
  const dx = span / panels;
  const yBot = Math.max(pierH * 0.12, 1.2);
  const yTop = yBot + pierH * 0.78;
  const ops: FormOp[] = [];

  for (const z of [z0, z1]) {
    ops.push({ op: "column", x: 0, z, y0: 0, y1: yTop, role: "leg" });
    ops.push({ op: "column", x: span, z, y0: 0, y1: yTop, role: "leg" });
  }

  for (const z of [z0, z1]) {
    const bot: { x: number; y: number; z: number }[] = [];
    const top: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= panels; i++) {
      bot.push({ x: i * dx, y: yBot, z });
      top.push({ x: i * dx, y: yTop, z });
    }
    ops.push({ op: "poly", role: "rail", points: bot });
    ops.push({ op: "poly", role: "rail", points: top });
  }

  for (const z of [z0, z1]) {
    for (let i = 1; i < panels; i++) {
      ops.push({ op: "column", x: i * dx, z, y0: yBot, y1: yTop, role: "leg" });
    }
  }

  for (const z of [z0, z1]) {
    for (let i = 0; i < panels; i++) {
      const xA = i * dx;
      const xB = (i + 1) * dx;
      if (i % 2 === 0) {
        ops.push({ op: "poly", role: "brace", points: [{ x: xA, y: yBot, z }, { x: xB, y: yTop, z }] });
      } else {
        ops.push({ op: "poly", role: "brace", points: [{ x: xA, y: yTop, z }, { x: xB, y: yBot, z }] });
      }
    }
  }

  for (let i = 0; i <= panels; i++) {
    const x = i * dx;
    ops.push({ op: "poly", role: "rail", points: [{ x, y: yBot, z: z0 }, { x, y: yBot, z: z1 }] });
  }

  for (let i = 0; i <= panels; i += 2) {
    const x = i * dx;
    ops.push({ op: "poly", role: "brace", points: [{ x, y: yTop, z: z0 }, { x, y: yTop, z: z1 }] });
  }

  const mid = Math.floor(panels / 2) * dx;
  ops.push({ op: "poly", role: "brace", points: [{ x: mid - dx * 0.4, y: yTop, z: z0 }, { x: mid + dx * 0.4, y: yTop, z: z1 }] });
  ops.push({ op: "poly", role: "brace", points: [{ x: mid - dx * 0.4, y: yTop, z: z1 }, { x: mid + dx * 0.4, y: yTop, z: z0 }] });

  return ops;
}
