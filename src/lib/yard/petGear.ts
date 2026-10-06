/**
 * Gear whose head noun is the thing and whose animal word only says who it is for ("dog ramp",
 * "cat scratching post"). An access ramp is a sloped deck on two tapered sides with a support across the
 * high end, at the typed height. A scratching post is a doubled base with an upright post.
 * Panel positions are the min corner; x runs along the build, y is up, z is across.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { CATALOG_LUMBER_BIND, namedLumberFromPrompt } from "./namedLumberSpecies";
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
