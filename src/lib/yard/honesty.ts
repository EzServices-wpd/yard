/**
 * Honesty guards — a lying house build must fail or auto-correct
 * before the bench presents it as the plan.
 *
 * Not a noun program. No wineRack.ts. Typed facts win.
 */
import { createId } from "@/lib/utils";
import { aabbOfPanels, aabbSize, type Aabb3 } from "./geometry";
import { detectProgram, parseBrief } from "./fitted";
import { detectHouseFamily, wantsShoes } from "./family";
import { hasExplicitSize } from "./promptHelpers";
import type { BuildPlan, FittedSpec, Panel, YardProject } from "./types";

export const STOCK_TOL = 0.75;

export type HonestyGuard = "size" | "mount" | "rack" | "table";

export type HonestyIssue = {
  guard: HonestyGuard;
  message: string;
  /** Rebuild the fitted spec when local HUD/parts fixes cannot make the geometry honest. */
  rebuild?: boolean;
};

export type TypedExtents = {
  width?: number;
  height?: number;
  depth?: number;
  labeled: { width: boolean; height: boolean; depth: boolean };
};

export type HonestyReport = {
  ok: boolean;
  issues: HonestyIssue[];
  typed: TypedExtents | null;
};

const P = 0.75;

const LUMBER_STOCK =
  /\b(?:[124]\s*[x×]\s*(?:2|4|6|8|10|12)|1x2|1x4|1x6|1x8|1x12|2x2|2x4|2x6|2x8|2x10|2x12|4x4)(?:\s*[x×]\s*\d+)?(?:\s*(?:ft|foot|feet|in|inch|inches))?\b/gi;

function stripLumber(s: string) {
  return s.replace(LUMBER_STOCK, " ");
}

function pickLabeled(text: string, axis: RegExp): number | undefined {
  const m = text.match(
    new RegExp(
      String.raw`(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:${axis.source})\b`,
      "i",
    ),
  );
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function unlabeledTriple(text: string): { a: number; b: number; c?: number } | null {
  const m = stripLumber(text).match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/i,
  );
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  const c = m[3] ? parseFloat(m[3]) : undefined;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a <= 4 && b <= 12 && (c == null || c <= 16)) return null;
  return { a, b, c: c != null && Number.isFinite(c) ? c : undefined };
}

/** Axes the prompt actually named. Defaults from parseBrief do not count. */
export function typedExtents(prompt: string): TypedExtents | null {
  if (!hasExplicitSize(prompt) && !/\d+(?:\.\d+)?\s*(?:wide|tall|high|deep|width|height|depth)/i.test(prompt)) {
    const trip = unlabeledTriple(prompt);
    if (!trip) return null;
  }
  const t = prompt.replace(/×/g, "x").replace(/″/g, '"');
  const lower = t.toLowerCase();
  const width = pickLabeled(t, /wide|width/);
  const height = pickLabeled(t, /tall|high|height/);
  const depth = pickLabeled(t, /deep|depth/);
  const saidAxis = /wide|width|deep|depth|tall|high|height/.test(lower);
  const trip = unlabeledTriple(t);
  const program = detectProgram(lower);

  const out: TypedExtents = {
    width,
    height,
    depth,
    labeled: { width: width != null, height: height != null, depth: depth != null },
  };

  if (!saidAxis && trip) {
    // Tables are W×H×D. Desk / media / storage (and other casegoods) are W×D×H.
    // Closet / wardrobe / pantry / vanity stay W×H×D (opening order).
    const furniture = program !== "closet" && program !== "wardrobe" && program !== "pantry" && program !== "vanity";
    if (trip.c != null) {
      if (program === "table") {
        out.width = trip.a;
        out.height = trip.b;
        out.depth = trip.c;
      } else if (furniture) {
        out.width = trip.a;
        out.depth = trip.b;
        out.height = trip.c;
      } else {
        out.width = trip.a;
        out.height = trip.b;
        out.depth = trip.c;
      }
      out.labeled = { width: true, height: true, depth: true };
    } else if (furniture && trip.b < 20) {
      out.width = trip.a;
      out.depth = trip.b;
      out.labeled = { width: true, height: false, depth: true };
    } else {
      out.width = trip.a;
      out.height = trip.b;
      out.labeled = { width: true, height: true, depth: false };
    }
  }

  if (out.width == null && out.height == null && out.depth == null) return null;
  return out;
}

export function nearInch(a: number, b: number, tol = STOCK_TOL) {
  return Math.abs(a - b) <= tol;
}

export function rackIntent(prompt: string): "spice" | "wine" | "jar" | "bottle" | null {
  const lower = prompt.toLowerCase();
  if (/spice/.test(lower) && /rack/.test(lower)) return "spice";
  if (/wine/.test(lower) && /rack/.test(lower)) return "wine";
  if (/\bjar/.test(lower) && /rack|shelf|ledge/.test(lower)) return "jar";
  if (/bottle/.test(lower) && /rack|shelf/.test(lower)) return "bottle";
  const hit = detectHouseFamily(prompt);
  if (hit?.affordances.includes("jar-lips")) return "jar";
  if (hit?.affordances.includes("bottle-rails")) return "bottle";
  return null;
}

export function wantsRackAffordance(prompt: string) {
  return rackIntent(prompt) != null;
}

/** Shelves that are glued / screwed (shoe cubbies, jar/wine racks) — never sell adjustable shelf pins. */
export function wantsFixedGlueShelves(project: YardProject): boolean {
  const prompt = project.prompt ?? "";
  const lower = prompt.toLowerCase();
  if (wantsRackAffordance(prompt)) return true;
  if (project.fitted?.affordances?.includes("cubbies")) return true;
  if (project.panels.some((p) => /shoe shelf|cubby divider|jar lip|bottle rail/i.test(p.name))) return true;
  if (project.notes.some((n) => /not bookcase pin shelves|do not pin them|glue the shelves/i.test(n))) return true;
  if (wantsShoes(lower)) return true;
  return false;
}


export function hasRackAffordance(project: YardProject) {
  return project.panels.some(
    (p) => /(?:jar )?lip|bottle rail/i.test(p.name) || (p.type === "rail" && /lip|bottle/i.test(p.name)),
  );
}

const WALL_LANG =
  /wall[- ]?hung|wall[- ]?mount|hang(?:s|ing)? on (?:the )?wall|floating\s+shel|spice|wine|coat rack|medicine|ironing|range\s*hood|(?:^|[^a-z])hood(?:[^a-z]|$)/i;

export function isWallHung(project: YardProject) {
  if (project.assumptions.installMode === "wall") return true;
  const hit = detectHouseFamily(project.prompt ?? "");
  if (hit?.mount === "wall" || hit?.family === "hung-open" || hit?.family === "hung-cabinet") return true;
  const blob = `${project.prompt ?? ""} ${project.name ?? ""}`;
  if (WALL_LANG.test(blob)) return true;
  return rackIntent(project.prompt ?? "") != null;
}

/** Floor-box instructions that must not appear on a wall-hung build. */
export function hasFloorBoxLie(text: string) {
  const t = text.toLowerCase();
  if (/do not mark (?:a |the )?footprint on the floor/.test(t)) return false;
  if (/this hangs on the wall/.test(t) && /footprint/.test(t)) return false;
  return (
    /mark the footprint on the floor/.test(t) ||
    /mark a footprint on the floor/.test(t) ||
    /freestanding rectangle\. mark the footprint/.test(t) ||
    /shim the feet/.test(t) ||
    /shim feet if the floor/.test(t)
  );
}

function envelopePanels(project: YardProject): Panel[] {
  return project.panels.filter((p) => {
    if (p.type === "rail") return false;
    if ((p.yaw ?? 0) !== 0 && p.type !== "top" && p.type !== "counter") return false;
    return (
      p.type === "top" ||
      p.type === "bottom" ||
      p.type === "upright" ||
      p.type === "counter" ||
      p.type === "back" ||
      p.type === "kick" ||
      p.type === "shelf" ||
      p.type === "door" ||
      p.type === "drawer" ||
      p.type === "deck"
    );
  });
}

export function presentedExtents(project: YardProject): { width: number; height: number; depth: number } {
  const unit = project.fitted?.unit;
  return {
    width: unit?.width ?? project.overall.width,
    height: unit?.height ?? project.overall.height,
    depth: unit?.depth ?? project.overall.depth,
  };
}

function sizeMismatch(
  typed: TypedExtents,
  got: { width: number; height: number; depth: number },
  where: string,
): HonestyIssue | null {
  const bits: string[] = [];
  if (typed.labeled.width && typed.width != null && !nearInch(got.width, typed.width)) {
    bits.push(`W ${got.width}" ≠ typed ${typed.width}"`);
  }
  if (typed.labeled.height && typed.height != null && !nearInch(got.height, typed.height)) {
    bits.push(`H ${got.height}" ≠ typed ${typed.height}"`);
  }
  if (typed.labeled.depth && typed.depth != null && !nearInch(got.depth, typed.depth)) {
    bits.push(`D ${got.depth}" ≠ typed ${typed.depth}"`);
  }
  if (!bits.length) return null;
  return { guard: "size", message: `${where}: ${bits.join(", ")}`, rebuild: where === "envelope" };
}


function isTableProject(project: YardProject) {
  return project.fitted?.program === "table" || project.fitted?.family === "table";
}

function xzOverlap(a: Aabb3, b: Aabb3, eps = 0.2) {
  return !(a.maxX < b.minX - eps || a.minX > b.maxX + eps || a.maxZ < b.minZ - eps || a.minZ > b.maxZ + eps);
}

function tableLegs(project: YardProject) {
  return project.panels.filter((p) => p.type === "upright" && /^leg\b/i.test(p.name));
}

function tableRails(project: YardProject) {
  return project.panels.filter((p) => p.type === "rail" || /^apron\b/i.test(p.name));
}

/**
 * Table aprons must sit under the top, span post-to-post, and never float or
 * run past the legs. Do not snap HUD to hide this — rebuild the geometry.
 */
export function tableBraceIssues(project: YardProject): HonestyIssue[] {
  if (!isTableProject(project)) return [];
  const issues: HonestyIssue[] = [];
  const tops = project.panels.filter((p) => p.type === "top");
  const legs = tableLegs(project);
  const rails = tableRails(project);
  if (!tops.length || !legs.length) return issues;

  const topBox = aabbOfPanels(tops);
  const legBox = aabbOfPanels(legs);
  const railBox = rails.length ? aabbOfPanels(rails) : null;
  const slop = STOCK_TOL;

  if (topBox && railBox) {
    if (
      railBox.minX < topBox.minX - slop ||
      railBox.maxX > topBox.maxX + slop ||
      railBox.minZ < topBox.minZ - slop ||
      railBox.maxZ > topBox.maxZ + slop
    ) {
      issues.push({
        guard: "table",
        message: `Apron/brace AABB exceeds the top (${(railBox.maxX - railBox.minX).toFixed(1)}" × ${(railBox.maxZ - railBox.minZ).toFixed(1)}" vs ${(topBox.maxX - topBox.minX).toFixed(1)}" × ${(topBox.maxZ - topBox.minZ).toFixed(1)}").`,
        rebuild: true,
      });
    }
  }

  if (legBox && railBox) {
    if (
      railBox.minX < legBox.minX - slop ||
      railBox.maxX > legBox.maxX + slop ||
      railBox.minZ < legBox.minZ - slop ||
      railBox.maxZ > legBox.maxZ + slop
    ) {
      issues.push({
        guard: "table",
        message: "Apron/brace extends past the legs.",
        rebuild: true,
      });
    }
  }

  const legBoxes = legs
    .map((p) => ({ p, b: aabbOfPanels([p]) }))
    .filter((x): x is { p: Panel; b: Aabb3 } => x.b != null);

  for (const rail of rails) {
    const rb = aabbOfPanels([rail]);
    if (!rb) continue;
    const hits = legBoxes.filter((l) => xzOverlap(rb, l.b));
    if (hits.length < 2) {
      issues.push({
        guard: "table",
        message: `${rail.name} does not terminate at two legs.`,
        rebuild: true,
      });
      continue;
    }
    if (legs.length === 4) {
      const cxs = hits.map((h) => h.p.position.x + h.p.size.width / 2);
      const czs = hits.map((h) => h.p.position.z + h.p.size.depth / 2);
      const shareX = Math.abs(cxs[0] - cxs[1]) <= 0.6;
      const shareZ = Math.abs(czs[0] - czs[1]) <= 0.6;
      if (!shareX && !shareZ) {
        issues.push({
          guard: "table",
          message: `${rail.name} is a diagonal, not a post-to-post perimeter rail.`,
          rebuild: true,
        });
      }
    }
  }

  return issues;
}

export function inspectHonesty(project: YardProject, plan?: BuildPlan | null): HonestyReport {
  const issues: HonestyIssue[] = [];
  const prompt = project.prompt ?? "";
  const pocketWonky =
    !!project.pocket &&
    ((project.pocket.walls.leftAngleDeg ?? 0) > 0.2 || (project.pocket.walls.rightAngleDeg ?? 0) > 0.2);
  const skipSize = pocketWonky || project.kind === "opening" || !project.fitted;

  const typed = skipSize ? null : typedExtents(prompt);
  if (typed && project.fitted) {
    const hud = sizeMismatch(typed, project.overall, "HUD");
    if (hud) issues.push(hud);
    const unit = sizeMismatch(typed, project.fitted.unit, "plan unit");
    if (unit) issues.push(unit);
    const env = aabbOfPanels(envelopePanels(project));
    if (env) {
      const envIssue = sizeMismatch(typed, aabbSize(env), "envelope");
      if (envIssue) issues.push(envIssue);
    }
  }

  if (isWallHung(project)) {
    const blobs: string[] = [...project.notes];
    if (plan) {
      for (const s of plan.instructions) blobs.push(s.title, s.description, s.tips ?? "");
      for (const b of plan.bom) blobs.push(b.name, b.notes ?? "");
    }
    if (blobs.some((t) => hasFloorBoxLie(t))) {
      issues.push({
        guard: "mount",
        message: "Wall-hung build talks like a floor box (footprint / shim feet).",
      });
    }
  }

  const intent = rackIntent(prompt);
  if (intent && project.fitted) {
    if (!hasRackAffordance(project)) {
      issues.push({
        guard: "rack",
        message: `${intent} rack has no lips or bottle rails — pin-shelf bookcase is a fail.`,
        rebuild: true,
      });
    }
    if (plan?.bom.some((b) => /shelf pin/i.test(b.name))) {
      issues.push({
        guard: "rack",
        message: `${intent} rack Buy list still has shelf pins.`,
      });
    }
  }
  if (wantsFixedGlueShelves(project) && plan?.bom.some((b) => /shelf pin/i.test(b.name))) {
    issues.push({
      guard: "rack",
      message: "Fixed/glued shelves (shoe cubbies or rack lips) still sell shelf pins.",
    });
  }

  issues.push(...tableBraceIssues(project));

  return { ok: issues.length === 0, issues, typed };
}

function snapName(name: string, w: number, h: number, d: number) {
  const cleaned = name.replace(/\s+\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"\s*$/, "").trim();
  const label = cleaned || name;
  return `${label} ${w}" × ${h}" × ${d}"`;
}

function injectRackRails(project: YardProject): YardProject {
  const intent = rackIntent(project.prompt ?? "");
  if (!intent || hasRackAffordance(project)) return project;
  const shelves = project.panels.filter((p) => p.type === "shelf");
  if (!shelves.length) return project;
  const wine = intent === "wine" || intent === "bottle";
  const lipH = wine ? 1.5 : 1.25;
  const label = wine ? "Bottle rail" : "Jar lip";
  const skipLast = wine && shelves.length > 1;
  const extras: Panel[] = [];
  const ordered = [...shelves].sort((a, b) => a.position.y - b.position.y);
  ordered.forEach((shelf, i) => {
    if (skipLast && i === ordered.length - 1) return;
    extras.push({
      id: createId("rail"),
      type: "rail",
      name: `${label} ${i + 1}`,
      position: {
        x: shelf.position.x,
        y: shelf.position.y + shelf.size.height,
        z: shelf.position.z + Math.max(0, shelf.size.depth - P),
      },
      size: { width: shelf.size.width, height: lipH, depth: P },
      materialId: shelf.materialId,
    });
  });
  if (!extras.length) return project;
  const kind = wine ? "Wine rack" : intent === "spice" || intent === "jar" ? "Spice rack" : "Rack";
  const u = project.fitted?.unit;
  const W = u?.width ?? project.overall.width;
  const H = u?.height ?? project.overall.height;
  const D = u?.depth ?? project.overall.depth;
  const name = project.name.match(/spice|wine|rack/i) ? project.name : `${kind} ${W}" × ${H}" × ${D}"`;
  return {
    ...project,
    name,
    panels: [...project.panels, ...extras],
    assumptions: { ...project.assumptions, installMode: "wall" },
    notes: [
      ...project.notes.filter((n) => !/honesty: rack/i.test(n)),
      `Honesty: added ${extras.length} ${wine ? "bottle rails" : "jar lips"} so the rack cannot be a pin-shelf bookcase.`,
    ],
  };
}

function snapHud(project: YardProject, typed: TypedExtents): YardProject {
  if (!project.fitted) return project;
  const unit = { ...project.fitted.unit };
  let changed = false;
  if (typed.labeled.width && typed.width != null && !nearInch(unit.width, typed.width)) {
    unit.width = typed.width;
    changed = true;
  }
  if (typed.labeled.height && typed.height != null && !nearInch(unit.height, typed.height)) {
    unit.height = typed.height;
    changed = true;
  }
  if (typed.labeled.depth && typed.depth != null && !nearInch(unit.depth, typed.depth)) {
    unit.depth = typed.depth;
    changed = true;
  }
  const overall = {
    width: typed.labeled.width && typed.width != null ? typed.width : project.overall.width,
    height: typed.labeled.height && typed.height != null ? typed.height : project.overall.height,
    depth: typed.labeled.depth && typed.depth != null ? typed.depth : project.overall.depth,
  };
  const hudDrift =
    !nearInch(project.overall.width, overall.width) ||
    !nearInch(project.overall.height, overall.height) ||
    !nearInch(project.overall.depth, overall.depth);
  if (!changed && !hudDrift) return project;
  const name = snapName(project.fitted.name || project.name, overall.width, overall.height, overall.depth);
  const opening = project.fitted.opening
    ? {
        ...project.fitted.opening,
        width: overall.width,
        height: overall.height,
        depth: overall.depth,
      }
    : project.opening;
  return {
    ...project,
    name,
    overall,
    opening: opening ?? project.opening,
    fitted: { ...project.fitted, name, unit, opening: opening ?? project.fitted.opening },
    notes: [
      ...project.notes.filter((n) => !/honesty: typed size/i.test(n)),
      `Honesty: typed size wins — HUD ${overall.width}" × ${overall.height}" × ${overall.depth}".`,
    ],
  };
}

function forceWallMount(project: YardProject): YardProject {
  if (!isWallHung(project)) return project;
  if (project.assumptions.installMode === "wall") return project;
  return {
    ...project,
    assumptions: { ...project.assumptions, installMode: "wall" },
    notes: [
      ...project.notes.filter((n) => !/honesty: wall/i.test(n)),
      "Honesty: this hangs on the wall — not a floor box.",
    ],
  };
}

function correctedSpec(project: YardProject, typed: TypedExtents | null): FittedSpec | null {
  if (!project.fitted) return null;
  const local = parseBrief(project.prompt ?? "");
  const intent = rackIntent(project.prompt ?? "");
  if (intent && local) return local;
  if (!typed) return local;
  const unit = { ...project.fitted.unit };
  if (typed.labeled.width && typed.width != null) unit.width = typed.width;
  if (typed.labeled.height && typed.height != null) unit.height = typed.height;
  if (typed.labeled.depth && typed.depth != null) unit.depth = typed.depth;
  const opening = {
    ...project.fitted.opening,
    width: unit.width,
    height: unit.height,
    depth: unit.depth,
  };
  return {
    ...project.fitted,
    name: snapName(project.fitted.name || project.name, unit.width, unit.height, unit.depth),
    unit,
    opening,
  };
}

function applyLocalFixes(project: YardProject): YardProject {
  const pocketWonky =
    !!project.pocket &&
    ((project.pocket.walls.leftAngleDeg ?? 0) > 0.2 || (project.pocket.walls.rightAngleDeg ?? 0) > 0.2);
  if (pocketWonky || project.kind === "opening") return project;
  if (!project.fitted && !project.panels.length) return project;
  let next = project;
  const tableLie = tableBraceIssues(next).length > 0;
  const typed = typedExtents(next.prompt ?? "");
  // Do not snap HUD to hide a table apron/brace geometry lie — rebuild instead.
  if (typed && next.fitted && !tableLie) next = snapHud(next, typed);
  next = forceWallMount(next);
  next = injectRackRails(next);
  return next;
}

/**
 * After a fitted build is produced: snap HUD, inject rack lips, force wall mount.
 * Rebuild via the existing fitted pipeline when the geometry itself is the lie.
 */
export function enforceHonesty(
  project: YardProject,
  opts: { rebuild?: (spec: FittedSpec) => YardProject; honorUnit?: boolean } = {},
): YardProject {
  const pocketWonky =
    !!project.pocket &&
    ((project.pocket.walls.leftAngleDeg ?? 0) > 0.2 || (project.pocket.walls.rightAngleDeg ?? 0) > 0.2);
  if (pocketWonky || project.kind === "opening") return project;
  if (!project.fitted && !project.panels.length) return project;

  // Measure just typed W×H×D. That is the typed fact — do not snap back to the old prompt sizes.
  if (opts.honorUnit) {
    let next = project;
    next = forceWallMount(next);
    next = injectRackRails(next);
    return next;
  }

  const report = inspectHonesty(project);
  const needsRebuild = report.issues.some((i) => i.rebuild);
  if (needsRebuild && opts.rebuild && project.fitted) {
    const spec = correctedSpec(project, report.typed);
    if (spec) return applyLocalFixes(opts.rebuild(spec));
  }
  return applyLocalFixes(project);
}

function scrubFloorLanguage(text: string) {
  return text
    .replace(
      /Freestanding rectangle\. Mark the footprint on the floor\. Check it is square\./gi,
      "This hangs on the wall — do not mark a footprint on the floor. Find two studs.",
    )
    .replace(
      /Mark the footprint on the floor\. Check it is square\./gi,
      "Find two studs. This hangs on the wall — do not mark a footprint on the floor.",
    )
    .replace(/Mark the footprint on the floor\./gi, "Do not mark a footprint on the floor.")
    .replace(/Mark a footprint on the floor\./gi, "Do not mark a footprint on the floor.")
    .replace(/Shim the feet until it does not rock\./gi, "Hang it on studs. Do not shim feet on the floor.")
    .replace(
      /If it sits on a floor that is out, shim the feet[^.]*\./gi,
      "Lag into studs. Do not treat this as a floor box.",
    )
    .replace(/Shim the feet if the floor is out[^.]*\./gi, "Lag into studs. Do not treat this as a floor box.")
    .replace(/This (\w+) sits on the floor\./gi, "This $1 hangs on the wall.");
}

/** Rewrite a plan that still talks like a floor box or lists shelf pins on a rack. */
export function honestPlan(project: YardProject, plan: BuildPlan): BuildPlan {
  const wall = isWallHung(project);
  const rack = rackIntent(project.prompt ?? "") != null;
  const fixedShelves = wantsFixedGlueShelves(project);
  if (!wall && !rack && !fixedShelves) return plan;
  const instructions = plan.instructions.map((s) => {
    if (!wall) return s;
    const blob = `${s.title} ${s.description} ${s.tips ?? ""}`;
    if (!hasFloorBoxLie(blob)) return s;
    return {
      ...s,
      title: s.title.replace(/Confirm the footprint/i, "Confirm the hang"),
      description: scrubFloorLanguage(s.description),
      tips: s.tips ? scrubFloorLanguage(s.tips) : s.tips,
    };
  });
  const bom = rack || fixedShelves ? plan.bom.filter((b) => !/shelf pin/i.test(b.name)) : plan.bom;
  return { ...plan, instructions, bom };
}
