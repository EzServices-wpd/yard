/**
 * Prompt-native 2D layouts + lift to 3D.
 *
 * Design rule: whole craft sticks on paper, ~8–28 pieces, one sitting.
 * Never cut — glue full sticks end-to-end on the printed lines.
 */

import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { analyzePieces } from "./connect";
import { stickEdges, segmentInstances } from "./stickFrames";
import type { FlatPlane, PaperSize } from "./flat";
import { detectWeekendMech, isMediaDeviceStand } from "./weekendFamily";
import type { CatalogItem, StructureKind, YardInstance, YardProject } from "./types";

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
  // Mechanism classes are 3D — never a paper silhouette (paper plane on a launch ramp ≠ 2D plane).
  const mech = detectWeekendMech(prompt);
  if (
    mech === "launcher" ||
    mech === "climb" ||
    (mech === "media-hold" && isMediaDeviceStand(prompt)) ||
    (/\bpaper\s*plane\b/.test(lower) && /\bramp\b|soft-?launch|leaves the ramp/.test(lower))
  ) {
    return null;
  }
  const flatCue =
    /\b(2d|2-d|two[\s-]?dimensional|flat\s+(map|layout|print|design)|on\s+paper|printable|print\s+out|coloring|paper\s+craft|paper\s+with|on\s+an?\s+sheet)\b/.test(
      lower,
    ) ||
    /\b(8\s*[x×]\s*10|8x10|letter\s+size|a4\s+paper|on\s+an?\s+8)\b/.test(lower) ||
    (/\bpaper\b/.test(lower) &&
      /\b(car|house|tree|star|rocket|heart|dog|boat|plane|flower|fish|person|kid|child|dinosaur|dino|castle|fort|monogram|butterfly|cat|frame|ladder|arrow)\b/.test(
        lower,
      ));
  // Bamboo / craft picture frame is a stick-native flat frame — not a densified 3D scaffold box.
  const craftPictureFrame =
    /(?:picture|photo)\s*frame|craft\s*frame/.test(lower) &&
    /bamboo|skewer|popsicle|craft\s*stick|jumbo/.test(lower);

  if (!flatCue && !craftPictureFrame) return null;

  let paper: PaperSize = "letter";
  if (/8\s*[x×]\s*10|8x10/.test(lower)) paper = "8x10";
  else if (/letter\s*landscape|landscape\s*letter/.test(lower)) paper = "letter-landscape";
  else if (/\ba4\b/.test(lower)) paper = "a4";
  else if (/\bletter\b/.test(lower)) paper = "letter";

  let label = craftPictureFrame ? "Picture frame" : "Frame";
  for (const s of SUBJECTS) {
    if (s.re.test(lower)) {
      label = craftPictureFrame && s.id === "frame" ? "Picture frame" : s.label;
      break;
    }
  }
  if (craftPictureFrame) label = "Picture frame";

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

  const pictureFrame = /picture|photo/.test(prompt.toLowerCase()) || /picture frame/i.test(intent.subject);
  const edgesKey = /frame/i.test(intent.subject) ? "frame" : intent.subject;
  // Rebuild with edge key so "Picture frame" still uses the double-rectangle stick map.
  const edgeInstances =
    edgesKey !== intent.subject
      ? segmentInstances(stickEdges(edgesKey), paper.w, paper.h, item)
      : instances;
  const useInstances = edgeInstances.length ? edgeInstances : instances;
  const useStats = edgeInstances.length ? analyzePieces(edgeInstances, item) : stats;

  return {
    id: createId("proj"),
    name: pictureFrame ? "Picture frame" : `${intent.subject} on ${paperLabel}`,
    prompt,
    kind: "figure" as StructureKind,
    overall: {
      width: pictureFrame ? Math.min(paper.w, Math.max(8, toPrimitive(item).length || 4.5)) : paper.w,
      height: pictureFrame ? Math.min(paper.h, Math.max(10, (toPrimitive(item).length || 4.5) * 1.2)) : paper.h,
      depth: Math.max(0.5, toPrimitive(item).height || 0.2),
    },
    instances: withHome(useInstances),
    panels: [],
    primaryMaterialId: item.id,
    joinMethod: item.preferredJoins?.[0],
    notes: [
      pictureFrame
        ? `Picture frame · whole ${item.name} sticks — outer rectangle, mat opening, and same-stock backing behind the rabbet.`
        : `2D stick layout · ${paperLabel} paper · ${intent.subject.toLowerCase()} in ${item.name}.`,
      `${useInstances.length} whole sticks from the pack. Glue ends where sticks meet.`,
      useStats.components <= 1
        ? `Connected outline · ${useStats.joints} glue joints`
        : `Outline · ${useStats.joints} glue joints · ${useStats.components} clusters`,
      pictureFrame
        ? "Glue the mat opening, then glue backing bars of the same stock so you can slip the picture into the rabbet."
        : "Print the 2D map → lay full sticks on the lines → glue ends → optional Convert to 3D.",
    ],
    historic: false,
    buildStats: useStats,
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

  // Paper-craft product truth: whole sticks only. Depth ties are short
  // (paper-thickness scale); never introduce cutLength on lift.
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
      cutLength: undefined,
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
      `${all.length} whole sticks after lift — glue ends · do not cut.`,
      ...project.notes.filter((n) => !n.startsWith("2D stick") && !n.startsWith("Print the")),
    ],
    buildStats: stats,
    flat: { ...project.flat, lifted: true },
  };
}
