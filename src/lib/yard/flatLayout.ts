/**
 * Prompt-native 2D layouts + lift to 3D.
 *
 * Phase B:
 *   • "8x10 paper with a car of popsicle sticks" → flat layout on paper
 *   • Convert to 3D → same XY ratios, modest depth / upright profile
 */

import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { toPrimitive, isWholeStock } from "./geometry";
import { withHome } from "./assembly";
import { analyzePieces } from "./connect";
import type { FlatPlane, PaperSize } from "./flat";
import type { CatalogItem, StructureKind, Vec3, YardInstance, YardProject } from "./types";

const PAPER_IN: Record<PaperSize, { w: number; h: number }> = {
  letter: { w: 8.5, h: 11 },
  "letter-landscape": { w: 11, h: 8.5 },
  "8x10": { w: 8, h: 10 },
  a4: { w: 8.27, h: 11.69 },
};

export type FlatIntent = {
  paper: PaperSize;
  subject: string;
  isFlat: boolean;
};

const SUBJECTS: { re: RegExp; id: string; label: string }[] = [
  { re: /\b(car|auto|vehicle|truck|bus)\b/, id: "car", label: "Car" },
  { re: /\b(house|home|cottage|cabin)\b/, id: "house", label: "House" },
  { re: /\b(tree|pine|oak|forest)\b/, id: "tree", label: "Tree" },
  { re: /\b(rocket|spaceship|shuttle)\b/, id: "rocket", label: "Rocket" },
  { re: /\b(star|stars)\b/, id: "star", label: "Star" },
  { re: /\b(heart|love)\b/, id: "heart", label: "Heart" },
  { re: /\b(person|people|kid|child|human|stick\s*figure)\b/, id: "person", label: "Person" },
  { re: /\b(dog|puppy|cat|animal)\b/, id: "dog", label: "Dog" },
  { re: /\b(boat|ship|sailboat)\b/, id: "boat", label: "Boat" },
  { re: /\b(plane|airplane|jet)\b/, id: "plane", label: "Plane" },
  { re: /\b(flower|bloom)\b/, id: "flower", label: "Flower" },
  { re: /\b(fish)\b/, id: "fish", label: "Fish" },
];

export function detectFlatPrompt(prompt: string): FlatIntent | null {
  const lower = prompt.toLowerCase();
  const flatCue =
    /\b(2d|2-d|two[\s-]?dimensional|flat\s+(map|layout|print|design)|on\s+paper|printable|print\s+out|coloring|paper\s+craft|paper\s+with|on\s+an?\s+sheet)\b/.test(
      lower,
    ) ||
    /\b(8\s*[x×]\s*10|8x10|letter\s+size|a4\s+paper|on\s+an?\s+8)\b/.test(lower) ||
    (/\bpaper\b/.test(lower) &&
      /\b(car|house|tree|star|rocket|heart|dog|boat|plane|flower|fish|person|kid|child)\b/.test(lower));

  if (!flatCue) return null;

  let paper: PaperSize = "letter";
  if (/8\s*[x×]\s*10|8x10/.test(lower)) paper = "8x10";
  else if (/letter\s*landscape|landscape\s*letter/.test(lower)) paper = "letter-landscape";
  else if (/\ba4\b/.test(lower)) paper = "a4";
  else if (/\bletter\b/.test(lower)) paper = "letter";

  let label = "Shape";
  for (const s of SUBJECTS) {
    if (s.re.test(lower)) {
      label = s.label;
      break;
    }
  }

  return { paper, subject: label, isFlat: true };
}

type Pt = { x: number; y: number };

function silhouette(subject: string): Pt[][] {
  const s = subject.toLowerCase();
  if (s === "car" || s.includes("car")) {
    return [
      [
        { x: 0.08, y: 0.22 }, { x: 0.18, y: 0.42 }, { x: 0.35, y: 0.48 },
        { x: 0.55, y: 0.48 }, { x: 0.72, y: 0.38 }, { x: 0.92, y: 0.32 },
        { x: 0.92, y: 0.18 }, { x: 0.08, y: 0.18 }, { x: 0.08, y: 0.22 },
      ],
      [
        { x: 0.28, y: 0.48 }, { x: 0.34, y: 0.68 }, { x: 0.58, y: 0.68 }, { x: 0.68, y: 0.48 },
      ],
      circle(0.28, 0.16, 0.1, 10),
      circle(0.72, 0.16, 0.1, 10),
    ];
  }
  if (s === "house" || s.includes("house")) {
    return [
      [
        { x: 0.15, y: 0.08 }, { x: 0.15, y: 0.48 }, { x: 0.5, y: 0.82 },
        { x: 0.85, y: 0.48 }, { x: 0.85, y: 0.08 }, { x: 0.15, y: 0.08 },
      ],
      [
        { x: 0.42, y: 0.08 }, { x: 0.42, y: 0.32 }, { x: 0.58, y: 0.32 }, { x: 0.58, y: 0.08 },
      ],
      [
        { x: 0.22, y: 0.28 }, { x: 0.22, y: 0.42 }, { x: 0.36, y: 0.42 },
        { x: 0.36, y: 0.28 }, { x: 0.22, y: 0.28 },
      ],
    ];
  }
  if (s === "tree" || s.includes("tree")) {
    return [
      [
        { x: 0.44, y: 0.05 }, { x: 0.44, y: 0.4 }, { x: 0.56, y: 0.4 },
        { x: 0.56, y: 0.05 }, { x: 0.44, y: 0.05 },
      ],
      circle(0.5, 0.62, 0.28, 14),
    ];
  }
  if (s === "rocket" || s.includes("rocket")) {
    return [
      [
        { x: 0.5, y: 0.92 }, { x: 0.62, y: 0.72 }, { x: 0.62, y: 0.28 },
        { x: 0.72, y: 0.12 }, { x: 0.5, y: 0.2 }, { x: 0.28, y: 0.12 },
        { x: 0.38, y: 0.28 }, { x: 0.38, y: 0.72 }, { x: 0.5, y: 0.92 },
      ],
    ];
  }
  if (s === "star" || s.includes("star")) {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.42 : 0.18;
      pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
    }
    pts.push(pts[0]);
    return [pts];
  }
  if (s === "heart" || s.includes("heart")) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push({ x: 0.5 + x / 40, y: 0.48 + y / 40 });
    }
    return [pts];
  }
  if (s === "person" || s.includes("person")) {
    return [
      circle(0.5, 0.82, 0.08, 10),
      [{ x: 0.5, y: 0.74 }, { x: 0.5, y: 0.42 }],
      [{ x: 0.28, y: 0.62 }, { x: 0.5, y: 0.55 }, { x: 0.72, y: 0.62 }],
      [{ x: 0.38, y: 0.12 }, { x: 0.5, y: 0.42 }, { x: 0.62, y: 0.12 }],
    ];
  }
  if (s === "dog" || s.includes("dog")) {
    return [
      [
        { x: 0.2, y: 0.28 }, { x: 0.35, y: 0.48 }, { x: 0.7, y: 0.48 },
        { x: 0.85, y: 0.55 }, { x: 0.88, y: 0.42 }, { x: 0.75, y: 0.28 }, { x: 0.2, y: 0.28 },
      ],
      [{ x: 0.28, y: 0.28 }, { x: 0.28, y: 0.1 }],
      [{ x: 0.4, y: 0.28 }, { x: 0.4, y: 0.1 }],
      [{ x: 0.62, y: 0.28 }, { x: 0.62, y: 0.1 }],
      [{ x: 0.74, y: 0.28 }, { x: 0.74, y: 0.1 }],
      [{ x: 0.22, y: 0.4 }, { x: 0.12, y: 0.55 }],
    ];
  }
  if (s === "boat" || s.includes("boat")) {
    return [
      [
        { x: 0.1, y: 0.28 }, { x: 0.2, y: 0.12 }, { x: 0.8, y: 0.12 },
        { x: 0.9, y: 0.28 }, { x: 0.1, y: 0.28 },
      ],
      [{ x: 0.5, y: 0.28 }, { x: 0.5, y: 0.72 }],
      [{ x: 0.5, y: 0.72 }, { x: 0.72, y: 0.4 }, { x: 0.5, y: 0.4 }],
    ];
  }
  if (s === "plane" || s.includes("plane")) {
    return [
      [
        { x: 0.08, y: 0.48 }, { x: 0.75, y: 0.52 }, { x: 0.92, y: 0.48 },
        { x: 0.75, y: 0.44 }, { x: 0.08, y: 0.48 },
      ],
      [
        { x: 0.4, y: 0.5 }, { x: 0.25, y: 0.78 }, { x: 0.45, y: 0.5 },
        { x: 0.25, y: 0.22 }, { x: 0.4, y: 0.5 },
      ],
      [
        { x: 0.78, y: 0.5 }, { x: 0.88, y: 0.62 }, { x: 0.82, y: 0.5 },
        { x: 0.88, y: 0.38 }, { x: 0.78, y: 0.5 },
      ],
    ];
  }
  if (s === "flower" || s.includes("flower")) {
    const petals: Pt[][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petals.push(circle(0.5 + Math.cos(a) * 0.22, 0.55 + Math.sin(a) * 0.22, 0.14, 8));
    }
    petals.push(circle(0.5, 0.55, 0.1, 10));
    petals.push([{ x: 0.5, y: 0.45 }, { x: 0.5, y: 0.08 }]);
    return petals;
  }
  if (s === "fish" || s.includes("fish")) {
    return [
      [
        { x: 0.15, y: 0.5 }, { x: 0.35, y: 0.7 }, { x: 0.7, y: 0.65 },
        { x: 0.85, y: 0.5 }, { x: 0.7, y: 0.35 }, { x: 0.35, y: 0.3 }, { x: 0.15, y: 0.5 },
      ],
      [
        { x: 0.85, y: 0.5 }, { x: 0.98, y: 0.68 }, { x: 0.98, y: 0.32 }, { x: 0.85, y: 0.5 },
      ],
    ];
  }
  return [
    [
      { x: 0.12, y: 0.12 }, { x: 0.88, y: 0.12 }, { x: 0.88, y: 0.88 },
      { x: 0.12, y: 0.88 }, { x: 0.12, y: 0.12 },
    ],
    [{ x: 0.12, y: 0.12 }, { x: 0.88, y: 0.88 }],
    [{ x: 0.88, y: 0.12 }, { x: 0.12, y: 0.88 }],
  ];
}

function circle(cx: number, cy: number, r: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function densifyPolyline(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(d / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function segmentInstances(
  paths: Pt[][],
  paperW: number,
  paperH: number,
  item: CatalogItem,
  margin = 0.55,
): YardInstance[] {
  const prim = toPrimitive(item);
  const stockLen = Math.max(prim.length || 4.5, 2);
  const drawW = paperW - margin * 2;
  const drawH = paperH - margin * 2;
  const toIn = (p: Pt): Pt => ({
    x: margin + p.x * drawW,
    y: margin + p.y * drawH,
  });

  const step = Math.min(stockLen * 0.95, Math.max(drawW, drawH) / 12);
  const instances: YardInstance[] = [];
  const whole = isWholeStock(item);

  for (const path of paths) {
    const scaled = path.map(toIn);
    const dense = densifyPolyline(scaled, step * 0.85);
    for (let i = 0; i < dense.length - 1; i++) {
      const a = dense[i];
      const b = dense[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.12) continue;
      const from: Vec3 = { x: a.x - paperW / 2, y: a.y, z: 0 };
      const to: Vec3 = { x: b.x - paperW / 2, y: b.y, z: 0 };
      const mid: Vec3 = {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        z: 0,
      };
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      instances.push({
        id: createId("f"),
        catalogId: item.id,
        position: mid,
        rotation: { x: 0, y: 0, z: ang },
        cutLength: whole ? undefined : Math.min(len, stockLen),
        role: "rail",
        join: item.preferredJoins?.[0] || "glue",
        from,
        to,
      });
    }
  }
  return instances;
}

export function buildFlatProject(prompt: string, item: CatalogItem, intent: FlatIntent): YardProject {
  const paper = PAPER_IN[intent.paper];
  const paths = silhouette(intent.subject);
  const instances = segmentInstances(paths, paper.w, paper.h, item);
  const stats = analyzePieces(instances, item);
  const paperLabel =
    intent.paper === "8x10"
      ? '8×10"'
      : intent.paper === "a4"
        ? "A4"
        : intent.paper === "letter-landscape"
          ? "Letter landscape"
          : "Letter";

  return {
    id: createId("proj"),
    name: `${intent.subject} on ${paperLabel}`,
    prompt,
    kind: "figure" as StructureKind,
    overall: { width: paper.w, height: paper.h, depth: Math.max(0.5, toPrimitive(item).height || 0.2) },
    instances: withHome(instances),
    panels: [],
    primaryMaterialId: item.id,
    joinMethod: item.preferredJoins?.[0],
    notes: [
      `2D layout · ${paperLabel} paper · ${intent.subject.toLowerCase()} silhouette in ${item.name}.`,
      `${instances.length} pieces on the page. Print the 2D map, or Convert to 3D to stand it up.`,
      stats.components <= 1
        ? `Connected outline · ${stats.joints} joints`
        : `Outline · ${stats.joints} joints · ${stats.components} clusters`,
      "Kids path: download 2D map → print → glue sticks on the lines.",
    ],
    historic: false,
    buildStats: stats,
    assumptions: {
      load: "light",
      use: "toy",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
    flat: {
      paper: intent.paper,
      plane: "front" as FlatPlane,
      subject: intent.subject,
      lifted: false,
    },
  };
}

export function liftFlatTo3d(project: YardProject): YardProject {
  if (!project.flat || project.flat.lifted) return project;
  const item = getCatalogItem(project.primaryMaterialId);
  const thick = item ? toPrimitive(item).height || 0.2 : 0.2;
  const depth = Math.max(thick * 4, project.overall.width * 0.12, 0.8);

  const instances: YardInstance[] = project.instances.map((inst) => {
    const from = inst.from
      ? { x: inst.from.x, y: inst.from.y, z: -depth * 0.15 }
      : undefined;
    const to = inst.to ? { x: inst.to.x, y: inst.to.y, z: -depth * 0.15 } : undefined;
    return {
      ...inst,
      from,
      to,
      position: {
        x: inst.position.x,
        y: inst.position.y,
        z: -depth * 0.15,
      },
    };
  });

  const back: YardInstance[] = project.instances.map((inst) => {
    const from = inst.from
      ? { x: inst.from.x, y: inst.from.y, z: depth * 0.35 }
      : undefined;
    const to = inst.to ? { x: inst.to.x, y: inst.to.y, z: depth * 0.35 } : undefined;
    return {
      ...inst,
      id: createId("f"),
      from,
      to,
      position: {
        x: inst.position.x,
        y: inst.position.y,
        z: depth * 0.35,
      },
      role: inst.role === "rail" ? "brace" : inst.role,
    };
  });

  const ties: YardInstance[] = [];
  const step = Math.max(1, Math.floor(project.instances.length / 12));
  for (let i = 0; i < project.instances.length; i += step) {
    const inst = project.instances[i];
    const a = { x: inst.position.x, y: inst.position.y, z: -depth * 0.15 };
    const b = { x: inst.position.x, y: inst.position.y, z: depth * 0.35 };
    ties.push({
      id: createId("t"),
      catalogId: project.primaryMaterialId,
      position: { x: a.x, y: a.y, z: (a.z + b.z) / 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      cutLength: depth * 0.5,
      role: "brace",
      join: project.joinMethod || "glue",
      from: a,
      to: b,
    });
  }

  const all = withHome([...instances, ...back, ...ties]);
  const stats = item ? analyzePieces(all, item) : project.buildStats;

  return {
    ...project,
    name: project.name.replace(/ on /, " · "),
    overall: {
      width: project.overall.width,
      height: project.overall.height,
      depth: depth + thick,
    },
    instances: all,
    notes: [
      `Lifted from 2D · ${project.flat.subject} · was ${project.flat.paper} paper.`,
      `Same outline ratios. Dual face + cross-ties for a buildable volume.`,
      `${all.length} pieces after lift.`,
      ...project.notes.filter((n) => !n.startsWith("2D layout") && !n.startsWith("Kids path")),
    ],
    buildStats: stats,
    flat: { ...project.flat, lifted: true },
  };
}
