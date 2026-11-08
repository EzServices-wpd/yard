/**
 * Class C13 · typed modifiers survive. A modifier the person typed ("rolling", "on casters", "hanging", "wall
 * mounted") is read as a modifier, never as part of the noun: the build is made from the noun, then the modifier is
 * applied as the real hardware it means (four locking casters under the corners; screw eyes or a mounting board).
 * Before this, "rolling" fell into the noun match (a cart became a Wagon) or was dropped, and the learner got it.
 */
import type { Panel, YardProject } from "./types";
import { boardFace } from "./fittedParse";
import { inchFrac } from "./inchText";
import { casterPartId, CASTER_NAME, isCasterPart, ROLLING } from "./casterParts";
import { restateOverall } from "./modelSize";

/** Mobility words: "rolling bookshelf", "kitchen island on casters", "cart with wheels". Never a rolling pin. */

export const CASTER_H = 3;
const heightOf = (t: string) => t.trim().split(/\s+/).reduce((a, w) => a + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
const fmtIn = (n: number) => { const w = Math.floor(n + 1e-6); const f = Math.round((n - w) * 16); if (!f) return `${w}`; const g = (a: number, b: number): number => (b ? g(b, a % b) : a); const d = g(f, 16); return `${w ? `${w} ` : ""}${f / d}/${16 / d}`; };
const CASTER_PLATE = 2.5;

/** The prompt with its mobility words taken out (and a typed height less the casters), or null when none was typed. */
export function mobilityAsk(prompt: string): { base: string } | null {
  if (!ROLLING.test(prompt)) return null;
  // Every mobility word comes out ("mobile workbench … on casters"), so the base is built once, without casters.
  const base = prompt
    .replace(new RegExp(ROLLING.source, "gi"), " ")
    .replace(/(\d+(?:\.\d+)?)(\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:tall|high)\b)/i, (_m, n: string, rest: string) => `${Math.max(1, Number(n) - CASTER_H)}${rest}`)
    .replace(/\s+/g, " ")
    .trim();
  return base ? { base } : null;
}

/** A build that stands on the floor and can take casters (furniture, not a toy, a landmark or something hung). */
export function takesCasters(p: YardProject): boolean {
  if (!p.panels.length || p.historic || p.displayOnly) return false;
  if (p.assumptions?.installMode === "wall" || p.assumptions?.installMode === "alcove") return false;
  if (!["closet", "furniture", "custom"].includes(p.kind)) return false;
  if (p.overall.height < 8 || p.overall.width < 10) return false;
  // A build that already rolls on its own wheels (a wagon, a toy truck) takes no casters: "with wheels" is its form.
  return !p.panels.some((x) => isCasterPart(x) || /\bwheels?\b/i.test(x.name ?? ""));
}

/** Four locking swivel casters under the corners of the footprint; everything else rides 3" higher. */
export function withCasters(p: YardProject, prompt: string): YardProject {
  const minY = Math.min(...p.panels.map((x) => x.position.y));
  const feet = p.panels.filter((x) => x.position.y <= minY + 0.1 && x.materialId !== "hardware");
  const x0 = Math.min(...feet.map((x) => x.position.x)), x1 = Math.max(...feet.map((x) => x.position.x + x.size.width));
  const z0 = Math.min(...feet.map((x) => x.position.z)), z1 = Math.max(...feet.map((x) => x.position.z + x.size.depth));
  const up = <T extends { y: number }>(v: T | undefined): T | undefined => (v ? { ...v, y: v.y + CASTER_H } : v);
  const panels: Panel[] = p.panels.map((x) => ({ ...x, position: { ...x.position, y: x.position.y - minY + CASTER_H } }));
  const instances = (p.instances ?? []).map((i) => ({ ...i, position: up(i.position)!, ...(i.from ? { from: up(i.from) } : {}), ...(i.to ? { to: up(i.to) } : {}), ...(i.home ? { home: up(i.home) } : {}) }));
  const corners: [number, number, string][] = [[x0, z1 - CASTER_PLATE, "front left"], [x1 - CASTER_PLATE, z1 - CASTER_PLATE, "front right"], [x0, z0, "back left"], [x1 - CASTER_PLATE, z0, "back right"]];
  const casters: Panel[] = corners.map(([x, z], i) => ({
    id: casterPartId(p.id, i + 1),
    type: "cleat",
    name: CASTER_NAME(i + 1),
    materialId: "hardware",
    position: { x, y: 0, z },
    size: { width: CASTER_PLATE, height: CASTER_H, depth: CASTER_PLATE },
  } as Panel));
  const note = `Rolling: four 2" locking swivel casters screw under the corners and add ${CASTER_H}" to the height; lock two of them so it stays put.`;
  const overall = { ...p.overall, height: Math.round((p.overall.height + CASTER_H) * 1000) / 1000 };
  // The title and notes name the finished size (on its casters), the same one the header and step 01 read.
  return restateOverall({
    ...p,
    prompt,
    panels: [...panels, ...casters],
    instances,
    overall,
    notes: [...(p.notes ?? []).map((n) => n.replace(/^Assumed ([\d ./]+)" tall/, (m, h: string) => (heightOf(h) === p.overall.height ? `Assumed ${fmtIn(p.overall.height + CASTER_H)}" tall on its casters` : m))), note],
  }, p.overall, overall);
}

/** "hanging birdhouse" / "wall mounted bat house": how a small habitat is hung, or null. */
export function mountAsk(prompt: string): "hang" | "wall" | null {
  const l = prompt.toLowerCase();
  if (/\bwall[- ]?(?:mounted|mount|hung)\b|\bon\s+(?:the|a)\s+(?:wall|fence|post)\b|\bpost[- ]mounted\b|\bfence[- ]mounted\b/.test(l)) return "wall";
  if (/\bhanging\b|\bhung\b|\bhangs?\s+from\b/.test(l)) return "hang";
  return null;
}

/** A small habitat (birdhouse, bat house, bee hotel) built by the house form. */
function smallHabitat(p: YardProject): boolean {
  return p.kind === "house" && p.overall.height <= 36 && p.panels.length > 0;
}

/**
 * The typed mount, as real parts: hanging adds two screw eyes in the roof ridge (Buy: screw eyes and chain);
 * wall mounted adds a mounting board behind the back wall, 3" proud top and bottom, screwed to a stud or post.
 */
export function withMount(p: YardProject, prompt: string): YardProject {
  const how = mountAsk(prompt);
  if (!how || !smallHabitat(p) || p.panels.some((x) => /^Screw eye \d+$|^Mounting board$/.test(x.name))) return p;
  const { width: W, height: H, depth: D } = p.overall;
  if (how === "hang") {
    const eyes: Panel[] = [0.3, 0.7].map((f, i) => ({
      id: `${p.id}-eye-${i + 1}`, type: "cleat", name: `Screw eye ${i + 1}`, materialId: "hardware",
      position: { x: W * f - 0.25, y: H, z: D / 2 - 0.25 }, size: { width: 0.5, height: 0.75, depth: 0.5 },
    } as Panel));
    return { ...p, prompt, panels: [...p.panels, ...eyes], overall: { ...p.overall, height: H + 0.75 }, notes: [...(p.notes ?? []), "Hanging: twist two screw eyes into the roof ridge and hang it from a branch or hook on a short chain, about 5–10 ft up."] };
  }
  const back = Math.min(...p.panels.map((x) => x.position.z));
  const board: Panel = { id: `${p.id}-mount`, type: "back", name: "Mounting board", materialId: p.primaryMaterialId ?? "lumber-1x6-8", position: { x: Math.max(0, W / 2 - 2.75), y: -3, z: back - 0.75 }, size: { width: Math.min(5.5, W), height: H + 6, depth: 0.75 } } as Panel;
  const panels = [...p.panels.map((x) => ({ ...x, position: { ...x.position, y: x.position.y + 3, z: x.position.z + 0.75 } })), { ...board, position: { ...board.position, y: 0, z: back } }];
  return { ...p, prompt, panels, assumptions: { ...(p.assumptions ?? {}), installMode: "wall" } as YardProject["assumptions"], overall: { ...p.overall, height: H + 6, depth: D + 0.75 }, notes: [...(p.notes ?? []), "Wall mounted: a mounting board behind the back wall stands 3\" proud top and bottom; drive a structural screw through each end into a stud, post or fence rail."] };
}

/** A raised bed with no typed height stands whole courses of its board face (3 × 5 1/2" = 16 1/2" for 2×6),
 * so no board is ripped; a typed height is kept as typed. */
export function bedCourses(p: YardProject, prompt: string): YardProject {
  if (!/^(?:\w+ )?raised garden bed/i.test(p.name) && !/raised garden bed/i.test(p.name)) return p;
  const lower = prompt.toLowerCase();
  if (/(?:tall|high|height)\b/.test(lower)) return p;
  const face = /\b2\s*x\s*\d+\b/.test(lower) ? boardFace(lower) : 5.5;
  const H = 3 * face, was = p.overall.height;
  if (!(was > 0) || Math.abs(H - was) < 0.01) return withCourseNote(p, H, face);
  const k = H / was;
  const panels = p.panels.map((q) => ({ ...q, position: { ...q.position, y: q.position.y * k }, size: { ...q.size, height: q.size.height * k } }));
  const notes = p.notes.map((n) => (/^Assumed [^ ]+ tall/.test(n) ? n.replace(/^Assumed [^ ]+ tall/, `Assumed ${inchFrac(H)}" tall`) : n));
  return withCourseNote({ ...p, panels, overall: { ...p.overall, height: H }, notes }, H, face);
}
function withCourseNote(p: YardProject, H: number, face: number): YardProject {
  const note = `The ${inchFrac(H)}" walls are 3 whole courses of ${inchFrac(face)}" boards, so no board is ripped. Type a height to change it.`;
  return p.notes.includes(note) ? p : { ...p, notes: [...p.notes, note] };
}
