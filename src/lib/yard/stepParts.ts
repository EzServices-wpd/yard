/**
 * Which parts each plan step installs — shared by the PDF step pictures, the placement talk,
 * and the guards. Pure plan + geometry: no drawing here.
 */
import { stepInstanceIds } from "./assembly";
import { cutListName } from "./shopPlural";
import { clean } from "./pdfKit";
import type { AssemblyStep, YardProject } from "./types";

export type StepKind = "prep" | "cut" | "build";

// ───────────────────────── step mentions ─────────────────────────

const singular = (w: string) => w.toLowerCase().replace(/ies$/, "y").replace(/ves$/, "f").replace(/(?<=[a-z]{3})s$/, "");
const escapeRe = (x: string) => x.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");

export function stepKindOf(s: AssemblyStep, ids: string[]): StepKind {
  const t = clean(s.title).toLowerCase();
  if (/^(confirm|read|measure|check the|mark|lay out)\b|do not cut yet|before you/.test(t)) return "prep";
  if (/^(cut|rip|trim)\b|\bcut (the|all|every|\d)|stay whole|\bdo not cut\b/.test(t) && !/^(screw|glue|attach)/.test(t)) return "cut";
  if (!ids.length) return "prep";
  if ((s.partsUsed ?? []).includes("*") && /confirm|read|measure|check|lay out|mark|before/.test(t)) return "prep";
  return "build";
}

export type StepParts = { ids: string[]; kind: StepKind; fresh: string[]; onto: string[]; said: boolean };

/**
 * Which parts each build step's words install (fresh, drawn orange) and which placed parts it
 * joins onto (onto, drawn grey). A part is new only in the step whose words install it:
 * lettered talk ("A Back", "E and F uprights", "E Left upright"), full part names, and the
 * "attach X to Y with" join clause decide it. A part the words list but a later join installs
 * waits for that step; a part no step ever names is installed in the first step that holds it.
 */
export function planStepParts(project: YardProject, steps: AssemblyStep[], letters: Map<string, string>): StepParts[] {
  const byId = new Map(project.panels.map((p) => [p.id, p]));
  const base = (name: string) => name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+\d+$/, "").replace(/\s+/g, " ").trim();
  const head = (name: string) => singular(base(name).replace(/\s+[A-Z]$/, "").split(/\s+/).pop() ?? "");
  const info = steps.map((s) => {
    const ids = stepInstanceIds(project, s);
    const kind = stepKindOf(s, ids);
    const panels = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    // The WHERE tail (placement talk) names supports and references — not what the step installs.
    const text = clean(`${s.title}. ${s.description.replace(/\s*Where:[\s\S]*$/, "")}`);
    const letteredRe = /\b([A-Z]{1,2})((?:\s*(?:,|and|&)\s*[A-Z]{1,2}\b)*)\s+([A-Za-z]+)(?:\s+([A-Za-z]+))?/g;
    const letteredHits = (chunk: string) => {
      const hit = new Set<string>();
      let m: RegExpExecArray | null;
      letteredRe.lastIndex = 0;
      while ((m = letteredRe.exec(chunk))) {
        const group = [m[1], ...(m[2].match(/[A-Z]{1,2}/g) ?? [])];
        const words = [m[3], m[4]].filter((w): w is string => !!w).map(singular);
        for (const p of panels) {
          const Lt = letters.get(p.id);
          const fam = head(cutListName(p.name, p.type));
          if (Lt && group.includes(Lt) && words.some((w) => w === fam || w === head(p.name))) hit.add(p.id);
        }
      }
      return hit;
    };
    const lettered = letteredHits(text);
    const textHasLetters = lettered.size > 0;
    const named = (chunk: string) => {
      const hit = letteredHits(chunk);
      const low = chunk.toLowerCase();
      const fullNamed = new Set<string>();
      for (const p of panels) {
        const nm = base(p.name).toLowerCase();
        const multi = nm.includes(" ");
        if ((multi || !textHasLetters) && nm.length > 2 && new RegExp(`\\b${escapeRe(nm)}s?\\b`).test(low)) {
          hit.add(p.id);
          if (multi) fullNamed.add(p.id);
        }
      }
      // Heads the words already pin to named parts ("Left knee divider" → "divider" means those two).
      const pinnedHeads = new Set(panels.filter((p) => fullNamed.has(p.id)).map((p) => head(p.name)));
      for (const p of panels) {
        const multi = base(p.name).includes(" ");
        // Head-noun talk ("the two tops", "the back") only for parts the step never letters.
        const neverLettered = !letters.get(p.id) || !lettered.has(p.id);
        const h = head(p.name);
        if (pinnedHeads.has(h) && !fullNamed.has(p.id)) continue;
        if (neverLettered && (multi || !textHasLetters || !letters.get(p.id)) && h.length > 2 && new RegExp(`\\b${escapeRe(h)}(?:s|es)?\\b`, "i").test(chunk)) hit.add(p.id);
      }
      return hit;
    };
    const all = kind === "build" && panels.length === ids.length ? named(text) : new Set<string>();
    const jm = text.match(/One join(?: class| per \w+)?:\s*(?:attach|screw|glue|set|hang)\s+(.+?)\s+(?:to|onto|into|between)\s+(.+?)\s+with\b/i);
    const join = jm && all.size ? { moving: named(jm[1]), target: named(jm[2]), rest: named(text.replace(jm[0], " ")) } : null;
    return { ids, kind, all, join };
  });
  const placed = new Set<string>();
  return info.map((st, k) => {
    if (st.kind !== "build") return { ids: st.ids, kind: st.kind, fresh: [], onto: [], said: false };
    if (!st.all.size) {
      const fresh = st.ids.filter((id) => !placed.has(id));
      st.ids.forEach((id) => placed.add(id));
      return { ids: st.ids, kind: st.kind, fresh, onto: [], said: false };
    }
    const later = info.slice(k + 1).filter((x) => x.kind === "build");
    const laterSaid = new Set(later.flatMap((x) => [...x.all]));
    const laterMoved = new Set(later.flatMap((x) => (x.join ? [...x.join.moving] : [])));
    const fresh = st.ids.filter((id) => {
      if (placed.has(id)) return false;
      if (!st.all.has(id)) return !laterSaid.has(id);
      if (!st.join) return true;
      if (st.join.moving.has(id) || st.join.target.has(id)) return true;
      return !laterMoved.has(id);
    });
    const onto = st.ids.filter((id) => placed.has(id) && st.all.has(id));
    fresh.forEach((id) => placed.add(id));
    return { ids: st.ids, kind: st.kind, fresh, onto, said: true };
  });
}

