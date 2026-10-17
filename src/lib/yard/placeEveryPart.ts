/**
 * Every model part is placed in one step, after the parts it rests on.
 * A missing step is written from the part, not from a class template.
 */
import { faceScrewInches, stockThickness } from "./shopJoin";
import { panelStockThickness } from "./modelJoints";
import { inchFrac } from "./inchText";
import type { AssemblyStep, YardProject } from "./types";
import { supportsOf, type SupportInfo } from "./supportGraph";
import { rotorChain, type RotorLink } from "./solids";
import { ANATOMY_NOTE } from "./classAnatomy";

type Part = { key: string; name: string; kind: string; ids?: Set<string> };

const PREP = /^(confirm|read|measure|check|lay out|mark|snap|do not cut|before|drill the holes|glue up the thick parts)/i;

function fastenerTalk(project: YardProject): string {
  const join = project.shopJoin;
  const id = project.primaryMaterialId ?? "";
  if (join === "dowel") return "2 dowels and glue per joint, the same dowels on the Buy list. No face screws.";
  if (join === "biscuit") return "#20 biscuits and glue, the same biscuits on the Buy list. No face screws.";
  if (join === "pocket") return "pocket screws, the same pocket screws on the Buy list. No face screws.";
  if (join === "glue" || /popsicle|chipboard|cardboard|dowel|balsa|skewer|bamboo|toothpick|craft-stick/.test(id)) return "glue, the same glue on the Buy list.";
  if (/pvc|pipe/.test(id)) return "solvent cement, the same cement on the Buy list.";
  const len = inchFrac(faceScrewInches(stockThickness(project)));
  return `#8 x ${len}" screws, the same screws on the Buy list.`;
}

function partsOf(project: YardProject): Part[] {
  if (project.panels.length) {
    return project.panels
      .filter((p) => p.type !== "drawer")
      .map((p) => ({ key: p.id, name: p.name, kind: p.type || "part" }));
  }
  const roles = new Map<string, number>();
  const ids = new Map<string, Set<string>>();
  for (const inst of project.instances) {
    const role = inst.role || "member";
    roles.set(role, (roles.get(role) ?? 0) + 1);
    ids.set(role, (ids.get(role) ?? new Set()).add(inst.id.toLowerCase()));
  }
  return [...roles.entries()].map(([role, n]) => ({
    key: role,
    name: n === 1 ? role : `${n} ${role}s`,
    kind: role,
    ids: ids.get(role),
  }));
}

const SIDE = /^(?:left|right|front|back|top|bottom|upper|lower|inner|outer|middle|center|centre)$/;

const INSERTED_TIP = "This part was on the model and not yet in a step.";

function mentions(step: AssemblyStep, part: Part, names?: Set<string>): boolean {
  // A step that declares it uses no parts (stapling mesh, drilling vents) places none: nothing is fastened in it.
  if (Array.isArray(step.partsUsed) && step.partsUsed.length === 0 && step.tips !== INSERTED_TIP) return false;
  const used = (step.partsUsed ?? []).map((s) => s.toLowerCase()).filter((s) => s !== "*" && s !== "all");
  // A step that lists the model's own part names places exactly those parts ("Fasten the 6 right end slats"
  // does not place a left end slat; "Fasten the Shelf backstop" does not place a shelf).
  // A title that names the part outright ("Fit the drawer front") still places it.
  if (used.length && names && used.every((u) => names.has(u))) {
    const n = part.name.toLowerCase();
    if (used.includes(n) || (n.includes(" ") && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(step.title.toLowerCase()))) return true;
    // "Fit the drawer fronts" places every drawer front; "the 6 right end slats" places no left one.
    const f = familyWord(part.name);
    const m = f.includes(" ") ? step.title.toLowerCase().match(new RegExp(`(\\w+) ${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s\\b`)) : null;
    return !!m && !(SIDE.test(m[1]) && !n.split(/\s+/).includes(m[1]));
  }
  const kind = part.kind.toLowerCase();
  const name = part.name.toLowerCase();
  const fam = familyWord(part.name);
  if (used.length) {
    const title = step.title.toLowerCase();
    return (
      (fam.includes(" ") && title.includes(plural(fam, 2))) ||
      used.includes(kind) ||
      used.includes(name) ||
      used.includes(part.key.toLowerCase()) ||
      // A step that lists a member stick by id places that stick's role.
      (!!part.ids && used.some((u) => part.ids!.has(u))) ||
      // A title that names the part outright ("Fit the drawer front") places it.
      (name.length > 3 && name.includes(" ") && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(title)) ||
      (fam.includes(" ") && (used.includes(fam) || used.includes(plural(fam, 2)))) ||
      // A join step named for the part's type ("Attach A Top to both uprights") places that part.
      (/^(?:attach|fasten|set|hang|glue|screw)\b/.test(title) && kind.length > 2 && new RegExp(`^\\S+ (?:the )?(?:[a-z]{1,2} )?${kind}s?\\b`).test(title))
    );
  }
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (name.length > 3 && text.includes(name)) return true;
  if (fam.includes(" ") && (text.includes(plural(fam, 2)) || text.includes(fam))) return true;
  if (new RegExp(`to the ${name}|onto the ${name}|on the ${name}`).test(text)) return true;
  return new RegExp(`\\b${kind}s?\\b`).test(text);
}

function isBuild(step: AssemblyStep): boolean {
  // "Level it" checks the finished box; it places no part.
  // A glue-up makes blanks; it places no part either.
  return !PREP.test(step.title) && !/^(?:Cut|Glue up|Join sheet splices)\b/i.test(step.title) && !/^Level it\b/i.test(step.title);
}

const POSITION = /^(left|right|front|back|top|bottom|lower|upper|middle|inner|outer|center|centre)$/;

/** A part's family word: "Left upright" → "upright", "Leg front left 1" → "leg", "Left drawer front 2" → "drawer front". */
export function familyWord(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\b[a-z]\b/g, " ") // "Post front left A": the A/B ply letter is not the family
    .split(/\s+/)
    .filter((w) => w && w !== "step");
  if (!words.length) return name.toLowerCase();
  const last = words[words.length - 1];
  const core = words.filter((w) => !POSITION.test(w));
  if (/^(front|back|top|bottom)$/.test(last) && core.length && words.length > 1 && !POSITION.test(words[words.length - 2])) {
    return `${core[core.length - 1]} ${last}`;
  }
  return core.length ? core.join(" ") : words.join(" ");
}

function plural(word: string, n: number): string {
  if (n === 1) return word;
  if (/(?:shelf|half|leaf|loaf)$/.test(word)) return `${word.slice(0, -1)}ves`;
  if (/(?:knife|life|wife)$/.test(word)) return `${word.slice(0, -2)}ves`;
  if (/(s|sh|ch|x)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** A piece that hangs on the wall: its base part mounts to studs or anchors, not the floor. */
function wallMounted(project: YardProject): boolean {
  return project.assumptions?.installMode === "wall";
}

/** The real support named in plain words: "the floor", "both uprights", "the 4 legs", "the Bottom". */
function supportTalk(project: YardProject, info: SupportInfo | undefined): string {
  if (!info || info.how === "floor") return wallMounted(project) ? "the wall" : "the floor";
  if (!info.on.length) return "the parts it meets";
  const names = project.panels.length
    ? info.on.map((id) => project.panels.find((p) => p.id === id)?.name ?? "").filter(Boolean)
    : info.on.map((role) => {
        const n = project.instances.filter((i) => (i.role || "member") === role).length;
        return n === 1 ? role : `${n} ${plural(role, n)}`;
      });
  if (!project.panels.length) return names.map((n) => `the ${n}`).join(" and ");
  const byFamily = new Map<string, number>();
  for (const n of names) byFamily.set(familyWord(n), (byFamily.get(familyWord(n)) ?? 0) + 1);
  const bits = [...byFamily.entries()].map(([w, n]) => (n === 1 ? `the ${names.find((x) => familyWord(x) === w)}` : n === 2 ? `both ${plural(w, 2)}` : `the ${n} ${plural(w, n)}`));
  return bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
}

/** One sentence that sets the part on its real support with the way it really holds. */
function placeSentence(project: YardProject, part: Part, info: SupportInfo | undefined, fix: string): string {
  const onto = supportTalk(project, info);
  // A moving part rides free on its pin; a dowel part is glued into drilled holes. Neither takes screws.
  const panel = project.panels.find((p) => p.id === part.key);
  const link = panel ? rotorChain(project.panels).get(panel.id) : undefined;
  if (panel && link && (info?.on ?? []).includes(link.pin)) return rotorSentence(project, panel, link, fix);
  // A bored bead threads onto the rod it rides on, never through the bead before it.
  if (panel?.turns && /^dowel-/.test(panel.materialId) && panel.polygon?.holes?.length) {
    const c = (p: typeof panel, a: "x" | "y" | "z", k: "width" | "height" | "depth") => p.position[a] + p.size[k] / 2;
    const rod = project.panels.find((q) => q !== panel && /^dowel-/.test(q.materialId) && !q.polygon?.holes?.length && (["x", "y", "z"] as const).filter((a, i) => {
      const k = (["width", "height", "depth"] as const)[i];
      return q.position[a] - 0.01 <= c(panel, a, k) && c(panel, a, k) <= q.position[a] + q.size[k] + 0.01;
    }).length === 3);
    return `Thread the ${part.name} onto ${rod ? `the ${rod.name}` : onto}. It slides free on it: no glue.`;
  }
  // A dowel passes through only holes drilled right through; into blind holes it is set.
  const blind = (info?.on ?? []).some((k) => / deep\./.test(project.panels.find((p) => p.id === k)?.cutNote ?? ""));
  if (panel?.turns && /^dowel-/.test(panel.materialId) && blind) return `Set the ${part.name} into the drilled holes in ${onto}. Glue it only in the fixed parts; whatever turns on it rides free.`;
  if (panel?.turns && /^dowel-/.test(panel.materialId)) return `Pass the ${part.name} through ${onto}. Glue it only in the fixed parts; whatever turns on it rides free.`;
  const onPin = (info?.on ?? []).some((k) => /^dowel-/.test(project.panels.find((p) => p.id === k)?.materialId ?? ""));
  // A rotor's parts are fixed to each other; only the assembly turns on the pin.
  // A hinged lid swings on its hinges: it is hung, never screwed down.
  if (panel?.turns && !onPin && !/^dowel-/.test(panel.materialId) && isLid(panel) && project.panels.some((q) => /\bhinge/i.test(q.name))) return `Hang the ${part.name} on its hinges: screw each hinge's free leaf to the ${part.name} with the short hinge screws. The ${part.name} itself takes no screws: it rests on the walls and swings open.`;
  if (panel?.materialId === "hardware" && /\bhinge/i.test(part.name)) return `Screw one leaf of the ${part.name} to ${onto.split(" and ")[0]} with its short hinge screws, knuckle at the top edge.`;
  if (panel?.turns && onPin) return `Slide the ${part.name} onto ${onto}. The wheel parts are glued and screwed to it next, and the wheel turns on ${onto} as one assembly: no glue or screws into the pin.`;
  if (/^dowel-/.test(panel?.materialId ?? "")) return `Set the ${part.name} into holes drilled in ${onto} and glue it there. No screws in a dowel.`;
  // Nothing under 3/4" but a back takes a screw: a thin divider or face (under 1/2", or planed thinner than its stock) is glued in place.
  const t = panel ? Math.min(panel.size.width, panel.size.height, panel.size.depth) : 1;
  if (panel && !/\bback\b/i.test(part.name) && info?.how !== "floor" && (t < 0.5 || (t < 0.7 && t < panelStockThickness(panel) - 0.05))) return `Glue the ${part.name} to ${onto} and clamp it until it sets. It is too thin for a screw.`;
  // Engine rule (F7): a hinged part is hung, never screwed, whatever the support graph guessed.
  if (panel?.hinged) return `Hang the ${part.name} on its hinges on ${onto}. No screws go through it, so it opens.`;
  switch (info?.how) {
    case "floor":
      if (wallMounted(project)) {
        return `Lay the ${part.name} flat on the bench, square to the marks: the base the next parts fasten to. The finished piece mounts to the wall, screwed into studs, in the hang step.`;
      }
      return `Set the ${part.name} on the floor, square to the marks. It is the base the next parts fasten to.`;
    case "hinges":
      // A batten of a built-up door or lid carries the hinge strap; the leaf's boards fasten to it next.
      if (/\b(?:batten|cleat)\b/i.test(part.name))
        return `Hang the ${part.name} on ${onto} with its hinge strap screwed along the batten. The boards of the same leaf fasten to it next, clear of the frame so it swings free.`;
      return `Hang the ${part.name} on its hinges on ${onto}.`;
    case "front":
      return `Set the ${part.name} on the face of ${onto} and fasten it from inside the drawer with ${fix}`;
    case "rests":
      return `Set the ${part.name} on ${onto}. Fasten it with ${fix}`;
    default:
      return `Fasten the ${part.name} to ${onto} with ${fix}`;
  }
}

/**
 * A rotor part threads onto its axle, in order from the glued end: a collar is glued to the axle (never
 * to the wheel), a wheel part slides on and is fixed only to the wheel parts it touches.
 */
function rotorSentence(project: YardProject, panel: YardProject["panels"][number], link: RotorLink, fix: string): string {
  const byId = (k: string) => project.panels.find((p) => p.id === k);
  const pin = byId(link.pin)!;
  const others = link.on.filter((k) => k !== link.pin).map(byId).filter((p): p is NonNullable<typeof p> => !!p);
  if (link.collar === "fixed") {
    const carrier = project.panels.find((q) => q !== panel && q !== pin && !q.turns && !/^dowel-/.test(q.materialId) && meetsBox(q, panel) && !/collar/i.test(q.name));
    return `Slide the ${panel.name} onto the ${pin.name}${carrier ? ` up against the ${carrier.name}` : ""} and glue it to the ${pin.name} there. It is the wheel's stop on this side.`;
  }
  if (link.collar === "free") {
    const near = others[0];
    return `Slide the ${panel.name} onto the ${pin.name}${near ? ` up to the ${near.name}` : ""}, hold a card (1/32") between them, and glue the ${panel.name} to the ${pin.name}. Pull the card once the glue grabs: the wheel turns free but can't slide along the ${pin.name}.`;
  }
  const collars = others.filter((q) => !q.turns);
  const fixedTo = others.filter((q) => q.turns);
  const names = (ps: typeof others) => listNames(ps.map((q) => `the ${q.name}`));
  let s = `Slide the ${panel.name} onto the ${pin.name}`;
  if (collars.length) s += ` up to ${names(collars)}, a card's thickness (1/32") off it so it turns free`;
  s += fixedTo.length ? ` and fasten it to ${names(fixedTo)} with ${fix}` : `. The next wheel parts fasten to it.`;
  return `${s} Nothing is glued or screwed into the ${pin.name}: the wheel turns on it as one assembly.`;
}

function meetsBox(a: YardProject["panels"][number], b: YardProject["panels"][number]): boolean {
  const k = { x: "width", y: "height", z: "depth" } as const;
  return (["x", "y", "z"] as const).every((x) => a.position[x] <= b.position[x] + b.size[k[x]] + 0.05 && b.position[x] <= a.position[x] + a.size[k[x]] + 0.05);
}

/** True when the step already says what the part sits on and how it holds. */
function namesSupport(project: YardProject, step: AssemblyStep, info: SupportInfo | undefined): boolean {
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (!info) return true;
  if (info.how === "floor") return wallMounted(project) ? /\bwall\b|\bstuds?\b|anchor/.test(text) : /floor|stand|footprint|on the marks|bench/.test(text);
  if (info.how === "hinges") return /hinge/.test(text);
  if (info.how === "front") return /drawer box|drawer/.test(text) && /screw|glue/.test(text);
  if (!/glue|screw|bolt|dowel|biscuit|pocket|cement|pin|nail|tape|tab/.test(text)) return false;
  // The support's family word ("leg front") or its assembly word ("leg", "body", "floor").
  const words = project.panels.length
    ? info.on.flatMap((id) => {
        const fam = familyWord(project.panels.find((p) => p.id === id)?.name ?? "");
        const words = fam.split(" ");
        return [fam, words[0], words[words.length - 1]];
      })
    : info.on.map((r) => r.toLowerCase());
  return words.some((w) => w && (text.includes(w) || text.includes(plural(w, 2))));
}

function renumber(steps: AssemblyStep[]): AssemblyStep[] {
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

/** The step index that places each part, or -1. */
export function placementIndex(project: YardProject, steps: AssemblyStep[]): Map<string, number> {
  const placed = new Map<string, number>();
  const parts = partsOf(project);
  const names = new Set(project.panels.map((p) => p.name.toLowerCase()));
  steps.forEach((step, i) => {
    if (!isBuild(step)) return;
    for (const part of parts) {
      if (!placed.has(part.key) && mentions(step, part, names)) placed.set(part.key, i);
    }
  });
  return placed;
}

const INSERTED = INSERTED_TIP;
const LIFTED = "It goes on once every part under it is in place.";

export function placeEveryPart(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const parts = partsOf(project);
  if (!parts.length || !steps.length) return steps;
  let out = steps.map((s) => ({ ...s }));
  const fix = fastenerTalk(project);
  const supports = supportsOf(project);
  // A rotor's hub goes on the axle first; the wheel parts on the axle are fixed to the hub, so it is their support.
  {
    const isPin = (k: string) => /^dowel-/.test(project.panels.find((p) => p.id === k)?.materialId ?? "");
    const chain = rotorChain(project.panels);
    const riders = project.panels.filter((p) => p.turns && !chain.has(p.id) && !/^dowel-/.test(p.materialId) && (supports.get(p.id)?.on ?? []).some(isPin));
    const span = (p: (typeof riders)[number]) => Math.max(p.size.width, p.size.height, p.size.depth);
    const hub = riders.length > 1 ? riders.reduce((a, b) => (span(b) < span(a) ? b : a)) : undefined;
    for (const p of riders) if (hub && p !== hub) supports.set(p.id, { ...supports.get(p.id)!, on: [hub.id] });
  }
  const placed = () => placementIndex(project, out);
  // With no build step yet, parts go after the prep and cut steps (before "Level it").
  const firstBuild = () => {
    const i = out.findIndex(isBuild);
    if (i >= 0) return i;
    const level = out.findIndex((s) => /^Level it\b/i.test(s.title));
    return level >= 0 ? level : out.length;
  };
  const dependents = (key: string) => parts.filter((p) => supports.get(p.key)?.on.includes(key));

  // Class-anatomy steps are written in support order (floor, base, body, top) and name each support.
  const handWritten = (project.notes ?? []).some((n) => n.startsWith(ANATOMY_NOTE));
  if (!handWritten) out = splitByLayer(project, out, parts, supports, fix);
  for (const part of parts) {
    const info = supports.get(part.key);
    const at = placed().get(part.key);
    // A step that names this part and lists its real mounting parent places it (the mirror in the door's
    // rabbet): no fallback step, never fastened to the nearest part.
    const hosts = project.panels.filter((p) => info?.on.includes(p.id)).map((p) => p.name);
    const mount = at == null && hosts.length ? out.findIndex((s) => isBuild(s) && hosts.some((h) => (s.partsUsed ?? []).includes(h)) && new RegExp(`\\b${escapeRe(part.name)}\\b`, "i").test(s.description)) : -1;
    if (mount >= 0) {
      out[mount] = { ...out[mount], partsUsed: [...(out[mount].partsUsed ?? []), part.name] };
      continue;
    }
    if (at == null) {
      // Insert right after the parts it rests on, and before any part that rests on it.
      const where = placed();
      const after = (info?.on ?? []).map((k) => where.get(k)).filter((n): n is number => n != null);
      const before = dependents(part.key).map((p) => where.get(p.key)).filter((n): n is number => n != null);
      const lo = after.length ? Math.max(...after) + 1 : info?.how === "floor" ? firstBuild() : Math.max(firstBuild(), out.length - 1);
      const hi = before.length ? Math.min(...before) : out.length;
      // A part that rests on this one shares a step with this part's own support: lift it out so it
      // goes on right after this part.
      const lift = hi < lo && project.panels.length
        ? dependents(part.key).filter((d) => { const w = where.get(d.key); return w != null && w < lo; })
        : [];
      const insertAt = lift.length ? Math.min(lo, out.length) : Math.max(0, Math.min(lo, hi, out.length));
      if (lift.length) {
        const liftNames = new Set(lift.map((d) => d.name));
        out = out.map((s, i) => (i < insertAt ? { ...s, partsUsed: (s.partsUsed ?? []).filter((n) => !liftNames.has(n)) } : s));
        // Parts a later step already places (by name or title) go on there; the rest get their own step.
        const after = placed();
        const loose = lift.filter((d) => after.get(d.key) == null || after.get(d.key)! < insertAt);
        if (loose.length) {
          out.splice(insertAt, 0, {
            step: insertAt + 1,
            title: `Set the ${listNames(loose.map((d) => d.name))}`,
            description: loose.map((d) => placeSentence(project, d, supports.get(d.key), fix)).join(" "),
            tips: "It goes on once every part under it is in place.",
            partsUsed: loose.map((d) => d.name),
          });
        }
      }
      const sentence = placeSentence(project, part, info, fix);
      const turns = project.panels.find((p) => p.id === part.key)?.turns;
      const onPinNow = (info?.on ?? []).some((k) => /^dowel-/.test(project.panels.find((p) => p.id === k)?.materialId ?? ""));
      const verb = (turns || /\bcollar/i.test(part.name)) && onPinNow ? "Slide on" : info?.how === "hinges" ? "Hang" : info?.how === "rests" || info?.how === "floor" || info?.how === "front" ? "Set" : "Fasten";
      out.splice(insertAt, 0, {
        step: insertAt + 1,
        title: `${verb} the ${part.name}`,
        description: sentence,
        tips: INSERTED,
        partsUsed: [project.panels.length ? part.name : part.kind],
      });
      continue;
    }
    const step = out[at];
    if (handWritten || namesSupport(project, step, info)) continue;
    step.description = `${step.description} ${placeSentence(project, part, info, fix)}`;
  }

  // A part placed before the part it rests on: move the support's own inserted step up front.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    const where = placed();
    for (const part of parts) {
      const at = where.get(part.key);
      if (at == null) continue;
      for (const key of supports.get(part.key)?.on ?? []) {
        const j = where.get(key);
        if (j == null || j <= at || out[j].tips !== INSERTED) continue;
        const [step] = out.splice(j, 1);
        out.splice(at, 0, step);
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  out = supportOrder(project, out, parts, supports);
  if (project.panels.length) out = supportOrder(project, mergeSameTitles(liftAfterSupports(project, out, parts, supports, fix)), parts, supports);
  // An inserted step whose parts all moved to a later step places nothing: it goes.
  const ghost = (s: AssemblyStep) => (s.tips === INSERTED || s.tips === LIFTED) && Array.isArray(s.partsUsed) && !s.partsUsed.length;
  // Merged steps sit at their family's first slot: order them by support once more.
  out = supportOrder(project, mergeFamilies(mergeSameTitles(out.filter((s) => !ghost(s)))), parts, supports);
  if (project.panels.length) out = supportOrder(project, lowerSupports(project, out, parts, supports, fix), parts, supports);
  // A builder that wrote no build steps (a recipe) gets every build step from the model: those are its
  // steps, not fallbacks.
  // A recipe build's own steps (hang it, confirm the size) don't make the model's steps fallbacks either.
  if (!steps.some(isBuild) || project.kind === "custom") out = out.map((s) => (s.tips === INSERTED || s.tips === LIFTED ? { ...s, tips: undefined } : s));
  out = rotorInOrder(project, out, supports, fix);
  out = rotorBeforeSecondSupport(project, out, supports);
  out = hingedLidLast(project, out);
  return renumber(out);
}

/**
 * A part an earlier step rests on, listed in a later step with other parts (a floor support among the
 * "remaining dividers"), comes out of that step and goes on in its own step just before the first part
 * that rests on it, once its own supports are in.
 */
function lowerSupports(project: YardProject, steps: AssemblyStep[], parts: Part[], supports: Map<string, SupportInfo>, fix: string): AssemblyStep[] {
  let out = steps.map((s) => ({ ...s }));
  for (let pass = 0; pass < parts.length; pass++) {
    const where = placementIndex(project, out);
    const move = parts.find((p) => {
      const j = where.get(p.key);
      if (j == null || (out[j].partsUsed ?? []).length < 2) return false;
      const need = parts.map((q) => (supports.get(q.key)?.on.includes(p.key) ? where.get(q.key) : undefined)).filter((i): i is number => i != null && i < j);
      if (!need.length) return false;
      const first = Math.min(...need);
      return (supports.get(p.key)?.on ?? []).every((k) => (where.get(k) ?? -1) < first);
    });
    if (!move) break;
    const j = where.get(move.key)!;
    const first = Math.min(...parts.map((q) => (supports.get(q.key)?.on.includes(move.key) ? where.get(q.key) : undefined)).filter((i): i is number => i != null && i < j));
    const name = move.name.toLowerCase();
    out[j] = { ...out[j], partsUsed: (out[j].partsUsed ?? []).filter((u) => u.toLowerCase() !== name) };
    const info = supports.get(move.key);
    out.splice(first, 0, {
      step: first + 1,
      title: `${info?.how === "rests" || info?.how === "floor" ? "Set" : "Fasten"} the ${move.name}`,
      description: placeSentence(project, move, info, fix),
      tips: LIFTED,
      partsUsed: [move.name],
    });
  }
  return out;
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A part a step lists before the parts it rests on (a seat in the legs step, a top before its cleats) comes
 * out of that step and goes on in its own step right after its last support. Same-name parts move together.
 */
function liftAfterSupports(project: YardProject, steps: AssemblyStep[], parts: Part[], supports: Map<string, SupportInfo>, fix: string): AssemblyStep[] {
  let out = steps.map((s) => ({ ...s }));
  for (let pass = 0; pass < 4; pass++) {
    const where = placementIndex(project, out);
    const moves = new Map<number, Part[]>();
    const lifted = new Set<string>();
    for (const p of parts) {
      const name = p.name.toLowerCase();
      if (lifted.has(name)) continue;
      const same = parts.filter((q) => q.name.toLowerCase() === name && where.get(q.key) != null);
      const at = where.get(p.key);
      if (at == null || !isBuild(out[at]) || same.some((q) => where.get(q.key) !== at)) continue;
      const late = same.flatMap((q) => (supports.get(q.key)?.on ?? []).map((k) => where.get(k)).filter((j): j is number => j != null && j > at && isBuild(out[j])));
      if (!late.length) continue;
      const used = out[at].partsUsed ?? [];
      const rest = used.filter((u) => u.toLowerCase() !== name);
      if (rest.length === used.length || !rest.length) continue;
      const trial = { ...out[at], partsUsed: rest };
      if (same.some((q) => mentions(trial, q))) continue;
      lifted.add(name);
      out[at] = {
        ...trial,
        description: trial.description
          .replace(new RegExp(`;?\\s*(?:[A-Z]{1,2} )?${escapeRe(p.name)} — [^;]*?"(?=;|\\.|$)`, "g"), "")
          .replace(/^;\s*/, ""),
      };
      const target = Math.max(...late);
      moves.set(target, [...(moves.get(target) ?? []), ...same.slice(0, 1)]);
    }
    if (!moves.size) break;
    for (const target of [...moves.keys()].sort((a, b) => b - a)) {
      const group = moves.get(target)!;
      const names = [...new Set(group.map((q) => q.name))];
      const verb = group.every((q) => ["rests", "floor"].includes(supports.get(q.key)?.how ?? "")) ? "Set" : "Fasten";
      out.splice(target + 1, 0, {
        step: target + 2,
        title: `${verb} the ${listNames(names)}`,
        description: group.map((q) => placeSentence(project, q, supports.get(q.key), fix)).join(" "),
        tips: "It goes on once every part under it is in place.",
        partsUsed: names,
      });
    }
  }
  return out;
}

/** Steps that share a title are one step: the later one, which already sits after every support, takes both. */
function mergeSameTitles(steps: AssemblyStep[]): AssemblyStep[] {
  const key = (s: AssemblyStep) => s.title.trim().toLowerCase();
  const lastAt = new Map<string, number>();
  steps.forEach((s, i) => lastAt.set(key(s), i));
  if (lastAt.size === steps.length) return steps;
  const out = steps.map((s) => ({ ...s }));
  const drop = new Set<number>();
  steps.forEach((s, i) => {
    const j = lastAt.get(key(s))!;
    if (j === i) return;
    const into = out[j];
    const sentences = s.description.split(/(?<=\.)\s+/).filter((t) => t && !into.description.includes(t));
    out[j] = {
      ...into,
      description: [...sentences, into.description].join(" ").trim(),
      tips: into.tips ?? s.tips,
      partsUsed: s.partsUsed || into.partsUsed ? [...new Set([...(s.partsUsed ?? []), ...(into.partsUsed ?? [])])] : undefined,
    };
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

/**
 * Build steps in support order: a step whose parts rest on parts from a later step moves after it.
 * A stable sort — steps keep their written order unless a support says otherwise; prep and cut steps
 * stay first, and a loop of mutual supports keeps its written order.
 */
function supportOrder(project: YardProject, steps: AssemblyStep[], parts: Part[], supports: Map<string, SupportInfo>): AssemblyStep[] {
  const where = placementIndex(project, steps);
  const deps = steps.map(() => new Set<number>());
  for (const p of parts) {
    const at = where.get(p.key);
    if (at == null || !isBuild(steps[at])) continue;
    for (const k of supports.get(p.key)?.on ?? []) {
      const j = where.get(k);
      if (j != null && j !== at && isBuild(steps[j])) deps[at].add(j);
    }
  }
  if (!deps.some((d, i) => [...d].some((j) => j > i))) return steps;
  // Only steps that place parts move; prep, cut and check steps keep their slots.
  const placing = steps.map((_, i) => i).filter((i) => isBuild(steps[i]) && [...where.values()].includes(i));
  const done = new Set<number>(steps.map((_, i) => i).filter((i) => !placing.includes(i)));
  const order: number[] = [];
  const left = [...placing];
  while (left.length) {
    const k = left.findIndex((i) => [...deps[i]].every((j) => done.has(j)));
    const i = left.splice(k < 0 ? 0 : k, 1)[0];
    done.add(i);
    order.push(i);
  }
  const out = [...steps];
  placing.forEach((slot, n) => (out[slot] = steps[order[n]]));
  return out;
}

/** Support depth: floor parts 0, a part on them 1, and so on. */
function levels(parts: Part[], supports: Map<string, SupportInfo>): Map<string, number> {
  const lv = new Map<string, number>();
  for (const p of parts) if (supports.get(p.key)?.how === "floor") lv.set(p.key, 0);
  // A part sits one layer above the highest part it rests on.
  for (const partial of [false, true]) {
    for (let round = 0; round < parts.length; round++) {
      let grew = false;
      for (const p of parts) {
        if (lv.has(p.key)) continue;
        const keys = (supports.get(p.key)?.on ?? []).filter((k) => parts.some((q) => q.key === k));
        const on = keys.map((k) => lv.get(k)).filter((n): n is number => n != null);
        if (on.length && (partial || on.length === keys.length)) {
          lv.set(p.key, Math.max(...on) + 1);
          grew = true;
        }
      }
      if (!grew) break;
    }
  }
  return lv;
}

/**
 * One catch-all step that places many parts on several support layers ("Brace the frame" covering rails
 * and treads) becomes one step per layer, in support order, each naming the real support.
 */
function splitByLayer(
  project: YardProject,
  steps: AssemblyStep[],
  parts: Part[],
  supports: Map<string, SupportInfo>,
  fix: string,
): AssemblyStep[] {
  if (!project.panels.length) return steps;
  const lv = levels(parts, supports);
  const where = placementIndex(project, steps);
  const out: AssemblyStep[] = [];
  steps.forEach((step, i) => {
    const mine = parts.filter((p) => where.get(p.key) === i);
    const layers = [...new Set(mine.map((p) => lv.get(p.key) ?? 99))].sort((a, b) => a - b);
    const unnamed = mine.some((p) => !namesSupport(project, step, supports.get(p.key)));
    if (mine.length < 6 || layers.length < 2 || !isBuild(step) || !unnamed) {
      out.push(step);
      return;
    }
    layers.forEach((L, k) => {
      const group = mine.filter((p) => (lv.get(p.key) ?? 99) === L);
      const byTalk = new Map<string, Part[]>();
      for (const p of group) {
        const info = supports.get(p.key);
        const key = `${info?.how ?? "side"}|${supportTalk(project, info)}`;
        byTalk.set(key, [...(byTalk.get(key) ?? []), p]);
      }
      const sentences = [...byTalk.entries()].map(([key, ps]) => {
        const [how, talk] = key.split("|");
        const list = listNames(ps.map((p) => p.name));
        if (how === "floor") {
          return wallMounted(project)
            ? `Lay the ${list} flat on the bench, square to the marks: the base the rest fastens to. The finished piece mounts to the wall, screwed into studs, in the hang step.`
            : `Stand the ${list} on the floor, square to the marks.`;
        }
        if (how === "rests") return `Set the ${list} on ${talk}.`;
        if (how === "hinges") return `Hang the ${list} on ${talk} with their hinges.`;
        return `Fasten the ${list} to ${talk}.`;
      });
      const fastens = group.some((p) => !["floor", "hinges"].includes(supports.get(p.key)?.how ?? ""));
      const body = `${sentences.join(" ")}${fastens ? ` Fasten each one with ${fix}` : ""}`;
      const fam = [...new Set(group.map((p) => familyWord(p.name)))];
      out.push({
        ...step,
        title: k === 0 ? step.title : `Set the ${listNames(fam.map((w) => plural(w, 2)))}`,
        description: k === 0 ? `${step.description} ${body}` : body,
        tips: k === 0 ? step.tips : "Each layer goes on after the parts it rests on.",
        partsUsed: group.map((p) => p.name),
      });
    });
  });
  return out;
}

/**
 * Back-to-back inserted steps that place one numbered family with the same verb are one step
 * ("Fasten the 7 door 2 slats"): nothing sits between them, so the order holds.
 */
function mergeFamilies(steps: AssemblyStep[]): AssemblyStep[] {
  const out: AssemblyStep[] = [];
  const verbOf = (s: AssemblyStep) => s.title.split(" ")[0];
  const famOf = (s: AssemblyStep) => {
    const f = new Set((s.partsUsed ?? []).map(familyOf));
    return (s.tips === INSERTED || s.tips === LIFTED) && f.size === 1 ? [...f][0] : null;
  };
  // A family title ("the 7 lid boards") places every board of that family, so it is only used when the
  // merged step holds the whole family.
  const famSize = new Map<string, number>();
  for (const s of steps) for (const n of new Set(s.partsUsed ?? [])) famSize.set(familyOf(n), (famSize.get(familyOf(n)) ?? 0) + 1);
  for (const s of steps) {
    const prev = out[out.length - 1];
    const fam = famOf(s);
    const numbered = (t: AssemblyStep) => (t.partsUsed ?? []).every((n) => familyOf(n) !== n);
    if (prev && fam && famOf(prev) === fam && verbOf(prev) === verbOf(s) && numbered(prev) && numbered(s)) {
      const names = [...(prev.partsUsed ?? []), ...(s.partsUsed ?? [])];
      const whole = new Set(names).size >= (famSize.get(fam) ?? 0);
      out[out.length - 1] = { ...prev, title: `${verbOf(s)} the ${whole ? familyTitle(names) : listNames(names)}`, description: `${prev.description} ${s.description}`, partsUsed: names };
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

/** "Left end slat 3" → "Left end slat": the family a numbered part belongs to. */
function familyOf(name: string): string {
  return name.replace(/\s+\d+$/, "");
}

/** "9 left end slats" for one family, else the names listed. */
function familyTitle(names: string[]): string {
  const u = [...new Set(names)];
  const fams = new Set(u.map(familyOf));
  if (u.length > 1 && fams.size === 1) {
    const f = familyOf(u[0]);
    return `${u.length} ${f.charAt(0).toLowerCase()}${f.slice(1)}${/(?:s|sh|ch|x)$/.test(f) ? "es" : "s"}`;
  }
  return listNames(u);
}

function listNames(names: string[]): string {
  const u = [...new Set(names)];
  return u.length > 1 ? `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}` : u[0] ?? "";
}

/**
 * For the one-join split: true when a part of this family rests on a part first placed after
 * step `stepIndex` (a work top on aprons fastened later), so its join waits for that step.
 */
export function restsOnLaterStep(project: YardProject, steps: AssemblyStep[]): (family: string, stepIndex: number) => boolean {
  if (!project.panels.length) return () => false;
  const supports = supportsOf(project);
  const where = placementIndex(project, steps);
  return (family, stepIndex) =>
    project.panels
      .filter((p) => p.type === family || p.name.toLowerCase().split(/\s+/).pop() === family)
      .some((p) => (supports.get(p.id)?.on ?? []).some((k) => (where.get(k) ?? -1) > stepIndex));
}

/**
 * A built-up rotor threads onto its axle in one order (rotorChain): from the collar at the glued end, part by
 * part along the axle, to the collar at the free end. Its steps follow that order, right after the axle goes
 * in; a run of like parts (the paddles) is one step.
 */
function rotorInOrder(project: YardProject, steps: AssemblyStep[], supports: ReturnType<typeof supportsOf>, fix: string): AssemblyStep[] {
  const chain = rotorChain(project.panels);
  if (!chain.size) return steps;
  const parts = new Map(partsOf(project).map((p) => [p.key, p]));
  const panel = (k: string) => project.panels.find((p) => p.id === k)!;
  let out = steps;
  for (const pinId of new Set([...chain.values()].map((l) => l.pin))) {
    const ids = [...chain.entries()].filter(([, l]) => l.pin === pinId).map(([k]) => k);
    const names = new Set(ids.map((k) => panel(k).name));
    const ai = placementIndex(project, out).get(pinId);
    if (ai == null) continue;
    // Steps that place rotor parts with anything else are left alone (hand-written steps).
    const touches = (st: AssemblyStep) => isBuild(st) && (st.partsUsed ?? []).some((n) => names.has(n));
    if (out.some((st, i) => i !== ai && touches(st) && !(st.partsUsed ?? []).every((n) => names.has(n)))) continue;
    if (touches(out[ai])) continue;
    const kept = out.filter((st, i) => i === ai || !touches(st));
    const runs: string[][] = [];
    for (const k of ids) {
      const last = runs[runs.length - 1];
      const fam = (q: string) => familyWord(panel(q).name);
      if (last && fam(last[0]) === fam(k) && /paddle|bucket|blade|vane|slat/i.test(fam(k)) && !last.some((q) => (supports.get(k)?.on ?? []).includes(q))) last.push(k);
      else runs.push([k]);
    }
    const fresh: AssemblyStep[] = runs.map((run) => {
      const first = panel(run[0]);
      const onPin = (supports.get(run[0])?.on ?? []).includes(pinId);
      const verb = onPin ? "Slide on" : "Fasten";
      return {
        step: 0,
        title: run.length > 1 ? `${verb} the ${run.length} ${plural(familyWord(first.name), run.length)}` : `${verb} the ${first.name}`,
        description: run.length > 1 && run.every((k) => (supports.get(k)?.on ?? []).join() === (supports.get(run[0])?.on ?? []).join())
          ? `Fasten the ${run.length} ${plural(familyWord(first.name), run.length)} to ${supportTalk(project, supports.get(run[0]))} with ${fix} Space them evenly round the wheel, ${Math.round(360 / run.length)}° apart, the first ${Math.round(180 / run.length)}° past a spoke so none lands on a spoke.`
          : run.map((k) => placeSentence(project, parts.get(k) ?? { key: k, name: panel(k).name, kind: panel(k).type }, supports.get(k), fix)).join(" "),
        tips: INSERTED,
        partsUsed: run.map((k) => panel(k).name),
      };
    });
    const at = kept.indexOf(out[ai]) + 1;
    out = [...kept.slice(0, at), ...fresh, ...kept.slice(at)];
  }
  return out;
}

/**
 * A part that turns between two supports goes on the axle before the axle is glued into the second
 * support: the axle is glued into the first, the rotor goes on, then the second support slides onto
 * the axle's free end.
 */
function rotorBeforeSecondSupport(project: YardProject, steps: AssemblyStep[], supports: ReturnType<typeof supportsOf>): AssemblyStep[] {
  const pin = (k: string) => /^dowel-/.test(project.panels.find((p) => p.id === k)?.materialId ?? "");
  let out = steps;
  const chain = rotorChain(project.panels);
  const SZK = { x: "width", y: "height", z: "depth" } as const;
  for (const axle of project.panels.filter((p) => p.turns && pin(p.id) && !p.polygon?.holes?.length)) {
    const carriers = (supports.get(axle.id)?.on ?? []).filter((k) => !pin(k));
    const rotor = new Set(project.panels.filter((p) => !pin(p.id) && (supports.get(p.id)?.on ?? []).includes(axle.id)).map((p) => p.id));
    for (let grew = true; grew; ) {
      grew = false;
      for (const p of project.panels) if (!rotor.has(p.id) && (supports.get(p.id)?.on ?? []).some((k) => rotor.has(k))) { rotor.add(p.id); grew = true; }
    }
    if (carriers.length < 2 || !rotor.size) continue;
    const at = placementIndex(project, out);
    const ai = at.get(axle.id), lastR = Math.max(...[...rotor].map((k) => at.get(k) ?? -1));
    // A rotor chained along the axle threads on from its low end: the low carrier is the free one.
    const chained = [...rotor].some((k) => chain.get(k)?.pin === axle.id);
    const L = (["x", "y", "z"] as const).reduce((m, a) => (axle.size[SZK[a]] > axle.size[SZK[m]] ? a : m), "x" as "x" | "y" | "z");
    const byKey = (k: string) => project.panels.find((p) => p.id === k)!;
    const second = chained
      ? carriers.reduce((m, k) => (byKey(k).position[L] < byKey(m).position[L] ? k : m))
      : carriers.reduce((m, k) => ((at.get(k) ?? -1) > (at.get(m) ?? -1) ? k : m));
    const si = at.get(second), first = project.panels.find((p) => p.id === carriers.find((k) => k !== second))!, sec = byKey(second);
    if (ai == null || si == null || si > ai || lastR < ai || (out[si].partsUsed ?? [sec.name]).length > 1) continue;
    const moved = { ...out[si], description: `Slide the ${sec.name} onto the free end of the ${axle.name} and glue the ${axle.name} in it. ${out[si].description}` };
    out = out.map((st, i) => (i === ai ? { ...st, description: st.description.replace(/^Pass the (.+?) through [^.]+\./, `Pass the $1 through the ${first.name} and glue it there; the other end stays free until the rotor is on.`) } : st));
    // Parts fastened to the free carrier (a cross rail between the posts) wait for it.
    const deps = new Set<string>([second]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const p of project.panels) if (!deps.has(p.id) && !rotor.has(p.id) && p.id !== axle.id && (supports.get(p.id)?.on ?? []).some((k) => deps.has(k))) { deps.add(p.id); grew = true; }
    }
    deps.delete(second);
    const waits = (i: number) => i > si && i <= lastR && i !== ai && (out[i].partsUsed ?? []).length > 0 && (out[i].partsUsed ?? []).every((n) => project.panels.some((p) => p.name === n && deps.has(p.id)));
    const later = out.filter((_, i) => waits(i));
    out = [...out.slice(0, si), ...out.slice(si + 1, lastR + 1).filter((_, j) => !waits(si + 1 + j)), moved, ...later, ...out.slice(lastR + 1)];
  }
  return out;
}

/** A hinged lid (and its hinges) goes on after every wall it rests on: last of the build steps. */
function hingedLidLast(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  if (!project.panels.some((q) => /\bhinge/i.test(q.name))) return steps;
  const lidNames = project.panels.filter((p) => p.turns && !/^dowel-/.test(p.materialId) && p.materialId !== "hardware" && isLid(p)).map((p) => p.name);
  if (!lidNames.length) return steps;
  const moving = (st: AssemblyStep) => isBuild(st) && (st.partsUsed ?? []).length > 0 && (st.partsUsed ?? []).every((n) => lidNames.includes(n) || /\bhinge/i.test(n));
  const lastBuild = steps.reduce((m, st, i) => (isBuild(st) && !moving(st) ? i : m), -1);
  if (lastBuild < 0) return steps;
  const keep = steps.filter((st, i) => !(moving(st) && i < lastBuild));
  const isHinge = (st: AssemblyStep) => (st.partsUsed ?? []).every((n) => /\bhinge/i.test(n));
  const moved = steps.filter((st, i) => moving(st) && i < lastBuild).sort((a, b) => Number(isHinge(b)) - Number(isHinge(a)));
  const at = keep.indexOf(steps[lastBuild]) + 1;
  return [...keep.slice(0, at), ...moved, ...keep.slice(at)];
}

/** A lid lies flat (its height is its smallest side); a hinged door or gate stands up. */
function isLid(p: { size: { width: number; height: number; depth: number }; blank?: unknown }): boolean {
  return !!p.blank || p.size.height <= Math.min(p.size.width, p.size.depth);
}
