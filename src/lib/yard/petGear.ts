/**
 * Gear whose head noun is the thing and whose animal word only says who it is for ("dog ramp",
 * "cat scratching post"). An access ramp is a sloped deck on two tapered sides with a support across the
 * high end, at the typed height. A scratching post is a doubled base with an upright post.
 * Panel positions are the min corner; x runs along the build, y is up, z is across.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { CATALOG_LUMBER_BIND, namedLumberFromPrompt } from "./namedLumberSpecies";
import { typedExtents } from "./honesty";
import { PET_ANIMAL, SMALL_PET } from "./fallbackPrimitive";
import type { Panel, YardProject } from "./types";

const r8 = (n: number) => Math.round(n * 8) / 8;
const PLY = "plywood-3-4-4x8";
const T = 0.75;

function typedAlong(lower: string, words: string): number | null {
  const m = lower.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*-?\s*(in|inch|inches|"|″|ft|feet|foot)?\s*(?:${words})\b`));
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] && /ft|feet|foot/.test(m[2]) ? n * 12 : n;
}

export function isScratchingPost(lower: string): boolean {
  return /\bscratch(?:ing)?\s*posts?\b|\bscratchers?\b|\bcat\s+posts?\b/.test(lower) && !/\btree\b|\btower\b|\bcondo\b/.test(lower);
}

function panel(p: Omit<Panel, "id">): Panel {
  return { id: createId("panel"), ...p } as Panel;
}

function project(prompt: string, name: string, panels: Panel[], primary: string, notes: string[]): YardProject {
  const o = {
    width: r8(Math.max(...panels.map((p) => p.position.x + p.size.width))),
    height: r8(Math.max(...panels.map((p) => p.position.y + p.size.height))),
    depth: r8(Math.max(...panels.map((p) => p.position.z + p.size.depth))),
  };
  return {
    id: createId("proj"),
    name: `${name} ${inchFrac(o.width)}" × ${inchFrac(o.height)}" × ${inchFrac(o.depth)}"`,
    prompt,
    kind: "custom",
    overall: o,
    instances: [],
    panels,
    primaryMaterialId: primary,
    notes: [`${name} ${inchFrac(o.width)}" × ${inchFrac(o.height)}" × ${inchFrac(o.depth)}".`, ...notes],
    sizedByBuilder: true,
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  } as YardProject;
}

/**
 * A furniture word with an animal word in front of it is that animal's gear: "bunny hutch" and "guinea pig
 * cage" are raised enclosures, never a china hutch or a cupboard. Any animal with an enclosure head; a small
 * animal with a house / cabinet / crate head (a dog or cat house stays the kennel).
 */
const ENCLOSURE = new RegExp(
  String.raw`(?:${PET_ANIMAL.source}\s+(?:[a-z-]+\s+)?(?:hutch(?:es)?|cages?|coops?|enclosures?))|(?:\b(?:${SMALL_PET})\s+(?:[a-z-]+\s+)?(?:houses?|homes?|cabinets?|cupboards?|crates?|condos?))\b`,
);
export function isPetEnclosure(lower: string): boolean {
  return ENCLOSURE.test(lower.toLowerCase());
}

const whoFor = (lower: string) => (/\bcats?\b|kitten/.test(lower) ? "cat" : /\bdogs?\b|pupp/.test(lower) ? "dog" : "pet");

/** Sloped deck + tapered sides + high-end support. Runs along x: the run is its length (width on the bench). */
export function buildAccessRamp(prompt: string): YardProject {
  const lower = prompt.toLowerCase();
  const species = namedLumberFromPrompt(prompt);
  const mat = species ? CATALOG_LUMBER_BIND : PLY;
  const typedH = typedAlong(lower, "tall|high|rise|to\\s+the\\s+(?:seat|top)");
  const H = r8(Math.max(6, typedH ?? 18));
  const typedL = typedAlong(lower, "long|length|run");
  const typedW = typedAlong(lower, "wide|across");
  const L = r8(Math.max(H * 1.5, typedL ?? H * 3));
  const W = r8(Math.max(10, typedW ?? 16));
  const slope = Math.atan(H / L);
  const tv = T / Math.cos(slope);
  const ang = Math.round((slope * 180) / Math.PI);
  const under = (x: number) => ((H - tv) * x) / L;
  const surface = /couch|sofa/.test(lower) ? "couch seat" : /\bbed\b/.test(lower) ? "bed" : /\bcar\b|suv|truck/.test(lower) ? "tailgate" : "landing";
  const panels: Panel[] = [];
  for (const [side, z] of [["Left", 0], ["Right", W - T]] as const) {
    panels.push(panel({
      type: "side",
      name: `${side} side`,
      position: { x: 0, y: 0, z },
      size: { width: L, height: r8(H - tv), depth: T },
      polygon: { plane: "xy", pts: [[0, 0], [L, 0], [L, r8(H - tv)]] },
      materialId: mat,
      cutNote: `Tapered side: ${inchFrac(L)}" along the floor, ${inchFrac(r8(H - tv))}" tall at the high end, cut on the diagonal (one ${inchFrac(L)}" × ${inchFrac(r8(H - tv))}" blank gives both sides).`,
    }));
  }
  panels.push(panel({
    type: "upright",
    name: "High-end support",
    position: { x: r8(L - T), y: 0, z: T },
    size: { width: T, height: Math.floor(under(L - T) * 8) / 8, depth: r8(W - 2 * T) },
    materialId: mat,
    cutNote: `Fits between the sides at the high end; it is the ramp's legs to the floor.`,
  }));
  const deckLen = r8(Math.hypot(L, H));
  panels.push(panel({
    type: "deck",
    name: "Deck",
    position: { x: 0, y: 0, z: 0 },
    size: { width: L, height: H, depth: W },
    polygon: { plane: "xy", pts: [[0, 0], [L, r8(H - tv)], [L, H], [0, r8(tv)]] },
    blank: { lengthIn: deckLen, widthIn: W, thicknessIn: T },
    materialId: mat,
    cutNote: `${inchFrac(deckLen)}" long × ${inchFrac(W)}" wide; bevel the low end so it lies flat on the floor.`,
  }));
  const who = whoFor(lower);
  const notes = [
    `${who === "pet" ? "Pet" : who[0].toUpperCase() + who.slice(1)} ramp: a sloped deck on two tapered sides, with a support across the high end standing on the floor. The high end meets the ${surface} at ${inchFrac(H)}".`,
    `Slope about ${ang}° (1 in ${(L / H).toFixed(1).replace(/\.0$/, "")})${typedL ? "" : `; the ${inchFrac(L)}" length is worked out from the ${inchFrac(H)}" rise at 1 in 3 so a small or older ${who} can walk it. Type a length to change it`}.`,
    `Glue outdoor carpet or rubber matting to the deck, or screw ½" × 1 ½" cleats across it every 4", so paws grip. Glue and screw the deck to both sides and the support.`,
    species ? `${species.display} boards edge-glued for the deck, sides and support.` : `¾" plywood throughout.`,
  ];
  if (typedH == null) notes.push(`Assumed ${inchFrac(H)}" high at the top end — type a height to match the ${surface}.`);
  if (typedW == null) notes.push(`Assumed ${inchFrac(W)}" across the deck — type "20 wide" to change it.`);
  return project(prompt, who === "pet" ? "Pet ramp" : `${who[0].toUpperCase()}${who.slice(1)} ramp`, panels, mat, notes);
}

/** Doubled base + upright 4×4 post, centered. */
/** "an 18\"", "an 8\"", "a 20\"" — said as the number sounds. */
const an = (n: number) => (/^(?:8|11|18)(?:\D|$)|^8\d/.test(String(Math.round(n))) ? "an" : "a");

export function buildScratchingPost(prompt: string): YardProject {
  const lower = prompt.toLowerCase();
  const species = namedLumberFromPrompt(prompt);
  const baseMat = species ? CATALOG_LUMBER_BIND : PLY;
  const typedH = typedAlong(lower, "tall|high");
  const H = r8(Math.max(12, typedH ?? 30));
  const typedW = typedAlong(lower, "wide|across|square");
  const B = r8(Math.max(12, typedW ?? Math.max(16, Math.round(H * 0.6))));
  const P = 3.5;
  const panels: Panel[] = [
    panel({ type: "bottom", name: "Base", position: { x: 0, y: 0, z: 0 }, size: { width: B, height: T, depth: B }, materialId: baseMat }),
    panel({ type: "bottom", name: "Base doubler", position: { x: 0, y: T, z: 0 }, size: { width: B, height: T, depth: B }, materialId: baseMat, cutNote: "Glued and screwed to the base: the weight keeps the post from tipping." }),
    panel({ type: "upright", name: "Post", position: { x: r8((B - P) / 2), y: 2 * T, z: r8((B - P) / 2) }, size: { width: P, height: r8(H - 2 * T), depth: P }, materialId: "lumber-4x4-8", cutNote: `4×4 cut square to ${inchFrac(r8(H - 2 * T))}".` }),
  ];
  const wrapped = r8(H - 2 * T - 2);
  const ropeFt = Math.ceil((wrapped * (8 / 3) * (4 * P)) / 12 / 5) * 5;
  const notes = [
    `Scratching post: ${an(B)} ${inchFrac(B)}" square base doubled to 1 ½" for weight, with a 4×4 post standing in the middle, ${inchFrac(H)}" to the top — tall enough for a full stretch.`,
    `Drive two 3" structural screws up through the base into the post end, and glue the base layers together.`,
    `Wrap the post in about ${ropeFt} ft of 3/8" sisal rope: staple the start under the wrap, keep turns tight, glue every few inches, and stop 2" short of the top.`,
  ];
  if (species) notes.push(`${species.display} boards edge-glued for the base; the post is a 4×4.`);
  if (typedH == null) notes.push(`Assumed ${inchFrac(H)}" tall — type a height to lock it.`);
  if (typedW == null) notes.push(`Assumed ${an(B)} ${inchFrac(B)}" base (wide and deep) — type "20 wide" to change it.`);
  return project(prompt, "Scratching post", panels, baseMat, notes);
}

/**
 * Raised enclosure: four 2×2 corner legs from the ground to the roof, a solid floor up off the ground, solid
 * back and sides, a solid roof hinged along the back, and an open front closed with wire mesh between two rails.
 */
export function buildPetEnclosure(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const species = namedLumberFromPrompt(prompt);
  const mat = species ? CATALOG_LUMBER_BIND : PLY;
  const tiny = /hamster|gerbil|guinea|ferret|chinchilla|\brats?\b|mice|tortoise/.test(lower);
  const fowl = /chicken|\bhens?\b|duck|quail|coop/.test(lower);
  const [dw, dh, dd, dleg] = tiny ? [36, 30, 18, 12] : fowl ? [48, 48, 30, 18] : [48, 40, 24, 16];
  const typed = typedExtents(prompt);
  const tw = size?.width ?? typed?.width ?? typedAlong(lower, "wide|long|across");
  const th = size?.height ?? typed?.height ?? typedAlong(lower, "tall|high");
  const td = size?.depth ?? typed?.depth ?? typedAlong(lower, "deep");
  const W = r8(Math.max(18, tw ?? dw));
  const H = r8(Math.max(18, th ?? dh));
  const D = r8(Math.max(12, td ?? dd));
  const leg = r8(Math.max(4, Math.min(dleg * (H / dh), H - 2 * T - 10)));
  const L = 1.5;
  const inH = r8(H - 2 * T - leg);
  const panels: Panel[] = [];
  for (const [n, x, z] of [[1, 0, 0], [2, W - L, 0], [3, 0, D - L], [4, W - L, D - L]] as const) {
    panels.push(panel({ type: "upright", name: `Leg ${n}`, position: { x: r8(x), y: 0, z: r8(z) }, size: { width: L, height: r8(H - T), depth: L }, materialId: "lumber-2x2-8", cutNote: `2×2 from the ground to the roof; the sides, back and floor screw to it.` }));
  }
  const notch = panels.map((l) => ({ with: l.id, kind: "notch" as const }));
  panels.push(
    panel({ type: "bottom", name: "Floor", joints: notch, position: { x: 0, y: leg, z: 0 }, size: { width: W, height: T, depth: D }, materialId: mat, cutNote: "Notch each corner 1 ½\" × 1 ½\" around the legs; the sides, back and front rail stand on it." }),
    panel({ type: "side", name: "Left side", position: { x: 0, y: r8(leg + T), z: L }, size: { width: T, height: inH, depth: r8(D - 2 * L) }, materialId: mat }),
    panel({ type: "side", name: "Right side", position: { x: r8(W - T), y: r8(leg + T), z: L }, size: { width: T, height: inH, depth: r8(D - 2 * L) }, materialId: mat }),
    panel({ type: "back", name: "Back", position: { x: L, y: r8(leg + T), z: r8(D - T) }, size: { width: r8(W - 2 * L), height: inH, depth: T }, materialId: mat }),
    panel({ type: "rail", name: "Front bottom rail", position: { x: L, y: r8(leg + T), z: 0 }, size: { width: r8(W - 2 * L), height: 3.5, depth: T }, materialId: mat, cutNote: "Holds the bedding in and carries the bottom of the mesh." }),
    panel({ type: "rail", name: "Front top rail", position: { x: L, y: r8(H - T - 2.5), z: 0 }, size: { width: r8(W - 2 * L), height: 2.5, depth: T }, materialId: mat }),
    panel({ type: "top", name: "Roof", position: { x: 0, y: r8(H - T), z: 0 }, size: { width: W, height: T, depth: D }, materialId: mat, cutNote: "Hinged along the back edge so it lifts for feeding and cleaning." }),
  );
  const meshW = r8(W - 2 * L);
  const meshH = r8(inH - 3.5 - 2.5);
  const who = tiny ? (lower.match(/hamster|gerbil|guinea pig|ferret|chinchilla|rat|mice|tortoise/)?.[0] ?? "small animal") : fowl ? "chicken" : /rabbit|bunn/.test(lower) ? "rabbit" : whoFor(lower);
  const head = lower.match(/hutch|cage|coop|enclosure|house|home|cabinet|cupboard|crate|condo/)?.[0] ?? "hutch";
  const name = `${who[0].toUpperCase()}${who.slice(1)} ${head}`;
  const notes = [
    `${name}: a raised enclosure on four 2×2 legs with the floor ${inchFrac(leg)}" off the ground; solid floor, back, sides and roof, and a wire-mesh front. Inside ${inchFrac(r8(W - 2 * T))}" wide × ${inchFrac(inH)}" tall × ${inchFrac(r8(D - 2 * T))}" deep.`,
    `Front: staple ½" galvanized hardware cloth, ${inchFrac(meshW)}" × ${inchFrac(meshH)}", across the opening between the rails, into the legs and the side edges, with the cut edges folded under so they stay smooth.`,
    `Hinge the roof along the back edge with two 2" butt hinges so it lifts for feeding and cleaning. Drill a few ½" vent holes high in each side.`,
    species ? `${species.display} boards edge-glued for the floor, roof, back, sides and rails; each 1 ½" square leg is two ripped strips glued face to face.` : `¾" plywood for the floor, roof, back, sides and rails; the legs are 2×2.`,
  ];
  if (tw == null) notes.push(`Assumed ${inchFrac(W)}" wide — type a width to lock it.`);
  if (th == null) notes.push(`Assumed ${inchFrac(H)}" tall — type a height to lock it.`);
  if (td == null) notes.push(`Assumed ${inchFrac(D)}" deep — type a depth to lock it.`);
  return project(prompt, name, panels, mat, notes);
}
