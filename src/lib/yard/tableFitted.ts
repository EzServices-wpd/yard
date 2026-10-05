/**
 * Freestanding table — round / oval / square / rect top, 2x2 legs under the top, aprons inside the legs.
 *
 * Global apron rule (every table this builder emits):
 * - rails sit on the inner faces of the posts, spanning post-to-post
 * - never a diagonal of the top AABB (the old 55.25" yaw-blind lie)
 * - never a stretcher floating mid-span off the 2x2s
 * - never longer than the inner span (nothing past the posts or the top)
 * - 3-leg chords inset toward the centroid so apron bulk stays inside the
 *   post triangle — a centerline chord reads as bars past the posts
 * - yaw is Three.js Y-up (atan2(-dz, dx)) so chords render post-to-post, not a radial Y
 *
 * Spoken lower shelf / N shelves (shelfCount ≥ 1, or prompt densify when the AI
 * brief drops it): one plywood shelf per count under the top, clear of leg faces
 * (same inset as aprons), seated on ¾" ply shelf rails matching apron style.
 * Bare tables without a spoken shelf never invent one.
 */
import { createId } from "@/lib/utils";
import type { FittedSpec, Panel, YardProject } from "./types";
import { namedLegLumberFromPrompt, namedLumberFromPrompt } from "./namedLumberSpecies";
import { isSideEndTable } from "./family";
import { countBridge } from "./fittedShared";

const PLY = "plywood-3-4-4x8";
const TWO_BY_TWO = "lumber-2x2-8";

function legStock(prompt: string): { id: string; face: number; note: string } {
  const lower = prompt.toLowerCase();
  // Notes come from the real stock: named wood builds have no sheet to nest on.
  const body = namedLumberFromPrompt(prompt);
  const leg = namedLegLumberFromPrompt(prompt);
  const bodyVoice = body ? `The top and aprons are cut from ${body.densifyLabel} boards.` : "Aprons nest on the 3/4\" sheet.";
  if (/4\s*[x×]\s*4/.test(lower) && /leg|post/.test(lower)) {
    return {
      id: "lumber-4x4-8",
      face: 3.5,
      note: `Legs are 3-1/2" square (4x4 actual), buy 4x4 posts. ${bodyVoice}`,
    };
  }
  if (leg) {
    return {
      id: TWO_BY_TWO,
      face: 1.5,
      note: `Legs are 1-1/2" square ${leg.display.toLowerCase()} — each one is two 1-1/2" strips ripped from ${leg.densifyLabel} boards and face-glued. ${bodyVoice} Legs stay under the top.`,
    };
  }
  return {
    id: TWO_BY_TWO,
    face: 1.5,
    note: `Legs are 1-1/2" square (2x2 actual) — buy 2x2 lumber. ${bodyVoice} Legs stay under the top.`,
  };
}
const P = 0.75;

/**
 * Every table built from untyped sizes says what it assumed, in one finished size: the top as
 * built (overhang included) and the height. Side / end tables keep their sofa-arm reason.
 */
function tableAssumedNote(prompt: string, W: number, D: number, H: number, round: boolean): string[] {
  const lower = prompt.toLowerCase();
  if (/\d/.test(lower.replace(/\b\d+\s*(?:legs?|shel(?:f|ves)|drawers?)\b/g, ""))) return [];
  if (/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|forty|fifty|sixty)\b(?!\s*(?:legs?|shel(?:f|ves)|drawers?))/.test(lower)) return [];
  const square = Math.abs(W - D) < 1 / 16;
  const top = round ? `${W}" across` : square ? `${W}" across` : `${W}" wide × ${D}" deep`;
  const label = `${top} × ${H}" tall (finished top, overhang included)`;
  if (isSideEndTable(lower)) return [`Assumed ${label} — side / end table size (18–22" tall sits at sofa-arm height). Type a size to change it.`];
  const klass = /coffee|cocktail/.test(lower)
    ? 'coffee table size (16–18" tall sits at sofa-seat height)'
    : /dining|kitchen table|dinner/.test(lower)
      ? 'dining table size (30" tall seats standard chairs)'
      : /console|sofa|entry|hall/.test(lower)
        ? "console table size (about sofa-back height)"
        : "table class default";
  return [`Assumed ${label} — ${klass}. Type a size to change it.`];
}

/** Spoken shelf count for freestanding tables — never invent when the prompt is silent. */
function spokenTableShelfCount(prompt: string): number | null {
  const lower = prompt.toLowerCase();
  const bridge = countBridge(3);
  const adj = "(?:lower|upper|bottom|top|open|middle|adjustable)\\s+";
  const digit = lower.match(new RegExp(`\\b(\\d+)\\s+(?:${adj}|${bridge})?shel(?:f|ves|ving)\\b`));
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 4) return n;
  }
  const digitTight = lower.match(/\b(\d+)\s*shel(?:f|ves|ving)\b/);
  if (digitTight) {
    const n = parseInt(digitTight[1], 10);
    if (n >= 1 && n <= 4) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    single: 1,
  };
  const word = lower.match(
    new RegExp(
      `\\b(one|two|three|four|single)\\s+(?:${adj}|${bridge})?shel(?:f|ves|ving)\\b`,
    ),
  );
  if (word && words[word[1]] != null) return words[word[1]];
  if (/\b(?:a|the|one|single)\s+(?:lower|bottom)\s+shel(?:f|ves)\b/.test(lower)) return 1;
  if (
    /\blower\s+shel(?:f|ves)\b/.test(lower) &&
    !/\b(?:[2-9]|two|three|four)\s+(?:lower\s+)?shel/.test(lower)
  ) {
    return 1;
  }
  // "with a shelf" / "with the shelf" — singular only.
  if (
    /\b(?:with\s+)?(?:a|the|one|single)\s+shel(?:f)\b/.test(lower) &&
    !/\bshelves\b/.test(lower)
  ) {
    return 1;
  }
  return null;
}

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  yaw = 0,
  materialId = PLY,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId,
    yaw,
  };
}

export function buildTable(spec: FittedSpec, prompt = ""): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const z0 = -D / 2;
  const panels: Panel[] = [];
  const legN = Math.max(3, Math.min(4, u.legs ?? 4));
  const round = u.shape === "round";
  const oval = u.shape === "oval";
  const stock = legStock(prompt);
  const legW = stock.face;
  const topT = P;
  // Short coffee/side tables: a 3.5" apron eats the silhouette. Cap by height.
  const apronH = Math.min(3.5, Math.max(2.25, Math.round(H * 0.14 * 8) / 8));
  const apronT = P;
  const legH = H - topT;
  // Honor unit.shelfCount; densify from prompt when AI brief omits it.
  const spokenShelves = spokenTableShelfCount(prompt);
  const shelfN = Math.max(
    0,
    Math.min(
      3,
      (u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 0) ||
        (spokenShelves != null ? spokenShelves : 0),
    ),
  );

  const topName = round
    ? `Top (cut round dia ${W}")`
    : oval
      ? `Top (cut oval ${W}" × ${D}")`
      : "Top";
  panels.push(
    panel(
      "top",
      topName,
      x0,
      H - topT,
      z0,
      W,
      topT,
      D,
    ),
  );

  type XY = { x: number; z: number };
  const centers: XY[] = [];

  if (round) {
    const radius = Math.min(W, D) / 2;
    // Visible overhang so it reads as a table, posts fully inside the disc.
    const overhang = Math.min(4.25, Math.max(3.25, radius * 0.2));
    const rim = Math.max(legW * 2, radius - overhang - legW / 2);
    // One leg toward the iso camera (+X/+Z), the rest equally spaced.
    const spin = Math.PI / 4;
    for (let i = 0; i < legN; i++) {
      const ang = (Math.PI * 2 * i) / legN + spin;
      centers.push({ x: Math.cos(ang) * rim, z: Math.sin(ang) * rim });
    }
  } else {
    const inset = Math.max(3.25, legW + 1.75);
    const xs = [x0 + inset, x0 + W - inset];
    const zs = [z0 + inset, z0 + D - inset];
    if (legN === 3) {
      centers.push({ x: xs[0], z: zs[0] }, { x: xs[1], z: zs[0] }, { x: 0, z: zs[1] });
    } else {
      for (const x of xs) for (const z of zs) centers.push({ x, z });
    }
  }

  centers.forEach((c, i) => {
    panels.push(
      panel("upright", `Leg ${i + 1}`, c.x - legW / 2, 0, c.z - legW / 2, legW, legH, legW, 0, stock.id),
    );
  });

  // Aprons screw into the 2x2s, under the top.
  // 4-leg (round or rect): axis-aligned rails on the inner faces (no yaw).
  //   Round 4-leg lands on an axis-aligned square because of the 45° spin.
  //   The old circular pairing walked x-then-z so two "aprons" were diagonals
  //   (~43.5" on a 48×24 top) and yaw-blind plan bounds read 55.25".
  // 3-leg: chords between consecutive posts, inset toward the centroid so the
  //   apron body sits on the INNER side of the post-to-post line (same rule as
  //   4-leg inner faces). A centerline chord puts half the apron thickness
  //   outside the posts and reads as bars past the legs. Length uses the
  //   square half-extent along the chord so ends meet posts, not past them.
  //   Do NOT deep-inset toward origin — that floats a triangle off the 2x2s.
  const apronY = H - topT - apronH;
  const half = legW / 2;
  const squareHalfAlong = (ux: number, uz: number) => {
    const cands: number[] = [];
    if (Math.abs(ux) > 1e-9) cands.push(half / Math.abs(ux));
    if (Math.abs(uz) > 1e-9) cands.push(half / Math.abs(uz));
    return cands.length ? Math.min(...cands) : half;
  };

  type AxisFrame = { lx: number; rx: number; fz: number; bz: number; spanX: number; spanZ: number };
  let axisFrame: AxisFrame | null = null;

  if (legN === 4 && centers.length === 4) {
    // Aprons butt into the legs, inner faces flush with the legs' inner faces — each apron
    // ends on two legs and no apron runs through its neighbour at the corner.
    const lx = Math.min(centers[0].x, centers[1].x, centers[2].x, centers[3].x);
    const rx = Math.max(centers[0].x, centers[1].x, centers[2].x, centers[3].x);
    const fz = Math.min(centers[0].z, centers[1].z, centers[2].z, centers[3].z);
    const bz = Math.max(centers[0].z, centers[1].z, centers[2].z, centers[3].z);
    const spanX = Math.max(4, rx - lx - legW);
    const spanZ = Math.max(4, bz - fz - legW);
    axisFrame = { lx, rx, fz, bz, spanX, spanZ };
    panels.push(
      panel("rail", "Front apron", lx + legW / 2, apronY, fz + legW / 2 - apronT, spanX, apronH, apronT),
    );
    panels.push(
      panel("rail", "Back apron", lx + legW / 2, apronY, bz - legW / 2, spanX, apronH, apronT),
    );
    panels.push(
      panel("rail", "Left apron", lx + legW / 2 - apronT, apronY, fz + legW / 2, apronT, apronH, spanZ),
    );
    panels.push(
      panel("rail", "Right apron", rx - legW / 2, apronY, fz + legW / 2, apronT, apronH, spanZ),
    );
  } else {
    for (let i = 0; i < centers.length; i++) {
      const a = centers[i];
      const b = centers[(i + 1) % centers.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const span = Math.hypot(dx, dz);
      const ux = dx / span;
      const uz = dz / span;
      // Three.js Y-up: local +X maps to (cos θ, −sin θ) in XZ. Use atan2(-dz, dx)
      // so the board's long axis follows the chord — atan2(dz, dx) made 45° chords
      // render as radials (short center Y with gaps to the posts).
      const yaw = Math.atan2(-dz, dx);
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      // Inward normal (toward origin / triangle centroid).
      let nx = -uz;
      let nz = ux;
      if (nx * -midX + nz * -midZ < 0) {
        nx = -nx;
        nz = -nz;
      }
      // Outer face of apron on the post-to-post centerline → body inside the posts.
      // Bite 1/8" into each 2x2 so the joint reads as "ends into the posts" from
      // under the top (a butt at the AABB face looks like a floating bar).
      const inset = apronT / 2;
      const cx = midX + nx * inset;
      const cz = midZ + nz * inset;
      // Ends stop at the post faces (no bite into the 2x2 — a bite is two parts in one place).
      const bite = 0;
      const tA = Math.max(0.25, squareHalfAlong(ux, uz) - bite);
      const tB = Math.max(0.25, squareHalfAlong(ux, uz) - bite);
      const length = Math.max(4, span - tA - tB);
      // Size is length × apronH × apronT (vertical apron). Yaw about Y through
      // the panel center — never lay the board flat under the top.
      panels.push(
        panel(
          "rail",
          `Apron ${i + 1}`,
          cx - length / 2,
          apronY,
          cz - apronT / 2,
          length,
          apronH,
          apronT,
          yaw,
        ),
      );
    }
    // Neighbouring chord aprons meet at the post at an angle: both ends are mitred, so the
    // model declares that joint (the only place two aprons may share space).
    const aprons = panels.filter((p) => /^Apron \d+$/.test(p.name));
    const miter = Math.round(180 / aprons.length);
    aprons.forEach((a, i) => {
      const prev = aprons[(i + aprons.length - 1) % aprons.length];
      const next = aprons[(i + 1) % aprons.length];
      a.joints = [prev, next].filter((q) => q !== a).map((q) => ({ with: q.id, kind: "miter" as const }));
      a.cutNote = `Miter both ends at ${miter}° (off square) so neighbouring aprons meet cleanly behind each leg.`;
    });
  }

  // Spoken lower shelf / N shelves — plywood shelf between the legs on ¾" shelf rails.
  // Seat clear of the apron under the top. Never invent when shelfN is 0.
  if (shelfN >= 1) {
    const shelfT = P;
    const railH = Math.min(2.5, apronH);
    // Coffee/side (~H≤22): ~6–8" AFF. Dining/taller: ~H/3. Keep stack under apron.
    const targetTop =
      H <= 22
        ? Math.min(8, Math.max(6, Math.round(H * 0.38 * 8) / 8))
        : Math.round((H / 3) * 8) / 8;
    const maxTop = Math.max(railH + shelfT + 2, apronY - 0.5);
    const minTop = railH + shelfT + 1.5;
    const bandLo = Math.min(minTop, maxTop);
    const bandHi = Math.max(minTop, maxTop);

    const shelfTops: number[] = [];
    for (let i = 1; i <= shelfN; i++) {
      const t =
        shelfN === 1
          ? Math.min(bandHi, Math.max(bandLo, targetTop))
          : Math.round((bandLo + ((bandHi - bandLo) * i) / (shelfN + 1)) * 8) / 8;
      shelfTops.push(t);
    }

    const pushAxisShelf = (frame: AxisFrame, shelfTop: number, label: string, railSuffix: string) => {
      const shelfY = shelfTop - shelfT;
      const railY = Math.max(0, shelfY - railH);
      const { lx, rx, fz, bz, spanX, spanZ } = frame;
      panels.push(
        panel("shelf", label, lx + legW / 2, shelfY, fz + legW / 2 - apronT, spanX, shelfT, spanZ + apronT * 2),
      );
      panels.push(
        panel(
          "rail",
          `Front shelf rail${railSuffix}`,
          lx + legW / 2,
          railY,
          fz + legW / 2 - apronT,
          spanX,
          railH,
          apronT,
        ),
      );
      panels.push(
        panel(
          "rail",
          `Back shelf rail${railSuffix}`,
          lx + legW / 2,
          railY,
          bz - legW / 2,
          spanX,
          railH,
          apronT,
        ),
      );
      panels.push(
        panel(
          "rail",
          `Left shelf rail${railSuffix}`,
          lx + legW / 2 - apronT,
          railY,
          fz + legW / 2,
          apronT,
          railH,
          spanZ,
        ),
      );
      panels.push(
        panel(
          "rail",
          `Right shelf rail${railSuffix}`,
          rx - legW / 2,
          railY,
          fz + legW / 2,
          apronT,
          railH,
          spanZ,
        ),
      );
    };

    const pushChordShelf = (shelfTop: number, label: string, railSuffix: string) => {
      const shelfY = shelfTop - shelfT;
      const railY = Math.max(0, shelfY - railH);
      const lx = Math.min(...centers.map((c) => c.x)) - legW / 2;
      const rx = Math.max(...centers.map((c) => c.x)) + legW / 2;
      const fz = Math.min(...centers.map((c) => c.z)) - legW / 2;
      const bz = Math.max(...centers.map((c) => c.z)) + legW / 2;
      // Inset shelf clear of leg faces (same spirit as apron inner span).
      const inset = legW;
      const shelfW = Math.max(4, rx - lx - inset * 2);
      const shelfD = Math.max(4, bz - fz - inset * 2);
      panels.push(
        panel(
          "shelf",
          label,
          lx + inset,
          shelfY,
          fz + inset,
          shelfW,
          shelfT,
          shelfD,
        ),
      );
      for (let i = 0; i < centers.length; i++) {
        const a = centers[i];
        const b = centers[(i + 1) % centers.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const span = Math.hypot(dx, dz);
        const ux = dx / span;
        const uz = dz / span;
        const yaw = Math.atan2(-dz, dx);
        const midX = (a.x + b.x) / 2;
        const midZ = (a.z + b.z) / 2;
        let nx = -uz;
        let nz = ux;
        if (nx * -midX + nz * -midZ < 0) {
          nx = -nx;
          nz = -nz;
        }
        const insetR = apronT / 2;
        const cx = midX + nx * insetR;
        const cz = midZ + nz * insetR;
        // Ends stop at the post faces (no bite into the 2x2 — a bite is two parts in one place).
      const bite = 0;
        const tA = Math.max(0.25, squareHalfAlong(ux, uz) - bite);
        const tB = Math.max(0.25, squareHalfAlong(ux, uz) - bite);
        const length = Math.max(4, span - tA - tB);
        panels.push(
          panel(
            "rail",
            `Shelf rail ${i + 1}${railSuffix}`,
            cx - length / 2,
            railY,
            cz - apronT / 2,
            length,
            railH,
            apronT,
            yaw,
          ),
        );
      }
    };

    shelfTops.forEach((shelfTop, idx) => {
      const label = shelfN === 1 ? "Shelf" : `Shelf ${idx + 1}`;
      const railSuffix = shelfN === 1 ? "" : ` ${idx + 1}`;
      if (axisFrame) pushAxisShelf(axisFrame, shelfTop, label, railSuffix);
      else pushChordShelf(shelfTop, label, railSuffix);
    });
  }

  const shelfNote =
    shelfN >= 1
      ? ` + ${shelfN} shelf${shelfN === 1 ? "" : "ves"} on shelf rails`
      : "";
  const notes = [
    `${spec.name}. Freestanding table — top + ${legN} legs + ${legN} aprons${shelfNote}.`,
    round
      ? `Round top: cut a ${W}" square blank, then band-saw / jigsaw to a ${W}" diameter circle. Height ${H}".`
      : oval
        ? `Oval top: cut a ${W}" × ${D}" rectangular blank, then band-saw / jigsaw to an oval ${W}" long × ${D}" wide. Height ${H}".`
        : `Top ${W}" × ${D}". Height ${H}".`,
    stock.note,
    ...tableAssumedNote(prompt, W, D, H, round),
    shelfN >= 1
      ? "Lower shelf sits on 3/4\" shelf rails between the legs — screw rails to the posts, then the shelf down onto the rails."
      : "",
    "Guidance only — level the top; do not rack the legs.",
  ].filter(Boolean);

  // Persist densified shelfCount on the fitted unit so Buy/steps/HUD agree with panels.
  const fitted: FittedSpec =
    shelfN >= 1 && !(u.shelfCount && u.shelfCount > 0)
      ? { ...spec, unit: { ...u, shelfCount: shelfN } }
      : spec;

  return {
    id: createId("proj"),
    name: spec.name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: spec.opening,
    fitted,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}
