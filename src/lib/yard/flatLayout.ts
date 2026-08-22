/**
 * Prompt-native 2D layouts + lift to 3D.
 *
 * Design rule: whole craft sticks on paper, ~8–28 pieces, one sitting.
 */

import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { analyzePieces } from "./connect";
import { stickEdges, segmentInstances } from "./stickFrames";
import type { FlatPlane, PaperSize } from "./flat";
import type { CatalogItem, StructureKind, YardProject } from "./types";

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
  { re: /\b(car|auto|vehicle|truck)\b/, id: "car", label: "Car" },
  { re: /\b(house|home|cottage|cabin)\b/, id: "house", label: "House" },
  { re: /\b(tree|pine)\b/, id: "tree", label: "Tree" },
  { re: /\b(star|stars)\b/, id: "star", label: "Star" },
  { re: /\b(heart|love)\b/, id: "heart", label: "Heart" },
  { re: /\b(boat|ship|sailboat)\b/, id: "boat", label: "Boat" },
  { re: /\b(frame|picture\s*frame|border)\b/, id: "frame", label: "Frame" },
  { re: /\b(arrow)\b/, id: "arrow", label: "Arrow" },
  { re: /\b(ladder)\b/, id: "ladder", label: "Ladder" },
  { re: /\b(rocket|spaceship)\b/, id: "rocket", label: "Rocket" },
  { re: /\b(person|stick\s*figure)\b/, id: "person", label: "Person" },
  { re: /\b(dinosaur|dino|t[\s-]?rex)\b/, id: "dinosaur", label: "Dinosaur" },
  { re: /\b(castle|fort)\b/, id: "castle", label: "Castle" },
  { re: /\b(letter|monogram|initial)\b/, id: "monogram", label: "Letter" },
  { re: /\b(dog|puppy)\b/, id: "dog", label: "Dog" },
  { re: /\b(cat|kitten)\b/, id: "cat", label: "Cat" },
  { re: /\b(plane|airplane)\b/, id: "plane", label: "Plane" },
  { re: /\b(flower)\b/, id: "flower", label: "Flower" },
  { re: /\b(fish)\b/, id: "fish", label: "Fish" },
  { re: /\b(butterfly)\b/, id: "butterfly", label: "Butterfly" },
];

export function detectFlatPrompt(prompt: string): FlatIntent | null {
  const lower = prompt.toLowerCase();
  const flatCue =
    /\b(2d|2-d|two[\s-]?dimensional|flat\s+(map|layout|print|design)|on\s+paper|printable|print\s+out|coloring|paper\s+craft|paper\s+with|on\s+an?\s+sheet)\b/.test(
      lower,
    ) ||
    /\b(8\s*[x×]\s*10|8x10|letter\s+size|a4\s+paper|on\s+an?\s+8)\b/.test(lower) ||
    (/\bpaper\b/.test(lower) &&
      /\b(car|house|tree|star|rocket|heart|dog|boat|plane|flower|fish|person|kid|child|dinosaur|dino|castle|fort|monogram|butterfly|cat|frame|ladder|arrow)\b/.test(
        lower,
      ));

  if (!flatCue) return null;

  let paper: PaperSize = "letter";
  if (/8\s*[x×]\s*10|8x10/.test(lower)) paper = "8x10";
  else if (/letter\s*landscape|landscape\s*letter/.test(lower)) paper = "letter-landscape";
  else if (/\ba4\b/.test(lower)) paper = "a4";
  else if (/\bletter\b/.test(lower)) paper = "letter";

  let label = "Frame";
  for (const s of SUBJECTS) {
    if (s.re.test(lower)) {
      label = s.label;
      break;
    }
  }

  return { paper, subject: label, isFlat: true };
}

export function buildFlatProject(prompt: string, item: CatalogItem, intent: FlatIntent): YardProject {
  const paper = PAPER_IN[intent.paper];
  const edges = stickEdges(intent.subject);
  const instances = segmentInstances(edges, paper.w, paper.h, item);
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
      `2D stick layout · ${paperLabel} paper · ${intent.subject.toLowerCase()} in ${item.name}.`,
      `${instances.length} sticks — whole or near-full length where the edge allows.`,
      stats.components <= 1
        ? `Connected outline · ${stats.joints} joints`
        : `Outline · ${stats.joints} joints · ${stats.components} clusters`,
      "Print the 2D map → glue sticks on the lines → optional Convert to 3D.",
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
  const step = Math.max(1, Math.floor(project.instances.length / 10));
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
      ...project.notes.filter((n) => !n.startsWith("2D stick") && !n.startsWith("Print the")),
    ],
    buildStats: stats,
    flat: { ...project.flat, lifted: true },
  };
}
