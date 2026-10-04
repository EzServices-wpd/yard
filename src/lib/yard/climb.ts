/**
 * Human climb builds: step stools, kitchen steps, library and loft ladders.
 * One panel model for every climb prompt: real treads at the typed height, adult-load sections
 * (2×2 posts, 2×4 rails, ¾" plywood treads; or the named species' boards), a base footprint that
 * stays put when you lean, and a handrail when the prompt asks for one.
 * Panel positions are the min corner; front = +z.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { CATALOG_LUMBER_BIND, namedLumberFromPrompt } from "./namedLumberSpecies";
import { panelWorldCorners } from "./geometry";
import type { Panel, YardProject } from "./types";
import { climbRiseRun, climbStepCount } from "./weekendFamily";

const r16 = (n: number) => Math.round(n * 16) / 16;
const UNIT = String.raw`(?:in|inch|inches|"|″|ft|feet|foot)`;

function typedAlong(lower: string, words: string): number | null {
  const m = lower.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*-?\s*(${UNIT})?\s*(?:${words})\b`));
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] && /ft|feet|foot/.test(m[2]) ? n * 12 : n;
}

const CRAFT = /popsicle|craft\s*sticks?|\bstraws?\b|toothpicks?|\bpaper\b|cardboard|pipe\s*cleaners?|\blego\b|\bclay\b|skewers?|\bpvc\b|\bpipe\b|\bdowels?\b|\bwire\b/;
const SMALL = /\btoy\b|\bdoll|barbie|\bmini(?:ature)?\b|\bmodel\b|\bpet\b|\bdog\b|\bcat\b|\bbunny\b|hamster|\bbird\b|\bfairy\b|figurine/;
const NOT_CLIMB = /towel|blanket|ladder\s*shel|shelf\s*ladder|bookcase|bookshelf|linen|closet|wardrobe|pantry|desk|cabinet|planter|plant\s*stand|climb(?:ing)?\s*triangle|pikler|step\s*triangle|trellis|step\s*ladder\s*shel/;

export type ClimbKind = "stool" | "ladder";

/** Which human climb build the prompt names, or null. Generic "ladder" / "ladder from 2x4" stays on the stick path. */
export function climbKind(prompt: string): ClimbKind | null {
  const lower = prompt.toLowerCase().replace(/[–—]/g, "-");
  if (CRAFT.test(lower) || SMALL.test(lower) || NOT_CLIMB.test(lower)) return null;
  if (/\b(?:library|loft|attic|ship'?s|bunk(?:\s*bed)?)\s+ladder\b/.test(lower)) {
    if (/\bbed\b/.test(lower) && !/bed\s+ladder/.test(lower)) return null;
    return "ladder";
  }
  if (/\bbench\b|\bbed\b|\btable\b|\bchair\b/.test(lower) && !/step\s*stool|step-?up|two-?\s*step|three-?\s*step/.test(lower)) return null;
  if (
    /step\s*-?\s*stool|step-?up|kitchen\s+steps?\b|library\s+steps\b|climb\s+(?:step|stool)|\b(?:one|two|three|four|[1-4])\s*-?\s*step\s+(?:stool|climb|stand)|shop\s+stool[^.;]*climb|one\s+climb\s+step|rise\s*(?:[×x]|by|and)[^.;]*run[^.;]*(?:kid|adult|stand|tread)/.test(lower)
  ) {
    return "stool";
  }
  return null;
}

const SPECIES_FOR_CLIMB = (prompt: string) => {
  const s = namedLumberFromPrompt(prompt);
  return s ? s : null;
};

type Mk = (p: Omit<Panel, "id">) => Panel;

/** The stool's treads from the prompt: count, top tread height, rise, run, width. Same numbers the model draws. */
export function stoolLayout(prompt: string, sizeOverride?: { width: number; height: number; depth: number }) {
  const lower = prompt.toLowerCase().replace(/[–—]/g, "-");
  const rr = climbRiseRun(prompt);
  const said = climbStepCount(prompt);
  const explicitOne = /\bone-?\s*step|single\s+step|one\s+climb\s+step|step-?up\b|\b1\s*-?\s*step\b/.test(lower) &&
    !/two|three|four|\b[2-8]\s*-?\s*steps?\b/.test(lower);
  const explicitCount = explicitOne || /\b(?:two|three|four|[2-8])\s*-?\s*(?:steps?|treads?)\b/.test(lower);
  const handrail = /hand\s*-?\s*rails?|grab\s*(?:bar|rail)|\bgrip\b|safety\s+rail/.test(lower);
  const railRise = Math.max(12, typedAlong(lower, "(?:hand\\s*-?\\s*)?rail") ?? 24);
  let H = sizeOverride ? sizeOverride.height - (handrail ? railRise : 0) : typedAlong(lower, "tall|high|to\\s+the\\s+top");
  if (!H) {
    const bare = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/);
    if (bare && !/\b(?:wide|width|deep|depth|long|length)\b/.test(lower)) H = parseFloat(bare[1]);
  }
  let n = explicitOne ? 1 : Math.max(1, said);
  if (H && H > 0) {
    if (!explicitCount) n = Math.max(1, Math.ceil(H / 9));
  } else if (rr) {
    H = n * rr.rise;
  } else {
    if (!explicitCount) n = 2;
    H = n * 9;
  }
  H = r16(Math.max(4, H));
  n = Math.max(1, Math.min(6, n));
  const rise = H / n;
  const run = r16(Math.max(7, rr?.run ?? (sizeOverride && n > 1 ? (sizeOverride.depth - 11) / (n - 1) : 11)));
  const topD = r16(Math.max(10, n === 1 && sizeOverride ? sizeOverride.depth : run));
  let W = r16(sizeOverride?.width ?? typedAlong(lower, "wide|long|across") ?? 16);
  W = r16(Math.max(14, W, H * 0.5));
  const tallRail = n >= 4;
  return { H, n, rise, run, topD, W, handrail: handrail || tallRail, railRise, railRecommended: tallRail && !handrail };
}

/** "9" rise × 11" run" for a stool prompt — the numbers the model is built to. */
export function stoolRiseRunTalk(prompt: string): string | null {
  if (climbKind(prompt) !== "stool") return null;
  const l = stoolLayout(prompt);
  return `${inchFrac(r16(l.rise))}" rise × ${inchFrac(l.run)}" run`;
}

/** How many treads the stool model has (a bare "step stool" builds two). */
export function stoolStepCount(prompt: string): number {
  return climbKind(prompt) === "stool" ? stoolLayout(prompt).n : Math.max(1, climbStepCount(prompt));
}

function stoolPanels(prompt: string, sizeOverride?: { width: number; height: number; depth: number }) {
  const species = SPECIES_FOR_CLIMB(prompt);
  const { H, n, rise, run, topD, W, handrail, railRise } = stoolLayout(prompt, sizeOverride);
  // Sections
  const post = 1.5;
  const railT = species ? 0.75 : 1.5;
  const railH = 3.5;
  const T = 0.75;
  const postId = species ? CATALOG_LUMBER_BIND : "lumber-2x2-8";
  const railId = species ? CATALOG_LUMBER_BIND : "lumber-2x4-8";
  const treadId = species ? CATALOG_LUMBER_BIND : "plywood-3-4-4x8";
  const top = (t: number) => r16((t + 1) * rise);
  // Tread t (0 = lowest, front). The top tread spans z 0..topD; each lower tread steps forward by `run`.
  const zf = (t: number) => r16(topD + (n - 1 - t) * run);
  const D = zf(0);
  const panels: Panel[] = [];
  const mk: Mk = (p) => {
    const q = { id: createId("panel"), ...p } as Panel;
    panels.push(q);
    return q;
  };
  const sides = [
    ["left", 0],
    ["right", r16(W - post)],
  ] as const;
  // Back posts carry the top tread; one pair of posts at every tread's front edge carries that tread.
  for (const [side, x] of sides) {
    const hb = r16(H - T);
    mk({ type: "upright", name: `Leg back ${side}`, position: { x, y: 0, z: 0 }, size: { width: post, height: hb, depth: post }, materialId: postId, cutNote: `${inchFrac(hb)}" post, square ends; the top tread screws down onto it.` });
    for (let t = 0; t < n; t++) {
      const h = r16(top(t) - T);
      mk({ type: "upright", name: n === 1 ? `Leg front ${side}` : `Leg front ${side} ${t + 1}`, position: { x, y: 0, z: r16(zf(t) - post) }, size: { width: post, height: h, depth: post }, materialId: postId, cutNote: `${inchFrac(h)}" post under the front of step ${t + 1}.` });
    }
  }
  for (let t = 0; t < n; t++) {
    const ty = r16(top(t) - T);
    const ry = r16(ty - railH);
    const zBack = t === n - 1 ? 0 : zf(t + 1);
    const lower = t < n - 1;
    // Front rail between the front posts.
    mk({ type: "rail", name: `Step ${t + 1} front rail`, position: { x: post, y: ry, z: r16(zf(t) - railT) }, size: { width: r16(W - 2 * post), height: railH, depth: railT }, materialId: railId, cutNote: "On edge between the front posts, flush with their tops; the tread screws down into it." });
    if (lower) {
      // Back rail runs the full width across the front faces of the taller posts behind it.
      mk({ type: "rail", name: `Step ${t + 1} back rail`, position: { x: 0, y: ry, z: zBack }, size: { width: W, height: railH, depth: railT }, materialId: railId, cutNote: "On edge across the front faces of the taller posts; screw into each post." });
    } else {
      mk({ type: "rail", name: `Step ${t + 1} back rail`, position: { x: post, y: ry, z: r16(post - railT) }, size: { width: r16(W - 2 * post), height: railH, depth: railT }, materialId: railId, cutNote: "On edge between the back posts, flush with their tops." });
    }
    const sz0 = r16(lower ? zBack + railT : post);
    const sz1 = r16(zf(t) - post);
    for (const [side, x] of sides) {
      if (sz1 - sz0 < 1) continue;
      mk({ type: "rail", name: `Step ${t + 1} ${side} side rail`, position: { x: side === "left" ? 0 : r16(W - railT), y: ry, z: sz0 }, size: { width: railT, height: railH, depth: r16(sz1 - sz0) }, materialId: railId, cutNote: "On edge between the posts on this side, flush with their tops." });
    }
    const tz = zBack;
    const td = r16(zf(t) - tz);
    mk({ type: "top", name: n === 1 ? "Tread" : t === n - 1 ? "Top tread" : `Tread ${t + 1}`, position: { x: 0, y: ty, z: tz }, size: { width: W, height: T, depth: td }, materialId: treadId, cutNote: `${inchFrac(W)}" × ${inchFrac(td)}" tread; ease the front edge and screw down into the posts and rails.` });
  }
  // Floor rails tie every post on a side together when there is room under the lowest rail.
  const lowestRail = r16(top(0) - T - railH);
  if (n > 1 && lowestRail >= 3.5) {
    for (const [side] of sides) {
      mk({ type: "rail", name: `Floor rail ${side}`, position: { x: side === "left" ? post : r16(W - 2 * post), y: 1.5, z: 0 }, size: { width: post, height: post, depth: D }, materialId: postId, cutNote: "Screws to the inside face of every post on this side, 1 1/2\" off the floor." });
    }
  }
  if (handrail) {
    const gy = r16(H + railRise);
    for (const [side, x] of [["left", -post], ["right", W]] as const) {
      mk({ type: "upright", name: `Handrail post ${side}`, position: { x, y: 0, z: 0 }, size: { width: post, height: r16(gy - post), depth: post }, materialId: postId, cutNote: `${inchFrac(gy - post)}" post bolted to the outside of the back post, floor to the grip.` });
    }
    mk({ type: "rail", name: "Handrail grip", position: { x: -post, y: r16(gy - post), z: 0 }, size: { width: r16(W + 2 * post), height: post, depth: post }, materialId: postId, cutNote: "Grip across the tops of the handrail posts; round over every edge you hold." });
  }
  return { panels, H, n, rise: r16(rise), run, topD, W, D, handrail, railRise, species, primary: species ? CATALOG_LUMBER_BIND : treadId };
}

function ladderPanels(prompt: string, sizeOverride?: { width: number; height: number; depth: number }) {
  const lower = prompt.toLowerCase();
  const loft = /\b(?:loft|attic|bunk)/.test(lower);
  const species = SPECIES_FOR_CLIMB(prompt);
  const handrail = /hand\s*-?\s*rails?|grab\s*(?:bar|rail)|\bgrip\b/.test(lower);
  const railRise = Math.max(12, typedAlong(lower, "(?:hand\\s*-?\\s*)?rail") ?? 30);
  const typedH = sizeOverride ? sizeOverride.height - (handrail ? railRise : 0) : typedAlong(lower, "tall|high|to\\s+the\\s+(?:top|loft|deck)");
  const H = r16(Math.max(24, typedH ?? (loft ? 60 : 48)));
  const W = r16(Math.max(16, sizeOverride?.width ?? typedAlong(lower, "wide|across") ?? 18));
  const lean = (75 * Math.PI) / 180;
  const T = 1.5; // stringer thickness
  const S = 9.25; // 2×10 stringer face
  const treadT = 0.75;
  const topD = 10;
  const n = Math.max(2, Math.round(H / 10));
  const rise = H / n;
  const sH = r16(H + (handrail ? railRise : 0));
  const across = S / Math.sin(lean); // horizontal width of the stringer
  const runOut = sH / Math.tan(lean);
  // Side profile (z, y): the back edge leans on the wall at z = 0 at the top; the foot is at z = runOut.
  const pts: [number, number][] = [
    [0, 0],
    [r16(across), 0],
    [r16(across - runOut), sH],
    [r16(-runOut), sH],
  ];
  const minZ = Math.min(...pts.map((p) => p[0]));
  const shift = -minZ;
  const prof = pts.map(([z, y]) => [r16(z + shift), y] as [number, number]);
  const span = r16(Math.max(...prof.map((p) => p[0])));
  // Local xy polygon is the profile; yaw π/2 turns local +x to world −z, so mirror x.
  const localPts = prof.map(([z, y]) => [r16(span - z), y] as [number, number]);
  const stringerId = "lumber-2x10-8";
  const treadId = species ? CATALOG_LUMBER_BIND : "plywood-3-4-4x8";
  const panels: Panel[] = [];
  const mk: Mk = (p) => {
    const q = { id: createId("panel"), ...p } as Panel;
    panels.push(q);
    return q;
  };
  const len = r16(Math.hypot(runOut, sH) + across * Math.cos(lean));
  for (const [side, x] of [["left", 0], ["right", r16(W - T)]] as const) {
    // A yawed panel turns about its center: lay the box so after the turn it spans x..x+T, z 0..span.
    const cx = x + T / 2;
    const cz = span / 2;
    mk({
      type: "upright",
      name: `Stringer ${side}`,
      position: { x: r16(cx - span / 2), y: 0, z: r16(cz - T / 2) },
      size: { width: span, height: sH, depth: T },
      yaw: Math.PI / 2,
      polygon: { plane: "xy", pts: localPts },
      blank: { lengthIn: r16(len), widthIn: S, thicknessIn: T },
      materialId: stringerId,
      cutNote: `2×10 cut at 75°: level cuts at the foot and the top, ${inchFrac(len)}" long.`,
    } as Omit<Panel, "id">);
  }
  // Front edge of the stringer at height y (z grows toward the room).
  const frontZ = (y: number) => r16(shift + across - (y / sH) * runOut);
  const backZ = (y: number) => r16(shift - (y / sH) * runOut);
  for (let k = 1; k <= n; k++) {
    const y = r16(k * rise);
    const ty = r16(y - treadT);
    const last = k === n;
    const z0 = backZ(y);
    const depth = last ? r16(Math.max(topD, frontZ(y) - z0)) : r16(Math.max(5.5, frontZ(y) - backZ(ty) - 0.5));
    const z1 = Math.max(0, r16(Math.min(z0, frontZ(y) - depth)));
    mk({ type: "top", name: last ? "Top tread" : `Tread ${k}`, position: { x: T, y: ty, z: z1 }, size: { width: r16(W - 2 * T), height: treadT, depth }, materialId: treadId, cutNote: `${inchFrac(W - 2 * T)}" × ${inchFrac(depth)}" tread set level between the stringers on glued and screwed cleats.` });
  }
  return { panels, H, n, rise: r16(rise), run: r16(runOut / n), topD, W, D: span, handrail, railRise, species, primary: stringerId, loft, runOut: r16(runOut) };
}

/** Build the climb project for a prompt `climbKind` accepted. */
export function buildClimb(prompt: string, kind: ClimbKind, sizeOverride?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const adult = /\badult|grown-?up|\bshop\b/.test(lower);
  const notes: string[] = [];
  let name: string;
  let built: ReturnType<typeof stoolPanels> | ReturnType<typeof ladderPanels>;
  if (kind === "stool") {
    const s = stoolPanels(prompt, sizeOverride);
    built = s;
    name = s.n === 1 ? "Step stool" : `Step stool with ${s.n} steps`;
    if (s.handrail) name += " and handrail";
    const heights = Array.from({ length: s.n }, (_, t) => `${inchFrac(r16((t + 1) * s.rise))}"`).join(", ");
    notes.push(
      `${name}: ${s.n === 1 ? "one weight-bearing climb tread" : `${s.n} weight-bearing climb treads`} — top tread at ${inchFrac(s.H)}", ${inchFrac(s.W)}" wide × ${inchFrac(s.topD)}" deep.${s.n > 1 ? ` Tread tops at ${heights}.` : ""}`,
      `Each step: ${inchFrac(s.rise)}" rise × ${inchFrac(s.run)}" run. The base is ${inchFrac(s.D)}" deep, so it stays planted when you lean.`,
      s.species
        ? `${s.species.display} boards throughout: posts laminated from two strips, rails on edge, treads edge-glued from the boards.`
        : "2×2 posts at every tread edge, 2×4 rails on edge under every tread, ¾\" plywood treads. Glue and screw every joint.",
      adult
        ? "Built for an adult: an adult stands on the top tread, carried by four posts straight to the floor."
        : "Built to carry a grown-up, so a kid standing on it is well inside its strength.",
    );
    if (s.handrail) notes.push(`Handrail grip ${inchFrac(s.railRise)}" above the top tread — hold it while climbing. Bolt the handrail posts to the back posts with two 3/8" carriage bolts each.`);
    if (/\b(kid|kids|child|toddler|bathroom|bath)\b/.test(lower)) {
      notes.push("Round every corner a child can bump. Stick a non-slip pad under each foot. A bathroom stool gets a water-resistant finish.");
    }
  } else {
    const l = ladderPanels(prompt, sizeOverride);
    built = l;
    name = l.loft ? "Loft ladder" : "Library ladder";
    if (l.handrail) name += " with handrail";
    notes.push(
      `${name}: leans at 75°, foot ${inchFrac(l.runOut)}" out from the wall. ${l.n} weight-bearing climb treads, ${inchFrac(l.rise)}" apart; top tread at ${inchFrac(l.H)}", ${inchFrac(l.topD)}" deep.`,
      "2×10 stringers with level cuts at the foot and the top, treads glued and screwed onto cleats between them.",
      l.loft
        ? "Hook the top over the loft edge with two steel ladder hooks, and set rubber feet under the stringers."
        : "Set rubber feet under the stringers; screw a cleat to the shelf or wall the top rests on.",
    );
    if (l.handrail) notes.push(`The stringers run ${inchFrac(l.railRise)}" past the top tread as a handrail — hold them while climbing.`);
  }
  const panels = built.panels;
  const xs = panels.flatMap((p) => panelWorldCorners(p).map((c) => c.x));
  const minX = Math.min(...xs);
  if (minX < 0) for (const p of panels) p.position = { ...p.position, x: r16(p.position.x - minX) };
  const W = r16(Math.max(...xs) - minX);
  const Hall = r16(Math.max(...panels.map((p) => p.position.y + p.size.height)));
  const typedTall = /\d\s*-?\s*(?:in|inch|inches|"|″|ft|feet|foot)?\s*(?:tall|high)\b/.test(lower);
  if (!typedTall && !sizeOverride) notes.push(`Assumed ${inchFrac(built.H)}" to the top tread — type a height to lock it.`);
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "custom",
    overall: { width: W, height: Hall, depth: built.D },
    instances: [],
    panels,
    primaryMaterialId: built.primary,
    notes,
    climb: { kind, topTreadIn: built.H, steps: built.n, handrailIn: built.handrail ? built.railRise : 0 },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  } as YardProject;
}
