/**
 * F47: a prompt that names one curated craft item builds that item at its real size from the unit table
 * (unitSizes.ts): "paper clip" is one 1 3/8" No. 1 clip, "3/8 dowel" one 36" rod, "craft stick" one
 * 4 1/2" stick, "washer" one 0.438" disc. A shape word builds that many real items: a "paper clip chain"
 * is N real clips linked end to end (each turned 90° to the last), a "washer tower" a stack of real
 * washers, a "pony bead bracelet" real beads round a wrist (F17: the head noun and the material win —
 * never a pony, never popsicle sticks).
 */
import { createId } from "@/lib/utils";
import { inchFrac, mmToInches } from "./inchText";
import { sentenceCase } from "./headNoun";
import { unitSizeFor, type UnitSize } from "./unitSizes";
import type { AssemblyStep, Panel, YardProject } from "./types";

type Shape = "one" | "chain" | "stack" | "ring";

export const UNIT_ITEM_NOTE = "Unit item:";
const SHAPE_WORD: Record<string, Shape> = { chain: "chain", garland: "chain", tower: "stack", stack: "stack", pile: "stack", bracelet: "ring", necklace: "ring", ring: "ring" };
const FILLER = /\b(?:a|an|one|single|the|of|standard|regular|plain|wooden|wood|metal|steel|plastic|hardwood|birch|round|long|tall|high|inch|inches|in)\b|["']/g;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Is this a purchased-item build (one curated piece, or real pieces linked, stacked or threaded)? */
export function isUnitItem(project: { notes?: string[] }): boolean {
  return (project.notes ?? []).some((n) => n.startsWith(UNIT_ITEM_NOTE));
}

/** F9: the plural goes on the noun, never on a trailing size ("Pony beads 9 × 6 mm", not "9 × 6 mms"). */
export function pluralUnit(name: string): string {
  const m = name.match(/^(.*?[A-Za-z])(\s+[\d"'].*)?$/);
  return m ? `${m[1]}${/s$/.test(m[1]) ? "" : "s"}${m[2] ?? ""}` : `${name}s`;
}

/** Clips are drawn as wire: a closed stadium loop the width of the wire (outline, inside open), not a slab. */
function wireLoop(L: number, W: number, t: number, n = 8): [number, number][] {
  const arc = (cx: number, r: number, from: number): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => { const a = from + (Math.PI * i) / n; return [r3(cx + r * Math.cos(a)), r3(W / 2 + r * Math.sin(a))] as [number, number]; });
  const R = W / 2, ri = Math.max(0.01, R - t);
  const outer = [...arc(L - R, R, -Math.PI / 2), ...arc(R, R, Math.PI / 2)];
  const inner = [...arc(R, ri, Math.PI / 2), ...arc(L - R, ri, -Math.PI / 2)].reverse();
  return [...outer, outer[0], ...inner, inner[0]];
}

export type UnitItemAsk = { unit: UnitSize; shape: Shape; count: number | null; lengthIn: number | null; shapeWord: string };

/** The curated item a prompt names on its own (optionally with one shape word, a count and a size), or null. */
export function unitItemAsk(prompt: string): UnitItemAsk | null {
  const lower = prompt.toLowerCase().trim();
  const unit = unitSizeFor(lower);
  if (!unit) return null;
  const sizeM = lower.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?\b|ft\b|foot|feet|')\s*(?:long|tall|high|around)?/);
  const lengthIn = sizeM ? (/ft|foot|feet|'/.test(sizeM[0]) ? Number(sizeM[1]) * 12 : Number(sizeM[1])) : null;
  // The item words themselves, the size, a count and one shape word are all the prompt may hold.
  let rest = lower.replace(unit.match, " ");
  if (sizeM && !unit.match.test(sizeM[0])) rest = rest.replace(sizeM[0], " ");
  const countM = rest.match(/^\s*(\d+)\s/);
  const count = countM ? Number(countM[1]) : null;
  if (countM) rest = rest.replace(countM[0], " ");
  const shapeWord = (rest.match(/\b(chain|garland|tower|stack|pile|bracelet|necklace|ring)s?\b/) ?? [])[1] ?? "";
  if (shapeWord) rest = rest.replace(new RegExp(`\\b${shapeWord}s?\\b`), " ");
  rest = rest.replace(/\d+\s*\/\s*\d+/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim();
  if (rest) return null;
  const shape: Shape = shapeWord ? SHAPE_WORD[shapeWord] : count && count > 1 && unit.key.startsWith("washer") ? "stack" : "one";
  // Only shapes these items really make: clips link, beads thread, washers stack.
  if (shape === "chain" && !/paper-clip|bead/.test(unit.key)) return null;
  if (shape === "stack" && !unit.key.startsWith("washer")) return null;
  if (shape === "ring" && !/bead|paper-clip/.test(unit.key)) return null;
  // A dowel's size words are the item ("3/8 dowel"), never a typed length.
  const typedLen = sizeM && unit.form !== "dowel" ? lengthIn : null;
  return { unit, shape, count, lengthIn: typedLen, shapeWord };
}

const circle = (r: number, n = 20): [number, number][] => Array.from({ length: n }, (_, i) => [r + r * Math.cos((2 * Math.PI * i) / n), r + r * Math.sin((2 * Math.PI * i) / n)] as [number, number]);

function piece(u: UnitSize, name: string, x: number, y: number, z: number, extra: Partial<Panel> = {}): Panel {
  const d = u.dims;
  const len = d.length ?? 1;
  const wid = d.width ?? d.diameter ?? 0.1;
  const thk = d.thickness ?? d.diameter ?? 0.05;
  const base: Panel = /washer/.test(u.key)
    ? { id: createId("wa"), type: "rail", name, position: { x, y, z }, size: { width: wid, height: thk, depth: wid }, materialId: u.catalogId,
        // F13: a washer is a disc with its hole, never a spanning rail.
        polygon: { plane: "xz", pts: circle(wid / 2), holes: [{ x: wid / 2, y: wid / 2, r: 0.094 }] } }
    : u.key === "paper-clip"
      ? { id: createId("pc"), type: "rail", name, position: { x, y, z }, size: { width: len, height: thk, depth: wid }, materialId: u.catalogId,
          polygon: { plane: "xz", pts: wireLoop(len, wid, thk) } }
    : /bead/.test(u.key)
      ? { id: createId("be"), type: "rail", name, position: { x, y, z }, size: { width: len, height: wid, depth: wid }, materialId: u.catalogId }
      : { id: createId("pc"), type: "rail", name, position: { x, y, z }, size: { width: len, height: thk, depth: wid }, materialId: u.catalogId };
  return { ...base, ...extra };
}

/**
 * Spec 008: how one piece's size is said. Round pieces (marble, bead, button, bottle cap, cotton ball) are "N\" across";
 * a washer is a disc; a round piece longer than it is wide (cork) gives both; anything else is "N\" long".
 */
export function unitSizeTalk(u: UnitSize): string {
  const len = u.dims.length ?? 1;
  const wid = u.dims.width ?? u.dims.diameter ?? 0.1;
  const thk = u.dims.thickness ?? u.dims.diameter ?? 0.05;
  if (/washer/.test(u.key)) return `a ${inchFrac(wid)}" disc, ${inchFrac(thk)}" thick`;
  const round = u.form === "custom" && !!u.dims.diameter;
  if (!round) return `${inchFrac(len)}" long`;
  const across = u.dims.diameter!;
  if (len > across * 1.2) return `${inchFrac(len)}" long, ${inchFrac(across)}" across`;
  return `${inchFrac(Math.max(across, wid))}" across${thk < across * 0.6 ? `, ${inchFrac(thk)}" thick` : ""}`;
}

/** The typed item words as the title, when the table's own name does not already say them. */
function typedUnitTitle(prompt: string, u: UnitSize): string | null {
  const m = prompt.toLowerCase().match(u.match);
  if (!m) return null;
  const typed = m[0].trim().replace(/\s+/g, " ").replace(/(?<!s)s$/, "");
  // Keep the table name when it already holds every typed word ("3/8 dowel" → 3/8" Hardwood Dowel 36").
  const name = u.name.toLowerCase();
  const words = typed.split(" ").filter((w) => /[a-z]/.test(w));
  return words.length && !words.every((w) => name.includes(w)) ? sentenceCase(typed) : null;
}

export function buildUnitItem(prompt: string): YardProject | null {
  const ask = unitItemAsk(prompt);
  if (!ask) return null;
  const { unit: u, shape } = ask;
  const len = u.dims.length ?? 1;
  const wid = u.dims.width ?? u.dims.diameter ?? 0.1;
  const thk = u.dims.thickness ?? u.dims.diameter ?? 0.05;
  const word = u.name.replace(/^No\. 1 /, "").replace(/ \d.*$/, "");
  const panels: Panel[] = [];
  const notes: string[] = [`${UNIT_ITEM_NOTE} ${shape}`];
  let name: string;
  if (shape === "one") {
    panels.push(piece(u, word[0].toUpperCase() + word.slice(1), 0, 0, 0));
    // Spec 008 (I24): the typed noun is the title ("Zip tie", "Pipe cleaner") unless the table name already says it.
    name = typedUnitTitle(prompt, u) ?? u.name[0].toUpperCase() + u.name.slice(1);
    notes.push(`One ${u.name} at its real size: ${unitSizeTalk(u)}. Buy sells it by the pack.`);
  } else if (shape === "chain") {
    // Each clip hooks through the last one's end loop: the pitch is the clip less one loop (about its width).
    const pitch = r3(len - wid);
    const n = ask.count ?? Math.max(2, Math.round(((ask.lengthIn ?? 12) - (len - pitch)) / pitch));
    for (let i = 0; i < n; i++) {
      const turned = i % 2 === 1;
      panels.push(piece(u, `Clip ${i + 1}`, r3(i * pitch), turned ? 0 : r3((wid - thk) / 2), turned ? r3((wid - thk) / 2) : 0, turned ? { size: { width: len, height: wid, depth: thk }, polygon: { plane: "xy", pts: wireLoop(len, wid, thk) } } : {}));
    }
    name = "Paper clip chain";
    const got = r3(len + (n - 1) * pitch);
    // I8: a typed length lands within 1/8", or the note says it is the nearest whole clip.
    const off = ask.lengthIn != null && Math.abs(got - ask.lengthIn) > 0.125 ? ` That is the nearest whole clip to the ${inchFrac(ask.lengthIn)}" you typed (each clip adds ${inchFrac(pitch)}").` : "";
    notes.push(`${n} real No. 1 clips linked end to end, each turned 90° to the last: ${inchFrac(got)}" long.${off}`);
  } else if (shape === "stack") {
    const n = ask.count ?? Math.max(2, Math.round((ask.lengthIn ?? 2.5) / thk));
    for (let i = 0; i < n; i++) panels.push(piece(u, `Washer ${i + 1}`, 0, r3(i * thk), 0));
    name = "Washer tower";
    notes.push(`${n} real ${pluralUnit(u.name)} (${inchFrac(wid)}" discs, ${thk}" thick) stacked: ${inchFrac(r3(n * thk))}" tall. Washers stack; none spans.`);
  } else if (u.key === "paper-clip") {
    // F17: a paper clip necklace or bracelet is a closed loop of linked clips (the last hooks the first): no cord.
    const pitch = r3(len - wid);
    const around = ask.lengthIn ?? (ask.shapeWord === "necklace" ? 18 : 7);
    const n = ask.count ?? Math.max(4, Math.round(around / pitch));
    const R = (n * pitch) / (2 * Math.PI);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      const turned = i % 2 === 1;
      panels.push(piece(u, `Clip ${i + 1}`, r3(R + R * Math.cos(a) - len / 2), turned ? 0 : r3((wid - thk) / 2), r3(R + R * Math.sin(a) - wid / 2), {
        yaw: a + Math.PI / 2,
        ...(turned ? { size: { width: len, height: wid, depth: thk }, polygon: { plane: "xy" as const, pts: wireLoop(len, wid, thk) } } : {}),
      }));
    }
    name = ask.shapeWord === "necklace" ? "Paper clip necklace" : "Paper clip bracelet";
    notes.push(`${n} real No. 1 clips linked into a closed loop, each turned 90° to the last, the last hooked through the first: about ${inchFrac(r3(n * pitch))}" around.`);
  } else {
    // Round a wrist (7") or a neck (18"), beads threaded on one cord.
    const around = ask.lengthIn ?? (ask.shapeWord === "necklace" ? 18 : 7);
    const n = ask.count ?? Math.max(3, Math.round(around / len));
    const R = (n * len) / (2 * Math.PI);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      panels.push(piece(u, `Bead ${i + 1}`, r3(R + R * Math.cos(a) - len / 2), 0, r3(R + R * Math.sin(a) - wid / 2), { yaw: a + Math.PI / 2 }));
    }
    name = ask.shapeWord === "necklace" ? `${u.name} necklace` : `${u.name} bracelet`;
    notes.push(`${n} real ${pluralUnit(u.name)} round a ${inchFrac(around)}" ${ask.shapeWord === "necklace" ? "neck" : "wrist"}, threaded on 1/32" stretch cord.`);
  }
  notes.push(`Piece size from the unit table: ${u.name}, ${u.source}.`);
  for (let i = 0; i < notes.length; i++) notes[i] = mmToInches(notes[i]);
  const maxX = Math.max(...panels.map((p) => p.position.x + p.size.width));
  const maxY = Math.max(...panels.map((p) => p.position.y + p.size.height));
  const maxZ = Math.max(...panels.map((p) => p.position.z + p.size.depth));
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "custom",
    overall: { width: r3(maxX), height: r3(maxY), depth: r3(maxZ) },
    instances: [],
    panels,
    primaryMaterialId: u.catalogId,
    notes,
    historic: false,
    assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
  } as YardProject;
}

/** Steps for a unit-item build: take the real pieces from the pack and link, stack or thread them. */
export function unitItemSteps(project: YardProject): AssemblyStep[] | null {
  const tag = (project.notes ?? []).find((n) => n.startsWith(UNIT_ITEM_NOTE));
  if (!tag) return null;
  const shape = tag.slice(UNIT_ITEM_NOTE.length).trim() as Shape;
  const names = project.panels.map((p) => p.name);
  const n = names.length;
  const said = project.notes[1] ?? "";
  const s = (step: number, title: string, description: string, partsUsed?: string[]): AssemblyStep => ({ step, title, description, ...(partsUsed ? { partsUsed } : {}) });
  if (shape === "one") return [s(1, `Take one ${project.name.toLowerCase()}`, `${said} Nothing to cut: use it whole, as bought.`, names)];
  if (shape === "ring" && project.panels.every((p) => /^Clip /.test(p.name)))
    return [
      s(1, `Count out ${n} paper clips`, `${n} No. 1 clips. Nothing to cut.`),
      s(2, `Link the ${n} clips`, `Hook each clip through the end loop of the one before and turn it 90° so the loops sit flat to each other.`, names),
      s(3, "Close the loop", `Hook the last clip through the end loop of the first so the chain is one closed loop. ${said}`),
    ];
  if (shape === "chain")
    return [
      s(1, `Count out ${n} paper clips`, `${n} No. 1 clips. Nothing to cut.`),
      s(2, `Link the ${n} clips`, `Hook each clip through the end loop of the one before and turn it 90° so the loops sit flat to each other. ${said}`, names),
      s(3, "Check the length", `Hold the chain up by one end and let it hang straight: about ${inchFrac(project.overall.width)}" end to end.`),
    ];
  if (shape === "stack")
    return [
      s(1, `Count out ${n} washers`, `${n} #8 flat washers. Nothing to cut.`),
      s(2, `Stack the ${n} washers`, `Stack them flat and centered, hole over hole, on a level surface. ${said} A 3/16" rod through the holes keeps a tall stack straight.`, names),
    ];
  return [
    s(1, "Cut the cord", "Cut 1/32\" stretch cord 4\" longer than the bracelet so there is cord to tie."),
    s(2, `Thread ${n} beads`, `${said} Slide the beads on one at a time.`, names),
    s(3, "Tie it off", "Tie a surgeon's knot, draw it snug and tuck the ends into the bead next to it."),
  ];
}
