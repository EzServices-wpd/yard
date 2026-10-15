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
import type { AssemblyStep, Panel, YardProject } from "./types";

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
 * Raised enclosure class (hutch, coop, cage). Outdoor ones (anything bigger than a small indoor pet's cage):
 * four ground-contact pressure-treated 4×4 legs; a pressure-treated 2×4 floor frame (rim on all four sides and
 * a middle joist) screwed between the legs, the floor sheet resting ON it and notched around the legs; exterior
 * plywood back, sides and roof; the roof hinged along the back edge (no screws through it) under roll roofing;
 * a front of hardware cloth between two rails. Indoor small-pet cages keep 2×2 legs and an indoor sheet.
 * A coop adds what hens need: a pop door hung on hinges from a stile, a nest box raised off the floor and a
 * flat 2×4 roost above it on two cleats.
 */
export const ENCLOSURE_NOTE = "Raised enclosure class:";
export function buildPetEnclosure(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const species = namedLumberFromPrompt(prompt);
  const mat = species ? CATALOG_LUMBER_BIND : PLY;
  const tiny = /hamster|gerbil|guinea|ferret|chinchilla|\brats?\b|mice|tortoise/.test(lower);
  const fowl = /chicken|\bhens?\b|duck|quail|coop/.test(lower);
  const outdoor = !tiny;
  const [dw, dh, dd, dleg] = tiny ? [36, 30, 18, 12] : fowl ? [48, 72, 36, 18] : [48, 40, 24, 16];
  const typed = typedExtents(prompt);
  const tw = size?.width ?? typed?.width ?? typedAlong(lower, "wide|long|across");
  const th = size?.height ?? typed?.height ?? typedAlong(lower, "tall|high");
  const td = size?.depth ?? typed?.depth ?? typedAlong(lower, "deep");
  const W = r8(Math.max(outdoor ? 24 : 18, tw ?? dw));
  const H = r8(Math.max(outdoor ? 30 : 18, th ?? dh));
  const D = r8(Math.max(outdoor ? 18 : 12, td ?? dd));
  const leg = r8(Math.max(outdoor ? 8 : 4, Math.min(dleg * (H / dh), H - 2 * T - 10)));
  const L = outdoor ? 3.5 : 1.5;
  const legMat = outdoor ? "lumber-4x4-8" : "lumber-2x2-8";
  const inH = r8(H - 2 * T - leg);
  const y0 = r8(leg + T);
  const panels: Panel[] = [];
  const legs: Panel[] = [];
  for (const [n, x, z] of [[1, 0, 0], [2, W - L, 0], [3, 0, D - L], [4, W - L, D - L]] as const) {
    legs.push(panel({ type: "upright", name: `Leg ${n}`, position: { x: r8(x), y: 0, z: r8(z) }, size: { width: L, height: r8(H - T), depth: L }, materialId: legMat, cutNote: outdoor ? "Ground-contact pressure-treated 4×4 from the ground to the roof; the floor frame screws between the legs." : "2×2 from the base to the roof; the sides, back and floor screw to it." }));
  }
  if (outdoor) for (const l of legs) l.structural = true;
  panels.push(...legs);
  if (outdoor) {
    // Floor frame: 2×4 on edge, its top at the floor's underside. Front and back rims run between the legs;
    // the side rims and the middle joist run between those.
    const fy = r8(leg - 3.5);
    panels.push(
      panel({ type: "rail", name: "Floor rim front", position: { x: L, y: fy, z: 0 }, size: { width: r8(W - 2 * L), height: 3.5, depth: 1.5 }, materialId: "lumber-2x4-8", cutNote: "Pressure-treated 2×4 on edge, screwed to both front legs." }),
      panel({ type: "rail", name: "Floor rim back", position: { x: L, y: fy, z: r8(D - 1.5) }, size: { width: r8(W - 2 * L), height: 3.5, depth: 1.5 }, materialId: "lumber-2x4-8", cutNote: "Pressure-treated 2×4 on edge, screwed to both back legs." }),
      panel({ type: "rail", name: "Floor rim left", position: { x: 0, y: fy, z: L }, size: { width: 1.5, height: 3.5, depth: r8(D - 2 * L) }, materialId: "lumber-2x4-8", cutNote: "Pressure-treated 2×4 on edge between the left legs." }),
      panel({ type: "rail", name: "Floor rim right", position: { x: r8(W - 1.5), y: fy, z: L }, size: { width: 1.5, height: 3.5, depth: r8(D - 2 * L) }, materialId: "lumber-2x4-8", cutNote: "Pressure-treated 2×4 on edge between the right legs." }),
      panel({ type: "rail", name: "Floor joist", position: { x: r8(W / 2 - 0.75), y: fy, z: 1.5 }, size: { width: 1.5, height: 3.5, depth: r8(D - 3) }, materialId: "lumber-2x4-8", cutNote: "Pressure-treated 2×4 on edge across the middle, front rim to back rim, so no floor span is over 24\"." }),
    );
    for (const q of panels) if (/^Floor (rim|joist)/.test(q.name)) q.structural = true;
  }
  const notch = legs.map((l) => ({ with: l.id, kind: "notch" as const }));
  const back = panel({ type: "back", name: "Back", position: { x: L, y: y0, z: r8(D - T) }, size: { width: r8(W - 2 * L), height: inH, depth: T }, materialId: mat });
  const stileX = r8(L + 12);
  const stile = panel({ type: "rail", name: "Door stile", position: { x: stileX, y: r8(y0 + 3.5), z: 0 }, size: { width: 1.5, height: r8(inH - 3.5 - 2.5), depth: T }, materialId: mat, cutNote: "Stands between the front rails; the pop door hangs on it and the mesh staples to it." });
  const coop = fowl && inH >= 40 && W >= 36 && D >= 24;
  panels.push(
    panel({ type: "bottom", name: "Floor", joints: notch, position: { x: 0, y: leg, z: 0 }, size: { width: W, height: T, depth: D }, materialId: mat, cutNote: `Notch each corner ${inchFrac(L)}" × ${inchFrac(L)}" around the legs; it rests on the floor frame and the sides, back and front rail stand on it.` }),
    panel({ type: "side", name: "Left side", position: { x: 0, y: y0, z: L }, size: { width: T, height: inH, depth: r8(D - 2 * L) }, materialId: mat }),
    panel({ type: "side", name: "Right side", position: { x: r8(W - T), y: y0, z: L }, size: { width: T, height: inH, depth: r8(D - 2 * L) }, materialId: mat }),
    back,
    panel({ type: "rail", name: "Front bottom rail", position: { x: L, y: y0, z: 0 }, size: { width: r8(W - 2 * L), height: 3.5, depth: T }, materialId: mat, cutNote: "Holds the bedding in and carries the bottom of the mesh." }),
    panel({ type: "rail", name: "Front top rail", position: { x: L, y: r8(H - T - 2.5), z: 0 }, size: { width: r8(W - 2 * L), height: 2.5, depth: T }, materialId: mat }),
  );
  const roof = panel({ type: "top", name: "Roof", position: { x: 0, y: r8(H - T), z: 0 }, size: { width: W, height: T, depth: D }, materialId: mat, cutNote: "Hinged to the top edge of the back so it lifts for feeding and cleaning; never screwed down." });
  roof.hinged = { to: back.id, edge: "back", hinges: 2 };
  const meshH = r8(inH - 3.5 - 2.5);
  const nest = 12;
  // Roost 24–30" (Penn State / heavy-bird range), the highest perch. A full 12" nest box sits under it:
  // its bottom 14–20" up, its top at least 1/2" below the roost's underside (F39).
  const roostY = r8(Math.max(y0 + 24, Math.min(y0 + 30, H - T - 2.5 - 10)));
  const nestUp = r8(Math.max(14, Math.min(20, roostY - y0 - 0.5 - 2 * T - nest)));
  const nestY = r8(y0 + nestUp);
  const lip = 2; // a 2" lip keeps the straw in and leaves a 10" opening on a 12" box
  // The roost is the highest perch: the nest top sits at least 1/2" below the roost's underside, so hens
  // sleep on the roost, not on the nest. The nest is 12" wide and deep and up to 12" tall (at least 8").
  const nestH = r8(Math.max(8, Math.min(12, roostY - 0.5 - (nestY + 2 * T))));
  const roostZ = 4;
  if (coop) {
    const door = panel({ type: "side", name: "Pop door", position: { x: r8(L + 0.0625), y: r8(y0 + 3.5 + 0.0625), z: 0 }, size: { width: r8(12 - 0.125), height: r8(Math.min(16, meshH) - 0.125), depth: T }, materialId: mat, cutNote: "Hung on two hinges from the stile with a 1/16\" gap all round; a barrel bolt keeps raccoons out at night." });
    door.hinged = { to: stile.id, edge: "right", hinges: 2, latch: "barrel bolt" };
    const nx = r8(W - T - nest - T);
    const nz = r8(D - T - nest);
    panels.push(
      stile,
      door,
      panel({ type: "rail", name: "Nest cleat side", position: { x: r8(W - T - 1.5), y: r8(nestY - 3), z: nz }, size: { width: 1.5, height: 3, depth: nest }, materialId: "lumber-2x4-8", cutNote: "Screwed to the right side; the nest bottom rests on it." }),
      panel({ type: "rail", name: "Nest cleat back", position: { x: nx, y: r8(nestY - 3), z: r8(D - T - 1.5) }, size: { width: r8(nest + T - 1.5), height: 3, depth: 1.5 }, materialId: "lumber-2x4-8", cutNote: "Screwed to the back; the nest bottom rests on it." }),
      panel({ type: "bottom", name: "Nest box bottom", position: { x: nx, y: nestY, z: nz }, size: { width: r8(nest + T), height: T, depth: nest }, materialId: mat, cutNote: `Rests on the two nest cleats, ${inchFrac(nestUp)}" up off the coop floor, reaching the right wall and notched around the back-right leg.` }),
      panel({ type: "side", name: "Nest box side", position: { x: nx, y: r8(nestY + T), z: nz }, size: { width: T, height: nestH, depth: r8(nest - T) }, materialId: mat, cutNote: `Stands on the nest bottom; with the right side and back it makes a ${nest}" × ${nest}" nest, ${inchFrac(nestH)}" tall.` }),
      panel({ type: "side", name: "Nest box lip", position: { x: r8(nx + T), y: r8(nestY + T), z: r8(nz) }, size: { width: nest, height: lip, depth: T }, materialId: mat, cutNote: `Holds the nesting straw in; ${inchFrac(r8(nestH - lip))}" of opening stays clear above it.` }),
      panel({ type: "top", name: "Nest box top", position: { x: nx, y: r8(nestY + T + nestH), z: nz }, size: { width: r8(nest + T), height: T, depth: nest }, materialId: mat, cutNote: "Rests on the nest side, below the roost, so hens roost on the roost and not on the nest." }),
      panel({ type: "rail", name: "Roost cleat left", position: { x: T, y: r8(roostY - 3), z: roostZ }, size: { width: 1.5, height: 3, depth: 3.5 }, materialId: "lumber-2x4-8", cutNote: "Screwed to the left side; one end of the roost rests on it." }),
      panel({ type: "rail", name: "Roost cleat right", position: { x: r8(W - T - 1.5), y: r8(roostY - 3), z: roostZ }, size: { width: 1.5, height: 3, depth: 3.5 }, materialId: "lumber-2x4-8", cutNote: "Screwed to the right side; the other end of the roost rests on it." }),
      panel({ type: "rail", name: "Roost", position: { x: r8(T + 0.25), y: roostY, z: roostZ }, size: { width: r8(W - 2 * T - 0.5), height: 1.5, depth: 3.5 }, materialId: "lumber-2x4-8", cutNote: "A 2×4 laid flat, 3 1/2\" face up, so hens cover their toes in winter. Higher than the nest box, at the front, away from it." }),
    );
  }
  panels.push(roof);
  const meshW = r8(W - 2 * L - (coop ? 12 + 1.5 : 0));
  const who = tiny ? (lower.match(/hamster|gerbil|guinea pig|ferret|chinchilla|rat|mice|tortoise/)?.[0] ?? "small animal") : fowl ? "chicken" : /rabbit|bunn/.test(lower) ? "rabbit" : whoFor(lower);
  const head = lower.match(/hutch|cage|coop|enclosure|house|home|cabinet|cupboard|crate|condo/)?.[0] ?? "hutch";
  const name = `${who[0].toUpperCase()}${who.slice(1)} ${head}`;
  const hinges = outdoor ? (coop ? "four" : "two") : (coop ? "four" : "two");
  const notes = [
    `${ENCLOSURE_NOTE} ${outdoor ? "outdoor" : "indoor"}${coop ? " coop" : ""}.`,
    `${name}: a raised enclosure on four ${outdoor ? "ground-contact pressure-treated 4×4" : "2×2"} legs with the floor ${inchFrac(leg)}" off the ground${outdoor ? " on a pressure-treated 2×4 floor frame (rim on all four sides and a middle joist)" : ""}; solid floor, back, sides and roof, and a wire-mesh front. Inside ${inchFrac(r8(W - 2 * T))}" wide × ${inchFrac(inH)}" tall × ${inchFrac(r8(D - 2 * T))}" deep.`,
    ...(outdoor ? [`Floor frame joints take 3" structural screws, three at each rim-to-leg joint.`] : []),
    `Front: staple ½" galvanized hardware cloth, ${inchFrac(meshW)}" × ${inchFrac(meshH)}", across the opening between the rails, into the legs and the side edges, with the cut edges folded under so they stay smooth.`,
    outdoor
      ? `Hinge the roof to the top edge of the back with two 3–4" galvanized T-hinges and fit a lid stay (or a short chain) so it stays open and closes gently; the only screws in the roof are the hinge screws.${coop ? " Hang the pop door on its stile with two 2\" galvanized butt hinges and close it with 1 3\" barrel bolt at night." : ""} Drill a few ½" vent holes high in each side and staple hardware cloth over them.`
      : `Hinge the roof to the top edge of the back${coop ? ", and the pop door to its stile," : ""} with ${hinges} 2" butt hinges in all; the roof lifts for feeding and cleaning and takes no screws.${coop ? " Close the pop door with 1 3\" barrel bolt at night." : ""} Drill a few ½" vent holes high in each side and staple hardware cloth over them.`,
    ...(outdoor ? [`Cover the roof with 1 roll of mineral-surfaced roll roofing, lapped over the edges and fixed with galvanized roofing nails.`] : []),
    ...(coop ? [`Inside: a ${nest}" nest box raised ${inchFrac(nestUp)}" off the floor in the back right corner (one is enough for up to 4 hens) and a flat 2×4 roost at the front, ${inchFrac(r8(roostY - y0))}" above the floor on two cleats, higher than the nest so hens sleep on the roost, not in the nest. About ${Math.max(1, Math.floor((W - 2 * T) / 10))} hens fit on the roost at 10" each.`] : []),
    species ? `${species.display} boards edge-glued for the floor, roof, back, sides and rails.` : outdoor ? `¾" exterior plywood for the floor, roof, back, sides and rails; pressure-treated 4×4 legs and a 2×4 floor frame.` : `¾" plywood for the floor, roof, back, sides and rails; the legs are 2×2.`,
  ];
  if (tw == null) notes.push(`Assumed ${inchFrac(W)}" wide — type a width to lock it.`);
  if (th == null) notes.push(`Assumed ${inchFrac(H)}" tall — type a height to lock it.`);
  if (td == null) notes.push(`Assumed ${inchFrac(D)}" deep — type a depth to lock it.`);
  return project(prompt, name, panels, mat, notes);
}

/** Steps for the raised-enclosure class, from its parts: each part goes in after what it fastens to. */
export function enclosureSteps(project: YardProject): AssemblyStep[] | null {
  const note = (project.notes ?? []).find((n) => n.startsWith(ENCLOSURE_NOTE));
  if (!note) return null;
  const outdoor = /outdoor/.test(note);
  const names = (re: RegExp) => project.panels.filter((p) => re.test(p.name)).map((p) => p.name);
  const has = (re: RegExp) => names(re).length > 0;
  const o = project.overall;
  const fix = outdoor ? "#8 × 2 1/2\" exterior screws" : "#8 × 1 1/4\" screws";
  const frameFix = outdoor ? '3" exterior structural screws (or 3/8" × 4" galvanized carriage bolts with a nut and washer)' : fix;
  const steps: Omit<AssemblyStep, "step">[] = [
    { title: "Confirm the footprint — do not cut yet", description: `${project.name}. ${inchFrac(o.width)}" wide × ${inchFrac(o.depth)}" deep × ${inchFrac(o.height)}" high. Freestanding on four legs. ${outdoor ? "Pick a level, well-drained spot; the legs stand on the ground." : "Set it on a level floor."}`, partsUsed: ["*"] },
    { title: "Cut every part to its mark", description: "Square every cut. Cut the floor's corner notches before it goes on. Sand the edges the animals touch.", partsUsed: ["*"] },
    outdoor
      ? { title: "Stand the legs and screw the floor frame between them", description: `Stand the 4 legs at the corners. Fasten the front and back rims to the legs with three ${frameFix} at each end, then fit the two side rims and the middle joist between the rims, all tops level at the floor's underside. Use ${frameFix} at every frame joint. No #8 screws in the frame: they are too short through a 1 1/2" rim into a 4×4.`, partsUsed: [...names(/^Leg /), ...names(/^Floor (rim|joist)/)] }
      : { title: "Stand the 4 legs", description: "Stand the 4 legs at the corners, square to each other.", partsUsed: names(/^Leg /) },
    { title: outdoor ? "Lay the floor on the frame" : "Fit the floor between the legs", description: `Set the floor${outdoor ? " on the rims and the joist" : ""}, its notched corners around the legs. Screw it down${outdoor ? " into the frame every 8\"" : " to each leg"} with ${fix}.`, partsUsed: ["Floor"] },
    { title: "Stand the sides and the back on the floor", description: `Stand the left and right sides and the back on the floor, screwed to the legs and down through the floor, with ${fix}.`, partsUsed: [...names(/^(Left|Right) side$/), "Back"] },
  ];
  const cleats = names(/cleat/);
  if (cleats.length) steps.push({ title: "Screw the cleats to the sides and back", description: `Screw the ${cleats.map((c) => c.toLowerCase()).join(", ")} to the inside faces, tops level at their marks, with ${fix}. Nothing rests on them yet.`, partsUsed: cleats });
  if (has(/^Nest box/)) steps.push({ title: "Build the raised nest box on its cleats", description: `Set the nest bottom on the two nest cleats, ${inchFrac(r8(nestBottomUp(project)))}" up off the floor, its notched corner around the back-right leg. Stand the nest side on it, screw the lip across the front, and set the top on the side and the right wall. ${fix}.`, partsUsed: names(/^Nest box/) });
  if (has(/^Roost$/)) steps.push({ title: "Set the roost on both cleats", description: `Lay the 2×4 roost flat, 3 1/2" face up, with one end on each roost cleat. Screw down through it into each cleat with ${fix}.`, partsUsed: ["Roost"] });
  steps.push({ title: has(/^Door stile$/) ? "Fit the front rails and the door stile" : "Fit the front rails", description: `Screw the front bottom rail and the front top rail between the front legs${has(/^Door stile$/) ? ", then the door stile between the two rails" : ""}, with ${fix}.`, partsUsed: [...names(/^Front (bottom|top) rail$/), ...names(/^Door stile$/)] });
  steps.push({ title: "Staple the hardware cloth and drill the vents", description: `Staple ½" galvanized hardware cloth across the front opening between the rails${has(/^Door stile$/) ? " and the stile" : ""}, every 2", the cut edges folded under. Drill a few ½" vent holes high in each side and staple a patch of hardware cloth over them inside.`, partsUsed: [] });
  for (const p of project.panels.filter((x) => x.hinged)) {
    const to = project.panels.find((x) => x.id === p.hinged!.to)?.name.toLowerCase() ?? "its frame";
    steps.push({
      title: `Hang the ${p.name.toLowerCase()} on ${p.hinged!.hinges} hinges`,
      description: /^Roof$/.test(p.name) && outdoor
        ? `Set the roof in place and screw two 3–4" galvanized T-hinges along its back edge to the back. Fit a lid stay (or a short chain) so the roof can\'t slam shut. No screws go through the roof into anything else, so it opens. Then cover the roof with the roll roofing, lapped over the edges, fixed with galvanized roofing nails.`
        : `Set the ${p.name.toLowerCase()} in place and screw ${p.hinged!.hinges} 2" galvanized butt hinges along its ${p.hinged!.edge} edge to the ${to}. No screws go through the ${p.name.toLowerCase()} into anything else, so it opens.${p.hinged!.latch ? ` Fit the ${p.hinged!.latch} on its free edge so it locks shut.` : ""}`,
      partsUsed: [p.name],
    });
  }
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

/** Height of the nest bottom above the coop floor, read from the model. */
function nestBottomUp(project: YardProject): number {
  const b = project.panels.find((p) => p.name === "Nest box bottom");
  const f = project.panels.find((p) => p.name === "Floor");
  return b && f ? b.position.y - (f.position.y + f.size.height) : 0;
}
