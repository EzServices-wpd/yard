/**
 * Placement talk: every step that attaches or positions a part says WHERE, read from the same
 * panel geometry the bench, the PDF pictures and the cut list use. Nobody guesses a height.
 *
 * One pass over the finished plan, every build class: heights to the top face from a stated
 * reference, setbacks, spacing between repeats, centered parts with the distance from each
 * side, and hardware spots (hinges, pulls, slides, brackets). The same records feed the step
 * text, the PDF step pages, the dimension arrows on the step pictures, and the guards.
 */
import { panelWorldCorners } from "./geometry";
import { partLetters } from "./pdfDraw";
import { frac } from "./pdfKit";
import { cutListName, shopPlural } from "./shopPlural";
import { planStepParts } from "./stepParts";
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types";

type V3 = { x: number; y: number; z: number };
type Box = { min: V3; max: V3 };

/** What the stated number measures, so the guard can recompute it from raw geometry. */
export type PlacementMeasure =
  | { kind: "top"; id: string; refId: string | null; refY: number; value: number }
  | { kind: "across"; id: string; neighborId: string; side: "left" | "right"; value: number }
  | { kind: "setback"; id: string; value: number }
  | { kind: "rest"; id: string; value: number }
  | { kind: "center"; id: string; value: number }
  | { kind: "hinge"; id: string; value: number }
  | { kind: "hingeHeight"; id: string; value: number }
  | { kind: "pull"; id: string; value: number }
  | { kind: "slide"; id: string; refId: string | null; refY: number; value: number }
  | { kind: "spacing"; ids: string[]; value: number }
  | { kind: "bracket"; ids: string[]; value: number }
  | { kind: "frontBottom"; id: string; value: number };

/** Dimension arrow a→b; ea/eb are extension-line feet on the reference and on the part. */
export type PlacementArrow = { a: V3; b: V3; label: string; ea?: V3; eb?: V3 };

/** Height arrows as one chain beside the unit: reference → first top, then top to top (the spacing). */
function heightChain(ctx: Ctx, tops: number[], ry: number, z: number, partMaxX: number, refMaxX: number): PlacementArrow[] {
  const xs = Math.max(...ctx.panels.map((q) => ctx.box.get(q.id)!.max.x));
  const x = xs + 2;
  const out: PlacementArrow[] = [];
  let prev = ry;
  tops.forEach((t, i) => {
    out.push({
      a: { x, y: prev, z },
      b: { x, y: t, z },
      label: f(t - prev),
      ea: i === 0 ? { x: refMaxX, y: prev, z } : undefined,
      eb: { x: partMaxX, y: t, z },
    });
    prev = t;
  });
  return out;
}

export type StepPlacement = {
  /** Sentences appended to the step, in order. */
  sentences: string[];
  measures: PlacementMeasure[];
  arrows: PlacementArrow[];
  /** Panel ids this step positions that the guard expects a measurement for. */
  positioned: string[];
  /** Hardware the step places ("hinge" | "pull" | "slide" | "bracket"). */
  hardware: string[];
};

const EPS = 1 / 32;
const f = (n: number) => frac(Math.max(0, n));

function boxOf(p: Panel): Box {
  const pts = panelWorldCorners(p);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const q of pts) {
    for (const k of ["x", "y", "z"] as const) {
      min[k] = Math.min(min[k], q[k]);
      max[k] = Math.max(max[k], q[k]);
    }
  }
  return { min, max };
}

const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

export type PlaceRole = "horizontal" | "divider" | "rail" | "bracket" | "door" | "drawer" | "front" | "skip";

/** Plain role from the panel's own shape and name — the same for every build class. */
export function placeRole(p: Panel): PlaceRole {
  const nm = `${p.type} ${p.name}`.toLowerCase();
  if (/drawer front/.test(nm)) return "front";
  if (p.type === "door" || /\bdoor\b/.test(p.name.toLowerCase())) return "door";
  if (p.type === "drawer") return "drawer";
  if (p.type === "back" || p.type === "mirror" || p.type === "glass_panel") return "skip";
  if (/\bback\b|backer|\bleg\b|\bpost\b|\blid\b|\bside\b|\bend\b|\bupright\b|\bstile\b|\bjamb\b|\bcasing\b|\bslat\b/.test(p.name.toLowerCase()) && !/shelf|rail|apron|stretcher|cleat|divider|bracket|kick/.test(p.name.toLowerCase())) return "skip";
  if (p.type === "upright") return "skip";
  if (/bracket/.test(nm)) return "bracket";
  const { width: w, height: h, depth: d } = p.size;
  const thin = Math.min(w, h, d);
  if (p.polygon && p.polygon.plane === "xy") return "skip";
  if (h === thin && h < Math.min(w, d) - 1e-6) return "horizontal";
  if (/apron|stretcher|rail|cleat|kick|toe/.test(nm)) return "rail";
  if (w === thin && (p.type === "divider" || /divider|partition/.test(nm))) return "divider";
  return "skip";
}

/** The part families Ezra's rule names: a step that attaches one must say where. */
export const POSITIONED_ROLES: PlaceRole[] = ["horizontal", "divider", "rail", "bracket"];

type Ctx = {
  project: YardProject;
  panels: Panel[];
  box: Map<string, Box>;
  letters: Map<string, string>;
  letterCount: Map<string, number>;
  floor: boolean;
  unitBottom: number;
};

function nameOf(ctx: Ctx, p: Panel): string {
  const L = ctx.letters.get(p.id);
  const fam = cutListName(p.name, p.type);
  if (!L) return p.name;
  if ((ctx.letterCount.get(L) ?? 0) <= 1) return `${L} ${fam}`;
  const nm = p.name.replace(/\s*\([^)]*\)/g, "").trim();
  return nm.toLowerCase() === fam.toLowerCase() ? `${L} ${fam}` : `${L} ${nm}`;
}

/** "B and C" / "both I dividers" / "each F leg" — the supports a mark goes on. */
function groupTalk(ctx: Ctx, ids: string[]): string {
  const ps = ids.map((id) => ctx.panels.find((p) => p.id === id)).filter((p): p is Panel => !!p);
  if (!ps.length) return "";
  const byL = new Map<string, Panel[]>();
  const loose: Panel[] = [];
  for (const p of ps) {
    const L = ctx.letters.get(p.id);
    if (L) byL.set(L, [...(byL.get(L) ?? []), p]);
    else loose.push(p);
  }
  const parts: string[] = [];
  for (const [L, list] of [...byL.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fam = cutListName(list[0].name, list[0].type).toLowerCase();
    if (list.length === 1) parts.push(L);
    else if (list.length === 2) parts.push(`both ${L} ${fam.replace(/y$/, "ie")}s`);
    else parts.push(`each ${L} ${fam}`);
  }
  for (const p of loose) parts.push(p.name.toLowerCase().startsWith("the ") ? p.name : `the ${p.name.toLowerCase()}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const plural = (fam: string) => shopPlural(fam, 2).toLowerCase();
const countWord = (n: number) => (n === 2 ? "both" : `all ${n}`);

function listTalk(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const isVertical = (p: Panel) => {
  const r = placeRole(p);
  if (r === "door" || r === "drawer" || r === "front") return false;
  if (p.type === "back" || p.type === "mirror" || p.type === "glass_panel") return false;
  const { width: w, height: h, depth: d } = p.size;
  return h > 3 && h >= Math.max(w, d) * 0.5;
};

/** Vertical parts touching the x-ends of a part (uprights, dividers, legs) — where the marks go. */
function supportsOf(ctx: Ctx, p: Panel): string[] {
  const b = ctx.box.get(p.id)!;
  const out: string[] = [];
  for (const q of ctx.panels) {
    if (q.id === p.id || !isVertical(q)) continue;
    const c = ctx.box.get(q.id)!;
    if (ov(b.min.y, b.max.y, c.min.y, c.max.y) < -EPS) continue;
    if (ov(b.min.z, b.max.z, c.min.z, c.max.z) <= EPS) continue;
    const leftTouch = Math.abs(c.max.x - b.min.x) < 0.8 && c.min.x <= b.min.x + 0.1;
    const rightTouch = Math.abs(c.min.x - b.max.x) < 0.8 && c.max.x >= b.max.x - 0.1;
    if (leftTouch || rightTouch) out.push(q.id);
  }
  return out;
}

/** Placed horizontal panel directly under p (bottom panel first), else null → floor / unit bottom. */
function referenceUnder(ctx: Ctx, p: Panel, placed: Set<string>, anyHorizontal: boolean): Panel | null {
  const b = ctx.box.get(p.id)!;
  let best: Panel | null = null;
  for (const q of ctx.panels) {
    if (q.id === p.id || !placed.has(q.id) || placeRole(q) !== "horizontal") continue;
    if (!anyHorizontal && !(q.type === "bottom" || /\bbottom\b/i.test(q.name))) continue;
    const c = ctx.box.get(q.id)!;
    if (c.max.y > b.min.y + EPS) continue;
    const xo = ov(b.min.x, b.max.x, c.min.x, c.max.x);
    if (xo < (b.max.x - b.min.x) * 0.5 - EPS) continue;
    if (ov(b.min.z, b.max.z, c.min.z, c.max.z) <= EPS) continue;
    if (!best || c.max.y > ctx.box.get(best.id)!.max.y) best = q;
  }
  return best;
}

function refTalk(ctx: Ctx, ref: Panel | null) {
  if (ref) return `the top of ${nameOf(ctx, ref)}`;
  return ctx.floor ? "the floor" : "the bottom edge of the unit";
}

function refY(ctx: Ctx, ref: Panel | null) {
  return ref ? ctx.box.get(ref.id)!.max.y : ctx.floor ? 0 : ctx.unitBottom;
}

function frontOf(ctx: Ctx, ids: string[]): number | null {
  if (!ids.length) return null;
  return Math.max(...ids.map((id) => ctx.box.get(id)!.max.z));
}

// ───────────────────────── per-role talk ─────────────────────────

function horizontalTalk(ctx: Ctx, group: Panel[], placed: Set<string>, step: AssemblyStep, out: StepPlacement) {
  const text = `${step.title} ${step.description}`.toLowerCase();
  const first = group[0];
  const sups = [...new Set(group.flatMap((p) => supportsOf(ctx, p)))];
  const supTalk = groupTalk(ctx, sups);
  const tops = group.map((p) => ctx.box.get(p.id)!.max.y);
  const supTop0 = sups.length ? Math.max(...sups.map((id) => ctx.box.get(id)!.max.y)) : null;
  const flushTop = supTop0 != null && tops.every((t) => Math.abs(t - supTop0) < EPS);
  // A top flush with the ends of its sides reads from the floor; inside parts read from the bottom panel.
  // Parts it sits on (divider tops, rails, cleats): the underside is located by them.
  const b1 = ctx.box.get(first.id)!;
  const restsOn = ctx.panels.filter((q) => {
    if (group.some((g) => g.id === q.id) || placeRole(q) === "door" || placeRole(q) === "drawer" || placeRole(q) === "front") return false;
    const c = ctx.box.get(q.id)!;
    return Math.abs(c.max.y - b1.min.y) < EPS && ov(b1.min.x, b1.max.x, c.min.x, c.max.x) > EPS && ov(b1.min.z, b1.max.z, c.min.z, c.max.z) > EPS && placeRole(q) !== "horizontal";
  });
  const onVerticals = restsOn.some((q) => isVertical(q));
  const ref = flushTop || onVerticals ? null : referenceUnder(ctx, first, placed, false);
  const ry = refY(ctx, ref);
  const wallRest = !ctx.floor && restsOn.length > 0 && !sups.length;
  for (const p of group) {
    const t = ctx.box.get(p.id)!.max.y;
    if (!wallRest) out.measures.push({ kind: "top", id: p.id, refId: ref?.id ?? null, refY: ry, value: t - ry });
  }
  const uniq: number[] = [];
  for (const t of [...tops].sort((a, b) => a - b)) if (!uniq.some((u) => Math.abs(u - t) < 1 / 32)) uniq.push(t);
  const floorTalk = (t: number) => (ref && ctx.floor ? ` (${f(t)} from the floor)` : "");
  const L = ctx.letters.get(first.id);
  const fam = cutListName(first.name, first.type).toLowerCase();
  const supTop = sups.length ? Math.max(...sups.map((id) => ctx.box.get(id)!.max.y)) : null;
  const supBottom = sups.length ? Math.min(...sups.map((id) => ctx.box.get(id)!.min.y)) : null;
  if (group.length === 1 || uniq.length === 1) {
    const t = uniq[0];
    const who = group.length === 1 ? nameOf(ctx, first) : `${countWord(group.length)} ${L ? `${L} ` : ""}${plural(fam)}`;
    const topWord = group.length === 1 ? `Top of ${who} sits` : `Tops of ${who} sit`;
    let s = `${topWord} ${f(t - ry)} up from ${refTalk(ctx, ref)}${floorTalk(t)}`;
    if (supTop != null && Math.abs(supTop - t) < EPS) s += ` — flush with the top ends of ${supTalk}`;
    else if (supBottom != null && Math.abs(ctx.box.get(first.id)!.min.y - supBottom) < EPS && !ref) s += ` — flush with the bottom ends of ${supTalk}`;
    // Wall-hung on brackets/cleats: the wall height is the maker's call; the brackets locate it.
    if (!wallRest) out.sentences.push(`${s}.`);
    const underside = ctx.box.get(first.id)!.min.y - ry;
    const flushEnd = supTop != null && Math.abs(supTop - t) < EPS;
    if (restsOn.length) {
      const on = groupTalk(ctx, restsOn.map((q) => q.id));
      let r = wallRest ? `Set it on the top of ${on}` : `Its underside rests on the top of ${on}, ${f(b1.min.y - ry)} up from ${refTalk(ctx, ref)}`;
      // Overhang only for parts that sit on a base with nothing at their ends (tops, bracket shelves).
      const oh = sups.length ? "" : overhangTalk(ctx, first, restsOn);
      if (oh) r += `; ${oh}`;
      out.sentences.push(`${r}.`);
      out.measures.push({ kind: "rest", id: first.id, value: b1.min.y - ry });
    } else if (sups.length && !flushEnd && underside > EPS) {
      out.sentences.push(`Mark ${f(t - ry)} up from ${refTalk(ctx, ref)} on the inside face of ${supTalk} and line the top face up with the marks.`);
      if (underside >= 1.5 && underside <= 30) {
        out.sentences.push(`Or cut a spacer block ${f(underside)} long, stand it on ${ref ? nameOf(ctx, ref) : ctx.floor ? "the floor" : "the bottom edge"}, and rest the part on it while you screw.`);
      }
    }
  } else {
    // How many shelves sit at each height: equal counts mean every bay matches; uneven counts are said as such.
    const counts = uniq.map((u) => tops.filter((t) => Math.abs(t - u) < 1 / 32).length);
    const most = Math.max(...counts);
    let same = "";
    if (most > 1 && counts.every((c) => c === most)) same = " — the same in each bay";
    else if (most > 1) {
      const all = uniq.filter((_, i) => counts[i] === most).map((t) => f(t - ry));
      const some = uniq.map((t, i) => ({ t, c: counts[i] })).filter((x) => x.c < most);
      const byC = [...new Set(some.map((x) => x.c))].sort((a, b) => b - a);
      const parts = byC.map((c) => `${listTalk(some.filter((x) => x.c === c).map((x) => f(x.t - ry)))} in ${c === 1 ? "one bay" : `${c} bays`} only`);
      same = ` (${listTalk(all)} in ${most === 2 ? "both" : `all ${most}`} bays; ${parts.join("; ")})`;
    }
    const vals = uniq.map((t) => f(t - ry));
    let s = `Tops of the ${L ? `${L} ` : ""}${plural(fam)} sit ${listTalk(vals)} up from ${refTalk(ctx, ref)}`;
    if (ref && ctx.floor) s += ` (${listTalk(uniq.map((t) => f(t)))} from the floor)`;
    out.sentences.push(`${s}${same}.`);
    const gaps = uniq.slice(1).map((t, i) => t - uniq[i]);
    const even = gaps.every((g) => Math.abs(g - gaps[0]) < 1 / 16);
    if (even) {
      out.sentences.push(`That is ${f(gaps[0])} apart, measured top to top.`);
      out.measures.push({ kind: "spacing", ids: group.map((p) => p.id), value: gaps[0] });
    } else {
      out.sentences.push(`Gaps top to top: ${listTalk(gaps.map((g) => f(g)))}.`);
    }
    const underside = uniq[0] - (first.size.height) - ry;
    if (sups.length) {
      out.sentences.push(`Mark every height on the inside face of ${supTalk} before you set any ${fam}.`);
      if (underside >= 1.5 && underside <= 30) {
        out.sentences.push(`Or cut a spacer block ${f(underside)} long, stand it on ${ref ? nameOf(ctx, ref) : ctx.floor ? "the floor" : "the bottom edge"}, and rest the lowest ${fam} on it.`);
      }
    }
  }
  // Setback from the front of the supports (or the unit front).
  // A shaped, turned support (leaning rail) has no single front line — skip the setback against it.
  const shapedSup = sups.some((id) => { const q = ctx.panels.find((x) => x.id === id); return !!(q?.polygon && q.yaw); });
  const front = shapedSup ? null : frontOf(ctx, sups);
  if (front != null && !first.yaw) {
    const gaps = group.map((p) => front - ctx.box.get(p.id)!.max.z);
    const g = gaps[0];
    if (gaps.every((x) => Math.abs(x - g) < 1 / 16) && Math.abs(g) <= 6) {
      for (const p of group) out.measures.push({ kind: "setback", id: p.id, value: front - ctx.box.get(p.id)!.max.z });
      if (Math.abs(g) < EPS) out.sentences.push(`Front edge flush with the front of ${supTalk}.`);
      else if (g > 0) out.sentences.push(`Front edge set back ${f(g)} from the front of ${supTalk}.`);
      else out.sentences.push(`Front edge stands ${f(-g)} proud of the front of ${supTalk}.`);
    }
  }
  // Adjustable shelves: default spot + the range the pins allow.
  const adjustable = /adjustable/.test(text) || (/\bpins?\b/.test(text) && !/\bno pins\b|\bnot? (?:use )?(?:shelf )?pins\b|\bfixed\b/.test(text));
  if (adjustable && /shelf/.test(fam)) {
    const b = ctx.box.get(first.id)!;
    const above = ctx.panels
      .filter((q) => q.id !== first.id && placeRole(q) === "horizontal" && !group.some((g) => g.id === q.id))
      .map((q) => ({ q, c: ctx.box.get(q.id)! }))
      .filter(({ c }) => c.min.y >= b.max.y - EPS && ov(b.min.x, b.max.x, c.min.x, c.max.x) > (b.max.x - b.min.x) * 0.5)
      .sort((a, c) => a.c.min.y - c.c.min.y)[0];
    if (above) {
      const lo = ref ? `the top of ${nameOf(ctx, ref)} (${f(ry)})` : `${f(ry)}`;
      out.sentences.push(`Adjustable: those are the default spots — the pins let you set a ${fam} anywhere between ${lo} and the underside of ${nameOf(ctx, above.q)} (${f(above.c.min.y)}).`);
    }
  }
  // Arrow on the step picture: reference plane → top face, beside the nearest front corner.
  const b0 = ctx.box.get(first.id)!;
  const xs = Math.max(...ctx.panels.map((q) => ctx.box.get(q.id)!.max.x));
  const x = xs + 2;
  const z = b0.max.z;
  void x;
  const refMaxX = ref ? ctx.box.get(ref.id)!.max.x : Math.max(...sups.map((id) => ctx.box.get(id)!.max.x), b0.max.x);
  if (!out.arrows.length && !wallRest) out.arrows.push(...heightChain(ctx, uniq.slice(0, 6), ry, z, b0.max.x, refMaxX));
}

function dividerTalk(ctx: Ctx, p: Panel, out: StepPlacement) {
  const b = ctx.box.get(p.id)!;
  const near = (dir: -1 | 1) => {
    let best: { q: Panel; d: number } | null = null;
    for (const q of ctx.panels) {
      // Measure to the walls a divider stands between (sides, other dividers) — not kick strips or rails.
      if (q.id === p.id || !isVertical(q) || !(q.type === "upright" || q.type === "divider")) continue;
      const c = ctx.box.get(q.id)!;
      if (ov(b.min.y, b.max.y, c.min.y, c.max.y) <= EPS || ov(b.min.z, b.max.z, c.min.z, c.max.z) <= EPS) continue;
      const d = dir < 0 ? b.min.x - c.max.x : c.min.x - b.max.x;
      if (d < -EPS) continue;
      if (!best || d < best.d) best = { q, d };
    }
    return best;
  };
  const l = near(-1);
  const r = near(1);
  const who = nameOf(ctx, p);
  if (l) out.measures.push({ kind: "across", id: p.id, neighborId: l.q.id, side: "left", value: l.d });
  if (r) out.measures.push({ kind: "across", id: p.id, neighborId: r.q.id, side: "right", value: r.d });
  const face = (q: Panel) => (isOuter(ctx, q) ? `the inside face of ${nameOf(ctx, q)}` : nameOf(ctx, q));
  if (l && r && Math.abs(l.d - r.d) < 1 / 16) {
    out.sentences.push(`Center ${who}: ${f(l.d)} from ${face(l.q)} and ${f(r.d)} from ${face(r.q)}.`);
  } else if (l && r) {
    out.sentences.push(`${who} stands ${f(l.d)} from ${face(l.q)} and ${f(r.d)} from ${face(r.q)}.`);
  } else if (l || r) {
    const n = (l ?? r)!;
    out.sentences.push(`${who} stands ${f(n.d)} from ${face(n.q)}.`);
  } else return;
  const base = ctx.panels.find((q) => {
    if (q.id === p.id || placeRole(q) !== "horizontal") return false;
    const c = ctx.box.get(q.id)!;
    return c.max.y >= b.min.y - 0.1 && c.max.y <= b.min.y + 0.8 && ov(b.min.x, b.max.x, c.min.x, c.max.x) > EPS;
  });
  const on = base ? nameOf(ctx, base) : b.min.y < 0.1 && ctx.floor ? "the floor" : null;
  const cue = `Square a pencil line across ${on} at each mark and stand the divider on it.`;
  if (on && !out.sentences.includes(cue)) out.sentences.push(cue);
  // Low on the divider (near where it stands) so the part's letter callout up top never covers the label.
  const y = b.min.y + Math.min(3, (b.max.y - b.min.y) / 4);
  const z = b.max.z + 1;
  if (l) out.arrows.push({ a: { x: ctx.box.get(l.q.id)!.max.x, y, z }, b: { x: b.min.x, y, z }, label: f(l.d) });
  if (r && !(l && Math.abs(l.d - r.d) < 1 / 16)) out.arrows.push({ a: { x: b.max.x, y, z }, b: { x: ctx.box.get(r.q.id)!.min.x, y, z }, label: f(r.d) });
}

function isOuter(ctx: Ctx, q: Panel) {
  const c = ctx.box.get(q.id)!;
  const xs = ctx.panels.map((p) => ctx.box.get(p.id)!);
  const minX = Math.min(...xs.map((b) => b.min.x));
  const maxX = Math.max(...xs.map((b) => b.max.x));
  return Math.abs(c.min.x - minX) < 0.2 || Math.abs(c.max.x - maxX) < 0.2;
}

function railTalk(ctx: Ctx, group: Panel[], out: StepPlacement) {
  const first = group[0];
  const sups = [...new Set(group.flatMap((p) => railSupports(ctx, p)))];
  const supTalk = groupTalk(ctx, sups);
  const ref: Panel | null = null;
  const ry = refY(ctx, ref);
  const tops = group.map((p) => ctx.box.get(p.id)!.max.y);
  for (const p of group) out.measures.push({ kind: "top", id: p.id, refId: null, refY: ry, value: ctx.box.get(p.id)!.max.y - ry });
  const uniq: number[] = [];
  for (const t of [...tops].sort((a, b) => a - b)) if (!uniq.some((u) => Math.abs(u - t) < 1 / 32)) uniq.push(t);
  const L = ctx.letters.get(first.id);
  const fam = cutListName(first.name, first.type).toLowerCase();
  const supTop = sups.length ? Math.max(...sups.map((id) => ctx.box.get(id)!.max.y)) : null;
  const who = group.length === 1 ? nameOf(ctx, first) : `${countWord(group.length)} ${L ? `${L} ` : ""}${plural(fam)}`;
  const supTops = sups.map((id) => ctx.box.get(id)!.max.y);
  const evenTops = supTops.length > 0 && supTops.every((v) => Math.abs(v - supTops[0]) < 1 / 16);
  if (uniq.length === 1) {
    const t = uniq[0];
    let s = `${group.length === 1 ? "Top edge of" : "Top edges of"} ${who} ${group.length === 1 ? "sits" : "sit"} ${f(t - ry)} up from ${refTalk(ctx, ref)}`;
    if (supTop != null && evenTops && Math.abs(supTop - t) < EPS) s += ` — flush with the tops of ${supTalk}`;
    out.sentences.push(`${s}.`);
    if (supTop != null && evenTops && supTop - t > EPS && supTop - t < t - ry) out.sentences.push(`Mark ${f(supTop - t)} down from the top of ${supTalk} (or ${f(t - ry)} up from ${refTalk(ctx, ref)}) and line the top edge up with the marks.`);
  } else {
    out.sentences.push(`Top edges of the ${L ? `${L} ` : ""}${plural(fam)} sit ${listTalk(uniq.map((t) => f(t - ry)))} up from ${refTalk(ctx, ref)}.`);
    const gaps = uniq.slice(1).map((t, i) => t - uniq[i]);
    if (gaps.every((g) => Math.abs(g - gaps[0]) < 1 / 16)) {
      out.sentences.push(`That is ${f(gaps[0])} apart, measured top to top.`);
      out.measures.push({ kind: "spacing", ids: group.map((p) => p.id), value: gaps[0] });
    }
    if (sups.length) out.sentences.push(`Mark every height on ${supTalk} before you fix any ${fam}.`);
  }
  // Inset from the outside faces of the supports (legs) or the unit front.
  if (sups.length && !first.yaw) {
    const insets = group.map((p) => railInset(ctx, p, sups));
    const ok = insets.every((x) => x != null) && insets.every((x) => Math.abs((x as number) - (insets[0] as number)) < 1 / 16);
    if (ok) {
      const g = insets[0] as number;
      for (const p of group) out.measures.push({ kind: "setback", id: p.id, value: railInset(ctx, p, sups) as number });
      // Legs → "outside"; a cabinet's +z side is its front, -z its back.
      const legs = sups.every((id) => /\bleg\b|\bpost\b/i.test(ctx.panels.find((q) => q.id === id)?.name ?? ""));
      const bb = ctx.box.get(first.id)!;
      const alongX = bb.max.x - bb.min.x >= bb.max.z - bb.min.z;
      const midZ = unitCenter(ctx).z;
      const side = legs || !alongX ? "outside" : (bb.min.z + bb.max.z) / 2 >= midZ ? "front" : "back";
      const faceWord = side === "outside" ? "Outside face" : side === "front" ? "Front face" : "Back face";
      if (Math.abs(g) < EPS) out.sentences.push(`${faceWord} flush with the ${side} of ${supTalk}.`);
      else if (g > 0) out.sentences.push(`${faceWord} set ${side === "outside" ? "in" : "back"} ${f(g)} from the ${side} of ${supTalk}.`);
      else out.sentences.push(`${faceWord} stands ${f(-g)} proud of the ${side} of ${supTalk}.`);
    }
  }
  const b0 = ctx.box.get(first.id)!;
  const xs = Math.max(...ctx.panels.map((q) => ctx.box.get(q.id)!.max.x));
  void xs;
  if (!out.arrows.length) out.arrows.push(...heightChain(ctx, uniq.slice(0, 6), ry, b0.max.z, b0.max.x, Math.max(...sups.map((id) => ctx.box.get(id)!.max.x), b0.max.x)));
}

function railSupports(ctx: Ctx, p: Panel): string[] {
  const b = ctx.box.get(p.id)!;
  const alongX = b.max.x - b.min.x >= b.max.z - b.min.z;
  const out: string[] = [];
  for (const q of ctx.panels) {
    if (q.id === p.id || !isVertical(q)) continue;
    const c = ctx.box.get(q.id)!;
    if (ov(b.min.y, b.max.y, c.min.y, c.max.y) < -EPS) continue;
    if (alongX) {
      if (ov(b.min.z, b.max.z, c.min.z - 2, c.max.z + 2) <= 0) continue;
      if (Math.abs(c.max.x - b.min.x) < 0.8 || Math.abs(c.min.x - b.max.x) < 0.8) out.push(q.id);
    } else {
      if (ov(b.min.x, b.max.x, c.min.x - 2, c.max.x + 2) <= 0) continue;
      if (Math.abs(c.max.z - b.min.z) < 0.8 || Math.abs(c.min.z - b.max.z) < 0.8) out.push(q.id);
    }
  }
  return out;
}

function unitCenter(ctx: Ctx): V3 {
  const bs = ctx.panels.map((p) => ctx.box.get(p.id)!);
  const c = (k: "x" | "y" | "z") => (Math.min(...bs.map((b) => b.min[k])) + Math.max(...bs.map((b) => b.max[k]))) / 2;
  return { x: c("x"), y: c("y"), z: c("z") };
}

/** Distance from a rail's outside face to the outside face of the parts it joins. */
function railInset(ctx: Ctx, p: Panel, sups: string[]): number | null {
  const b = ctx.box.get(p.id)!;
  const cs = sups.map((id) => ctx.box.get(id)!);
  const alongX = b.max.x - b.min.x >= b.max.z - b.min.z;
  const u = unitCenter(ctx);
  if (alongX) {
    const zMin = Math.min(...cs.map((c) => c.min.z));
    const zMax = Math.max(...cs.map((c) => c.max.z));
    return (b.min.z + b.max.z) / 2 >= u.z ? zMax - b.max.z : b.min.z - zMin;
  }
  const xMin = Math.min(...cs.map((c) => c.min.x));
  const xMax = Math.max(...cs.map((c) => c.max.x));
  return (b.min.x + b.max.x) / 2 >= u.x ? xMax - b.max.x : b.min.x - xMin;
}

function bracketTalk(ctx: Ctx, group: Panel[], out: StepPlacement) {
  if (!group.length) return;
  const bs = group.map((p) => ({ p, c: ctx.box.get(p.id)! })).sort((a, b) => a.c.min.x - b.c.min.x);
  const top = Math.max(...bs.map(({ c }) => c.max.y));
  const shelf = ctx.panels.find((q) => {
    if (placeRole(q) !== "horizontal") return false;
    const c = ctx.box.get(q.id)!;
    return Math.abs(c.min.y - top) < 0.1;
  });
  out.hardware.push("bracket");
  if (bs.length >= 2) {
    const centers = bs.map(({ c }) => (c.min.x + c.max.x) / 2);
    const gaps = centers.slice(1).map((x, i) => x - centers[i]);
    out.measures.push({ kind: "bracket", ids: group.map((p) => p.id), value: gaps[0] });
    const even = gaps.every((g) => Math.abs(g - gaps[0]) < 1 / 16);
    let s = even ? `Bracket centers ${f(gaps[0])} apart` : `Bracket centers ${listTalk(gaps.map((g) => f(g)))} apart`;
    if (shelf) {
      const sc = ctx.box.get(shelf.id)!;
      const inL = centers[0] - sc.min.x;
      const inR = sc.max.x - centers[centers.length - 1];
      s += Math.abs(inL - inR) < 1 / 16 ? `, each ${f(inL)} in from its end of ${nameOf(ctx, shelf)} (to the center)` : `, ${f(inL)} and ${f(inR)} in from the ends of ${nameOf(ctx, shelf)} (to the center)`;
    }
    out.sentences.push(`${s}.`);
    out.sentences.push(`Snap one level line for the bracket tops. Studs are usually 16" apart — if a bracket misses a stud, shift the brackets to the nearest studs and keep them even under the shelf.`);
  } else {
    out.sentences.push(`Level the bracket top and center it under the shelf.`);
  }
}

/** Overhang of a resting part past what it sits on, per axis (null for round tops). */
function overhangOf(ctx: Ctx, p: Panel, under: Panel[]) {
  if (/round|dia/i.test(`${p.name} ${p.cutNote ?? ""}`) || p.outline || p.polygon) return null;
  const b = ctx.box.get(p.id)!;
  const cs = under.map((q) => ctx.box.get(q.id)!);
  const l = Math.min(...cs.map((c) => c.min.x)) - b.min.x;
  const r = b.max.x - Math.max(...cs.map((c) => c.max.x));
  const bk = Math.min(...cs.map((c) => c.min.z)) - b.min.z;
  const fr = b.max.z - Math.max(...cs.map((c) => c.max.z));
  return { x: l, l, r, bk, fr };
}

function overhangTalk(ctx: Ctx, p: Panel, under: Panel[]): string {
  const o = overhangOf(ctx, p, under);
  if (!o) return "";
  const eq = (a: number, b: number) => Math.abs(a - b) < 1 / 16;
  const ends = eq(o.l, o.r) ? (o.l > EPS ? `${f(o.l)} past each end` : "") : `${f(o.l)} past the left end and ${f(o.r)} past the right`;
  const fb = eq(o.bk, o.fr)
    ? o.fr > EPS
      ? `${f(o.fr)} front and back`
      : ""
    : Math.abs(o.bk) < EPS
      ? `${f(o.fr)} past the front (back edge flush)`
      : Math.abs(o.fr) < EPS
        ? `${f(o.bk)} past the back (front edge flush)`
        : `${f(o.fr)} at the front and ${f(o.bk)} at the back`;
  if (ends && fb && eq(o.l, o.r) && eq(o.bk, o.fr) && eq(o.l, o.fr)) return `centered, overhanging ${f(o.l)} on all four sides`;
  const bits = [ends, fb].filter(Boolean);
  return bits.length ? `overhang ${bits.join(" and ")}` : "";
}

/** Bought glass / hung panels: bottom edge height and side-to-side spot. */
function hungTalk(ctx: Ctx, p: Panel, out: StepPlacement) {
  const b = ctx.box.get(p.id)!;
  const below = ctx.panels
    .filter((q) => q.id !== p.id && placeRole(q) === "horizontal")
    .map((q) => ({ q, c: ctx.box.get(q.id)! }))
    .filter(({ c }) => c.max.y <= b.min.y + EPS && ov(b.min.x, b.max.x, c.min.x, c.max.x) > EPS)
    .sort((a, c) => c.c.max.y - a.c.max.y)[0];
  const ry = ctx.floor ? 0 : ctx.unitBottom;
  out.measures.push({ kind: "top", id: p.id, refId: null, refY: ry, value: b.min.y - ry });
  let s = `Bottom edge of the ${p.name.toLowerCase()} sits ${f(b.min.y - ry)} up from ${ctx.floor ? "the floor" : "the bottom edge of the unit"}`;
  if (below) s += ` — ${f(b.min.y - below.c.max.y)} above the top of ${nameOf(ctx, below.q)}`;
  out.sentences.push(`${s}.`);
  const side = (dir: -1 | 1) => {
    let best: { q: Panel; d: number } | null = null;
    for (const q of ctx.panels) {
      // Measure to the walls a divider stands between (sides, other dividers) — not kick strips or rails.
      if (q.id === p.id || !isVertical(q) || !(q.type === "upright" || q.type === "divider")) continue;
      const c = ctx.box.get(q.id)!;
      if (ov(b.min.y, b.max.y, c.min.y, c.max.y) <= EPS) continue;
      const d = dir < 0 ? b.min.x - c.max.x : c.min.x - b.max.x;
      if (d < -EPS) continue;
      if (!best || d < best.d) best = { q, d };
    }
    return best;
  };
  const l = side(-1);
  const r = side(1);
  if (l && r) {
    out.measures.push({ kind: "across", id: p.id, neighborId: l.q.id, side: "left", value: l.d });
    out.measures.push({ kind: "across", id: p.id, neighborId: r.q.id, side: "right", value: r.d });
    out.sentences.push(
      Math.abs(l.d - r.d) < 1 / 16
        ? `Centered side to side: ${f(l.d)} from the inside face of ${nameOf(ctx, l.q)} and of ${nameOf(ctx, r.q)}.`
        : `${f(l.d)} from the inside face of ${nameOf(ctx, l.q)} and ${f(r.d)} from ${nameOf(ctx, r.q)}.`,
    );
  }
  const xs = Math.max(...ctx.panels.map((q) => ctx.box.get(q.id)!.max.x));
  void xs;
  if (!out.arrows.length) out.arrows.push(...heightChain(ctx, [b.min.y], ry, b.max.z, b.max.x, b.max.x));
}

// ───────────────────────── hardware ─────────────────────────

function hingeTalk(ctx: Ctx, doors: Panel[], step: AssemblyStep, out: StepPlacement) {
  const text = `${step.title} ${step.description}`;
  const m = text.match(/(\d+)\s+(?:concealed\s+|soft-close\s+|butt\s+|piano\s+)?hinges?\s+(?:each|per\s+(?:door|lid))/i) ?? text.match(/(?:each|per)\s+(?:door|lid)[^.]*?(\d+)\s+(?:concealed\s+)?hinges?/i);
  const n = m ? parseInt(m[1], 10) : 2;
  if (/piano/i.test(text)) return;
  out.hardware.push("hinge");
  const seen = new Set<string>();
  for (const d of doors) {
    const c = ctx.box.get(d.id)!;
    const h = c.max.y - c.min.y;
    const inset = h >= 12 ? 3 : Math.max(1.5, Math.round(h * 0.2 * 4) / 4);
    const key = `${Math.round(h * 16)}:${Math.round(c.min.y * 16)}`;
    out.measures.push({ kind: "hinge", id: d.id, value: inset });
    out.measures.push({ kind: "hingeHeight", id: d.id, value: c.min.y + inset });
    if (seen.has(key)) continue;
    seen.add(key);
    const same = doors.filter((o) => {
      const q = ctx.box.get(o.id)!;
      return `${Math.round((q.max.y - q.min.y) * 16)}:${Math.round(q.min.y * 16)}` === key;
    });
    const who = same.length > 1 ? `each ${ctx.letters.get(d.id) ? `${ctx.letters.get(d.id)} ` : ""}door` : nameOf(ctx, d);
    let s = `Hinge centers ${f(inset)} down from the top and ${f(inset)} up from the bottom of ${who} (${f(h - inset * 2)} apart)`;
    if (n >= 3) s += `, with the middle hinge at ${f(h / 2)} — halfway`;
    s += `, on the hinge edge`;
    const lo = c.min.y + inset;
    const hi = c.max.y - inset;
    s += ctx.floor ? ` — on the cabinet side that is ${f(lo)} and ${f(hi)} up from the floor` : "";
    out.sentences.push(`${s}.`);
  }
}

function pullTalk(ctx: Ctx, fronts: Panel[], label: string, out: StepPlacement) {
  out.hardware.push("pull");
  const seen = new Set<string>();
  for (const p of fronts) {
    const c = ctx.box.get(p.id)!;
    const w = c.max.x - c.min.x;
    const h = c.max.y - c.min.y;
    const key = `${Math.round(w * 16)}x${Math.round(h * 16)}`;
    out.measures.push({ kind: "pull", id: p.id, value: h / 2 });
    if (seen.has(key)) continue;
    seen.add(key);
    const n = fronts.filter((o) => {
      const q = ctx.box.get(o.id)!;
      return `${Math.round((q.max.x - q.min.x) * 16)}x${Math.round((q.max.y - q.min.y) * 16)}` === key;
    }).length;
    const who = n > 1 ? `each ${f(w)} × ${f(h)} ${label}` : `the ${f(w)} × ${f(h)} ${label}`;
    out.sentences.push(`Pull centered on ${who}: ${f(w / 2)} from each side and ${f(h / 2)} down from the top edge — mark the center with crossed diagonals.`);
  }
}

/**
 * Drawer fronts: where each one sits — bottom edge from the floor, the reveal to the wall
 * centerline beside it, and the gap between fronts stacked in a bank. All from the model.
 */
function frontTalk(ctx: Ctx, fronts: Panel[], out: StepPlacement) {
  const walls = ctx.panels.filter((q) => q.type === "upright" || q.type === "divider");
  const banks: Panel[][] = [];
  for (const d of [...fronts].sort((a, b) => ctx.box.get(a.id)!.min.x - ctx.box.get(b.id)!.min.x)) {
    const c = ctx.box.get(d.id)!;
    const bank = banks.find((bk) => ov(c.min.x, c.max.x, ctx.box.get(bk[0].id)!.min.x, ctx.box.get(bk[0].id)!.max.x) > (c.max.x - c.min.x) * 0.5);
    if (bank) bank.push(d);
    else banks.push([d]);
  }
  const talks: string[] = [];
  for (const bank of banks) {
    bank.sort((a, b) => ctx.box.get(a.id)!.min.y - ctx.box.get(b.id)!.min.y);
    for (const p of bank) out.measures.push({ kind: "frontBottom", id: p.id, value: ctx.box.get(p.id)!.min.y });
    const bottoms = bank.map((p) => f(ctx.box.get(p.id)!.min.y));
    const gaps = bank.slice(1).map((p, i) => ctx.box.get(p.id)!.min.y - ctx.box.get(bank[i].id)!.max.y);
    const c = ctx.box.get(bank[0].id)!;
    const cx = (c.min.x + c.max.x) / 2;
    const zone = walls.map((q) => ctx.box.get(q.id)!).filter((w) => ov(w.min.y, w.max.y, c.min.y, c.max.y) > EPS);
    const left = zone.filter((w) => w.max.x <= cx).sort((a, b) => b.max.x - a.max.x)[0];
    const right = zone.filter((w) => w.min.x >= cx).sort((a, b) => a.min.x - b.min.x)[0];
    const revL = left ? c.min.x - (left.min.x + left.max.x) / 2 : null;
    const revR = right ? (right.min.x + right.max.x) / 2 - c.max.x : null;
    let t = `bottom edge${bank.length > 1 ? "s" : ""} ${listTalk(bottoms)} up from the floor`;
    const gapU = [...new Set(gaps.map((g) => f(g)))];
    if (gapU.length === 1 && gaps.length) t += `, ${gapU[0]} gap between fronts`;
    else if (gaps.length) t += `, gaps between fronts ${listTalk(gaps.map((g) => f(g)))} from the bottom up`;
    if (revL != null && revR != null && Math.abs(revL - revR) < 1 / 32) t += `, sides ${f(Math.abs(revL))} ${revL >= 0 ? "in from" : "past"} the centerline of the wall on each side`;
    talks.push(t);
  }
  const uniq = [...new Set(talks)];
  const lead = uniq.length === 1 && banks.length > 1 ? "Drawer fronts, the same in every bank" : fronts.length > 1 ? "Drawer fronts" : "Drawer front";
  out.sentences.push(`${lead}: ${uniq.length === 1 ? uniq[0] : uniq.map((t, i) => `bank ${i + 1} — ${t}`).join("; ")}. Hold each front with double-sided tape or clamps, check the gaps, then screw it on from inside the box.`);
}

function slideTalk(ctx: Ctx, drawers: Panel[], placed: Set<string>, out: StepPlacement) {
  out.hardware.push("slide");
  // Banks: drawers stacked in the same x range.
  const banks: Panel[][] = [];
  for (const d of [...drawers].sort((a, b) => ctx.box.get(a.id)!.min.x - ctx.box.get(b.id)!.min.x)) {
    const c = ctx.box.get(d.id)!;
    const bank = banks.find((bk) => ov(c.min.x, c.max.x, ctx.box.get(bk[0].id)!.min.x, ctx.box.get(bk[0].id)!.max.x) > (c.max.x - c.min.x) * 0.5);
    if (bank) bank.push(d);
    else banks.push([d]);
  }
  const lines: { talk: string; key: string }[] = [];
  const sideIds = new Set<string>();
  for (const bk of banks) {
    bk.sort((a, b) => ctx.box.get(a.id)!.min.y - ctx.box.get(b.id)!.min.y);
    const low = bk[0];
    const ref = referenceUnder(ctx, low, new Set([...placed, ...ctx.panels.map((p) => p.id)]), true);
    const ry = refY(ctx, ref);
    const vals: number[] = [];
    for (const d of bk) {
      const c = ctx.box.get(d.id)!;
      const mid = (c.min.y + c.max.y) / 2;
      vals.push(mid);
      out.measures.push({ kind: "slide", id: d.id, refId: ref?.id ?? null, refY: ry, value: mid - ry });
    }
    const talk = `${listTalk(vals.map((v) => f(v - ry)))} up from ${refTalk(ctx, ref)}${ref && ctx.floor ? ` (${listTalk(vals.map((v) => f(v)))} from the floor)` : ""}`;
    lines.push({ talk, key: talk });
    const lb = ctx.box.get(low.id)!;
    for (const q of ctx.panels) {
      if (!isVertical(q)) continue;
      const c = ctx.box.get(q.id)!;
      if (ov(lb.min.y, lb.max.y, c.min.y, c.max.y) <= EPS || ov(lb.min.z, lb.max.z, c.min.z, c.max.z) <= EPS) continue;
      if (Math.abs(c.max.x - lb.min.x) < 1.2 || Math.abs(c.min.x - lb.max.x) < 1.2) sideIds.add(q.id);
    }
  }
  const uniq = [...new Set(lines.map((l) => l.key))];
  const plural = drawers.length > 1;
  const head = `Slide center line${plural ? "s" : ""} (the middle of each drawer box's height)`;
  if (uniq.length === 1) out.sentences.push(`${head}: ${uniq[0]}${banks.length > 1 ? " — the same in every bank" : ""}.`);
  else out.sentences.push(`${head}: ${lines.map((l, i) => `bank ${i + 1} ${l.talk}`).join("; ")}.`);
  if (sideIds.size) out.sentences.push(`Mark every line on ${groupTalk(ctx, [...sideIds])} before you hang any slide, and keep each slide's front end on the line.`);
}

// ───────────────────────── stick builds (instances) ─────────────────────────

type Stick = { id: string; role: string; a: V3; b: V3 };

function instanceTalk(project: YardProject, ids: string[], craft: boolean, out: StepPlacement) {
  const sticks: Stick[] = project.instances
    .filter((i) => ids.includes(i.id) && i.from && i.to)
    .map((i) => ({ id: i.id, role: (i.role ?? "member").toLowerCase(), a: i.from!, b: i.to! }));
  if (!sticks.length) return;
  const all = project.instances.filter((i) => i.from && i.to);
  const base = all.length ? Math.min(...all.flatMap((i) => [i.from!.y, i.to!.y])) : 0;
  const refWord = craft ? "the bench" : "the floor";
  const byRole = new Map<string, Stick[]>();
  for (const st of sticks) byRole.set(st.role, [...(byRole.get(st.role) ?? []), st]);
  const legTops = all
    .filter((i) => (i.role ?? "") === "leg" && Math.abs(i.from!.x - i.to!.x) < 0.05 && Math.abs(i.from!.z - i.to!.z) < 0.05)
    .map((i) => Math.max(i.from!.y, i.to!.y));
  for (const [role, list] of byRole) {
    const word = plural(role);
    const flat = list.filter((st) => Math.abs(st.a.y - st.b.y) < 0.05);
    const plumb = list.filter((st) => Math.abs(st.a.x - st.b.x) < 0.05 && Math.abs(st.a.z - st.b.z) < 0.05 && !flat.includes(st));
    const slant = list.filter((st) => !flat.includes(st) && !plumb.includes(st));
    if (flat.length) {
      const hs: number[] = [];
      for (const st of flat) {
        out.measures.push({ kind: "center", id: st.id, value: st.a.y - base });
        if (!hs.some((h) => Math.abs(h - st.a.y) < 1 / 32)) hs.push(st.a.y);
      }
      hs.sort((x, y) => x - y);
      const n = flat.length;
      const at = (h: number) => (Math.abs(h - base) < 1 / 32 ? `flat on ${refWord}` : `${f(h - base)} up from ${refWord}`);
      let t: string;
      if (hs.length === 1) {
        t = `${n === 1 ? `The ${role} lies` : `All ${n} ${word} lie`} ${at(hs[0])} (center line)`;
        if (legTops.some((lt) => Math.abs(lt - hs[0]) < 1 / 16) && hs[0] - base > EPS) t += ` — level with the tops of the legs`;
      } else if (hs.length <= 6) {
        t = `The ${word} lie at ${listTalk(hs.map((h) => (Math.abs(h - base) < 1 / 32 ? (craft ? "bench level" : "floor level") : f(h - base))))} up from ${refWord} (center lines)`;
      } else {
        t = `The ${word} stack in ${hs.length} layers from ${f(hs[0] - base)} to ${f(hs[hs.length - 1] - base)} up from ${refWord} — about ${f((hs[hs.length - 1] - hs[0]) / (hs.length - 1))} per layer`;
      }
      out.sentences.push(`${t}.`);
    }
    if (plumb.length) {
      const xs = [...new Set(plumb.map((st) => Math.round(st.a.x * 16) / 16))].sort((a, b) => a - b);
      const zs = [...new Set(plumb.map((st) => Math.round(st.a.z * 16) / 16))].sort((a, b) => a - b);
      const h = Math.max(...plumb.map((st) => Math.abs(st.b.y - st.a.y)));
      let t = `${plumb.length === 1 ? `The ${role} stands` : `The ${plumb.length} ${word} stand`} plumb, ${f(h)} tall`;
      if (xs.length === 2 && zs.length <= 2) {
        const dx = xs[1] - xs[0];
        t += zs.length === 2 ? `, centers ${f(dx)} apart one way and ${f(zs[1] - zs[0])} the other — measure the diagonals equal` : `, centers ${f(dx)} apart`;
        out.measures.push({ kind: "spacing", ids: plumb.map((st) => st.id), value: dx });
      }
      out.sentences.push(`${t}.`);
    }
    if (slant.length) {
      const lo = Math.min(...slant.map((st) => Math.min(st.a.y, st.b.y))) - base;
      const hi = Math.max(...slant.map((st) => Math.max(st.a.y, st.b.y))) - base;
      out.sentences.push(`${slant.length === 1 ? `The slanted ${role} runs` : `The ${slant.length} slanted ${word} run`} from ${Math.abs(lo) < EPS ? refWord : `${f(lo)} up`} to ${f(hi)} up — end to end on the joints in the picture.`);
      for (const st of slant) out.measures.push({ kind: "center", id: st.id, value: (st.a.y + st.b.y) / 2 - base });
    }
  }
}

// ───────────────────────── the pass ─────────────────────────

/** Placement records per step, from the geometry. Same records feed text, arrows, guards. */
export function stepPlacements(project: YardProject, steps: AssemblyStep[], cutList: BuildPlan["cutList"], craft = false): StepPlacement[] {
  const panels = project.panels;
  const letters = partLetters(project, cutList);
  const letterCount = new Map<string, number>();
  for (const L of letters.values()) letterCount.set(L, (letterCount.get(L) ?? 0) + 1);
  const box = new Map(panels.map((p) => [p.id, boxOf(p)]));
  const minY = panels.length ? Math.min(...panels.map((p) => box.get(p.id)!.min.y)) : 0;
  const wall = project.assumptions?.installMode === "wall";
  const ctx: Ctx = { project, panels, box, letters, letterCount, floor: !wall && Math.abs(minY) < 0.1, unitBottom: minY };
  const sp = planStepParts(project, steps, letters);
  const placed = new Set<string>();
  const byId = new Map(panels.map((p) => [p.id, p]));
  return steps.map((s, i) => {
    const out: StepPlacement = { sentences: [], measures: [], arrows: [], positioned: [], hardware: [] };
    const st = sp[i];
    const text = `${s.title} ${s.description}`.toLowerCase();
    if (st.kind !== "build") return out;
    const fresh = st.fresh.map((id) => byId.get(id)).filter((p): p is Panel => !!p);
    const roles = new Map(fresh.map((p) => [p.id, placeRole(p)]));
    const pos = fresh.filter((p) => POSITIONED_ROLES.includes(roles.get(p.id)!));
    out.positioned = pos.map((p) => p.id);
    // Group horizontals and rails by letter (same size family) so repeats read as one sentence.
    const groups = (role: PlaceRole) => {
      const g = new Map<string, Panel[]>();
      for (const p of pos.filter((q) => roles.get(q.id) === role)) {
        const k = letters.get(p.id) ?? p.name;
        g.set(k, [...(g.get(k) ?? []), p]);
      }
      return [...g.values()];
    };
    for (const g of groups("horizontal")) horizontalTalk(ctx, g, placed, s, out);
    for (const g of groups("rail")) railTalk(ctx, g, out);
    for (const p of pos.filter((q) => roles.get(q.id) === "divider")) dividerTalk(ctx, p, out);
    for (const p of fresh.filter((q) => q.type === "mirror")) hungTalk(ctx, p, out);
    const brackets = pos.filter((q) => roles.get(q.id) === "bracket");
    if (brackets.length) bracketTalk(ctx, brackets, out);
    // Hardware: doors, drawers and fronts this step hangs (fresh or already built).
    const inStep = st.ids.map((id) => byId.get(id)).filter((p): p is Panel => !!p);
    const pick = (role: PlaceRole, word: RegExp) => {
      const a = inStep.filter((p) => placeRole(p) === role);
      if (a.length) return a;
      return word.test(text) ? panels.filter((p) => placeRole(p) === role) : [];
    };
    if (/\bhinges?\b/.test(text)) {
      const doors = pick("door", /\bdoors?\b/);
      if (doors.length) hingeTalk(ctx, doors, s, out);
    }
    if (/\bpulls?\b|\bknobs?\b/.test(text)) {
      const fronts = pick("front", /drawer front/);
      const doorsNow = /\bdoors?\b/.test(text) ? pick("door", /\bdoors?\b/) : [];
      const drawers = fronts.length ? [] : /drawer/.test(text) ? pick("drawer", /drawer/) : [];
      if (doorsNow.length && /\bhinges?\b|\bdoors?\b/.test(text)) pullTalk(ctx, doorsNow, "door", out);
      if (fronts.length) pullTalk(ctx, fronts, "drawer front", out);
      else if (drawers.length) pullTalk(ctx, drawers, "drawer front", out);
    }
    if (/drawer fronts?/.test(text)) {
      const fronts = pick("front", /drawer front/);
      if (fronts.length) frontTalk(ctx, fronts, out);
    }
    if (/\bslides?\b/.test(text)) {
      const drawers = pick("drawer", /drawer/);
      if (drawers.length) slideTalk(ctx, drawers, placed, out);
    }
    // One arrow per span (two dividers share the gap between them).
    const key = (m: PlacementArrow) => [m.a, m.b].map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`).sort().join("|");
    const seenArrow = new Set<string>();
    out.arrows = out.arrows.filter((m) => {
      const k = key(m);
      if (seenArrow.has(k)) return false;
      seenArrow.add(k);
      return true;
    });
    const instIds = st.fresh.filter((id) => !byId.has(id));
    if (instIds.length) instanceTalk(project, instIds, craft, out);
    st.fresh.forEach((id) => placed.add(id));
    st.onto.forEach((id) => placed.add(id));
    return out;
  });
}

/** Old height clauses the placement talk replaces (bottom-face "AFF" marks, ranges). */
function dropStale(desc: string, pl: StepPlacement): string {
  let d = desc;
  if (pl.measures.some((m) => m.kind === "top")) {
    d = d.replace(/\s*Marked heights?:[^.]*\.(?:\s*\d[^.]*\.)*/g, "");
    d = d.replace(/\s*\((?:shelf )?top face ~[^)]*\)/g, "");
  }
  if (pl.hardware.includes("hinge")) d = d.replace(/,?\s*3[–-]4"\s*from top and bottom/g, "");
  return d.replace(/\s{2,}/g, " ").trim();
}

/** Final plan pass: append the WHERE sentences to every step that positions a part. */
export function withPlacementTalk(project: YardProject, plan: BuildPlan): BuildPlan {
  // Door/window framing plans carry their own stud-layout numbers (kings, jacks, header) — see framing steps.
  if ((!project.panels.length && !project.instances.length) || !plan.instructions.length || project.windowPkg || project.kind === "opening") return plan;
  const pls = stepPlacements(project, plan.instructions, plan.cutList, plan.partsKind === "whole");
  const instructions = plan.instructions.map((s, i) => {
    const pl = pls[i];
    if (!pl.sentences.length) return s;
    const base = dropStale(s.description, pl);
    const where = pl.sentences.map((t, k) => (k === 0 ? `Where: ${t}` : t)).join(" ");
    return { ...s, description: `${base.replace(/\s*$/, "")}${/[.!?]$/.test(base) ? "" : "."} ${where}` };
  });
  return { ...plan, instructions };
}
