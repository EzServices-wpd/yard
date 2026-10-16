import { isUnitItem } from "./unitItems";
/**
 * C15 (hardware and Buy completeness) and C17 (step and placement text), as plan passes and as the checks the
 * invariants read. One rule each, applied to every form:
 * - every stock the cut list cuts from is a Buy row; every Buy row has a store link (a row added after the listing
 *   pass, such as bought hardware, gets search links at its own price, never a new invented price);
 * - every fastener size and hardware item a step tells you to fit is on Buy;
 * - a lumber size the notes name is the size Buy sells;
 * - one step hangs each hinge (a generic "Mount the 2 hinges" never repeats a lid already hung on its piano hinge);
 * - a tabletop or hung build is never told it "sits on the floor": it is set out on a work surface and checked
 *   flat (or checked hanging level), and its heights read from its bottom.
 */
import type { AssemblyStep, BomLine, BuildPlan, YardProject } from "./types";
import { decorateBom, estimateOffers } from "./listings";
import { hungBuild } from "./outdoor";

const hasLink = (b: BomLine) => (b.offers ?? []).some((o) => !!o.href);

/** Cut-list stock with no Buy row of its own (the clear panes of a feeder cut from an acrylic sheet). */
export function cutStockOffBuy(plan: Pick<BuildPlan, "bom" | "cutList" | "partsKind">): string[] {
  // A bought whole item has nothing cut from stock.
  if (plan.partsKind === "whole") return [];
  const names = plan.bom.map((b) => b.name.toLowerCase());
  const ids = new Set(plan.bom.map((b) => b.catalogId).filter(Boolean));
  const out = new Set<string>();
  for (const c of plan.cutList) {
    if (c.whole || !c.material) continue;
    const cid = (c.id ?? "").split("|")[0];
    // The cut row's stock id, or the catalog stock its material name reads as ("2×4" is the 2x4 stud row).
    const id = /^[a-z]+(?:-[a-z0-9]+)+$/.test(cid) && cid.includes("-") && !/^[a-z]{2}-[a-z0-9]{6,}$/.test(cid) ? cid : decorateBom([{ name: c.material, quantity: 1, unit: "pc" }])[0].catalogId ?? "";
    const low = c.material.toLowerCase();
    // The same stock in another sheet size (a 1/4" backer laid out on 4×8 and bought as 4×10) is bought.
    const fam = (x: string) => x.replace(/-\d+x\d+$/, "");
    if ((id && (ids.has(id) || [...ids].some((b) => fam(b!) === fam(id)))) || names.includes(low)) continue;
    out.add(c.material);
  }
  return [...out];
}

/** Sheets of a cut-list stock the pieces need, by area (one sheet at least). */
function sheetsFor(plan: BuildPlan, material: string, sheetArea: number): number {
  const area = plan.cutList.filter((c) => c.material === material).reduce((t, c) => t + c.lengthIn * c.widthIn * c.quantity, 0);
  return Math.max(1, Math.ceil((area * 1.1) / Math.max(1, sheetArea)));
}

/** The Buy pass: cut stock bought, every row linked. Prices only come from listings or the row's own estimate. */
export function buyComplete(project: YardProject, plan: BuildPlan): BuildPlan {
  let bom = [...plan.bom];
  // A bought item (a bracelet, a zip tie) keeps its own Buy; its cord is not sheet stock.
  for (const m of isUnitItem(project) ? [] : cutStockOffBuy(plan)) {
    const [row] = decorateBom([{ name: m, quantity: 1, unit: "sheet", searchQuery: m }]);
    // Sheet goods listed by size: count sheets by the pieces' area (a 9" × 12" acrylic sheet holds two feeder panes).
    const area = /acrylic|plexiglass/i.test(m) ? 9 * 12 : 0;
    const n = area ? sheetsFor(plan, m, area) : 1;
    const best = row.offers?.find((o) => o.best) ?? row.offers?.[0];
    if (!best || !(best.packPrice > 0)) continue; // no checked listing: left for the C15 check to report, never priced by guess
    bom.push(n === 1 ? { ...row, notes: "Cut list stock: the pieces cut from it are on the cut list." } : { ...decorateBom([{ ...row, quantity: n, offers: undefined, estimatedCost: undefined }])[0], unit: "sheets", notes: "Cut list stock: the pieces cut from it are on the cut list." });
  }
  // A screw size the steps drive with no Buy row: the box of that size, priced from its listing.
  const sizes = new Set(bom.flatMap((b) => screwSizes(b.name.replace(/(#\s?\d+)\s*x\s*/i, "$1 × "))));
  const outdoor = bom.some((b) => b.catalogId === "outdoor-finish");
  for (const z of new Set(plan.instructions.flatMap((s) => screwSizes(`${s.title}. ${s.description}`)))) {
    // Panel builds only: a craft frame of sticks is glued, whatever its step template says.
    if (sizes.has(z) || !/^#8 /.test(z) || (project.instances ?? []).length > 0 || !(bom.some((b) => /\bscrews?\b/i.test(b.name)))) continue;
    const len = z.replace(/^#8 × /, "").replace(/"$/, "").replace(" ", "-");
    const [row] = decorateBom([{ name: `#8 x ${len}" ${outdoor ? "exterior-coated or stainless " : ""}wood screws`, quantity: 1, unit: "box (50 ct)", catalogId: "screws-8" }]);
    if (row.estimatedCost && row.estimatedCost > 0) { bom.push({ ...row, notes: "The screws the steps drive." }); sizes.add(z); }
  }
  bom = bom.map((b) => (hasLink(b) ? b : { ...b, offers: estimateOffers(b.searchQuery || b.name, Math.max(1, b.quantity), b.estimatedCost ?? 0) }));
  return { ...plan, bom };
}

/* ---------- step hardware ---------- */

const frac = (t: string) => t.replace(/(\d)-(\d+\/\d+)/g, "$1 $2").replace(/\s+/g, " ").trim();

/** Fastener sizes a step names ("#10 × 3/4\"", "#8 x 1 1/4\""), normalised. */
function screwSizes(t: string): string[] {
  return [...t.matchAll(/#\s?(\d+)\s*[×x]\s*(\d+(?:[- ]\d+\/\d+)?|\d+\/\d+)\s*"/g)].map((m) => `#${m[1]} × ${frac(m[2])}"`);
}

/** Hardware a step tells you to fit, and the Buy words that buy it. */
const STEP_HARDWARE: { said: RegExp; buy: RegExp; label: string }[] = [
  { said: /\bcasters?\b/i, buy: /\bcasters?\b/i, label: "casters" },
  { said: /\bscrew eyes?\b/i, buy: /\bscrew eyes?\b/i, label: "screw eyes" },
  { said: /\bon a short chain\b|\bchain hooks\b|\bhook the chain\b/i, buy: /\bchain\b/i, label: "chain" },
  { said: /\bpiano hinge\b/i, buy: /\bpiano hinge\b|continuous hinge/i, label: "piano hinge" },
  { said: /\blid stay\b/i, buy: /\blid stay\b|lid support/i, label: "lid stay" },
  { said: /\bcarriage bolts?\b/i, buy: /\bcarriage bolts?\b/i, label: "carriage bolts" },
  { said: /\blag screws?\b/i, buy: /\blag screws?\b/i, label: "lag screws" },
];

/** Hardware named in the steps with no Buy row that buys it (C15). */
export function stepHardwareOffBuy(plan: Pick<BuildPlan, "bom" | "instructions">): string[] {
  const buy = plan.bom.map((b) => b.name);
  const buySizes = new Set(buy.flatMap((n) => screwSizes(n.replace(/(#\s?\d+)\s*x\s*/i, "$1 × "))));
  const out: string[] = [];
  for (const s of plan.instructions) {
    // A step that cites the packs ("with the screws in each pack") buys nothing new.
    const t = `${s.title}. ${s.description}`;
    for (const z of screwSizes(t)) if (!buySizes.has(z)) out.push(`step "${s.title}" uses ${z} screws, not on Buy`);
    for (const h of STEP_HARDWARE) if (h.said.test(t) && !buy.some((n) => h.buy.test(n))) out.push(`step "${s.title}" fits ${h.label}, not on Buy`);
  }
  return [...new Set(out)];
}

/** Rows with no store link (C15). */
export function unlinkedBuy(plan: Pick<BuildPlan, "bom">): string[] {
  return plan.bom.filter((b) => !hasLink(b)).map((b) => b.name);
}

/** Lumber sizes the notes name ("Three courses of 2×6") that Buy does not sell (C15). */
export function noteStockOffBuy(notes: string[], plan: Pick<BuildPlan, "bom" | "cutList">): string[] {
  const sizes = (t: string) => [...t.matchAll(/\b([1-6])\s*[×x]\s*(\d{1,2})\b(?!\s*(?:ft|foot|feet|'|"|in\b|inch))/gi)].map((m) => `${m[1]}×${m[2]}`);
  // Only a note that says what the boards are ("Three courses of 2×6 boards"), not a size said in passing.
  const stockSaid = (t: string) => [...t.matchAll(/\b(?:courses?|boards?|slats?) of ([1-6])\s*[×x]\s*(\d{1,2})\b|\b([1-6])\s*[×x]\s*(\d{1,2}) (?:boards|courses)\b/gi)].map((m) => `${m[1] ?? m[3]}×${m[2] ?? m[4]}`);
  const sold = new Set([...plan.bom.map((b) => b.name), ...plan.cutList.map((c) => c.material)].flatMap(sizes));
  const out: string[] = [];
  for (const n of notes) for (const z of stockSaid(n)) if (!sold.has(z)) out.push(`notes name ${z} stock, Buy sells ${[...sold].join(", ") || "none"}`);
  return [...new Set(out)];
}

/* ---------- C17 placement and hinge steps ---------- */

/** Builds that live on the floor whatever their size: seats, stands, beds, pet and garden builds. */
const FLOOR_NOUN = /\b(?:stool|footrest|ottoman|bench|chair|seat|nightstand|stand|table|bed|crate|kennel|hive|planter|coop|tractor|hutch|dog|cat|pet|step|cart|shelf|shelves|bookcase|cabinet|dresser|chest of drawers|box for|toy box|rack|compost|sandbox|stairs?|wagon|tower)\b/i;

/** A tabletop build: small enough for a table and not a floor-standing form. */
export function tabletopBuild(project: YardProject): boolean {
  const o = project.overall;
  if (!o || smallHungBuild(project) || hungBuild(project) || project.kind === "opening") return false;
  if (FLOOR_NOUN.test(`${project.prompt ?? ""} ${project.name}`)) return false;
  return o.height <= 24 && Math.max(o.width, o.depth) <= 24;
}

/** A small hung build (a feeder on a chain, a wall birdhouse): assembled on the bench, hung where it lives. */
export function smallHungBuild(project: YardProject): boolean {
  const o = project.overall;
  const hangs = hungBuild(project) || project.panels.some((p) => /^(?:Screw eye \d+|Mounting board)$/.test(p.name));
  return !!o && hangs && Math.max(o.width, o.height, o.depth) <= 24;
}

const FLOOR_TALK = /\bon the floor, square\b|\bsits on the floor\b|\bfloor is out\b|\bshim the feet\b|\brectangle on the floor\b/i;

/** Floor wording a tabletop or hung build should never carry (C17). */
export function floorTalkOnSmall(project: YardProject, plan: Pick<BuildPlan, "instructions">): string[] {
  if (!(tabletopBuild(project) || smallHungBuild(project))) return [];
  return plan.instructions.filter((s) => FLOOR_TALK.test(`${s.title}. ${s.description} ${s.tips ?? ""}`)).map((s) => `${tabletopBuild(project) ? "tabletop" : "hung"} build step "${s.title}" talks about the floor`);
}

const MOUNT = /^Mount the (.+)$/;
/** A generic "Mount the N hinges" step beside a step that already hangs the leaf on its hinge (C17). */
export function duplicateHingeSteps(plan: Pick<BuildPlan, "instructions">): string[] {
  const mount = plan.instructions.filter((s) => MOUNT.test(s.title) && /\bhinges?\b/i.test(s.title));
  const hung = plan.instructions.filter((s) => !MOUNT.test(s.title) && /\bhinges?\b/i.test(s.title));
  return mount.length && hung.length ? mount.map((s) => `"${s.title}" repeats "${hung[0].title}"`) : [];
}

function dropHingeRepeat(steps: AssemblyStep[]): AssemblyStep[] {
  const hungAt = steps.findIndex((s) => !MOUNT.test(s.title) && /\bhinges?\b/i.test(s.title));
  if (hungAt < 0) return steps;
  const out = steps.map((s) => ({ ...s, partsUsed: s.partsUsed ? [...s.partsUsed] : s.partsUsed }));
  for (let i = out.length - 1; i >= 0; i--) {
    const s = out[i];
    const m = s.title.match(MOUNT);
    if (!m || !/\bhinges?\b/i.test(m[1])) continue;
    const hinges = (s.partsUsed ?? []).filter((n) => /^Hinge \d+$/.test(n));
    out[hungAt].partsUsed = [...new Set([...(out[hungAt].partsUsed ?? []), ...hinges])];
    const rest = m[1].split(/,\s*|\s+and\s+/).filter((x) => !/\bhinges?\b/i.test(x));
    if (!rest.length) { out.splice(i, 1); continue; }
    const said = rest.length > 1 ? `${rest.slice(0, -1).join(", ")} and ${rest[rest.length - 1]}` : rest[0];
    const keep = s.description.split(/(?<=\.)\s+/).filter((t) => !/\bHinge \d+\b|\bhinges?\b/i.test(t) || /^Screw on the /.test(t));
    out[i] = {
      ...s,
      title: `Mount the ${said}`,
      description: keep.map((t) => (/^Screw on the /.test(t) ? `Screw on the ${said} where the model shows ${rest.length > 1 || /s$/.test(said) ? "them" : "it"}, with the screws in each pack. Open and close it once to check.` : t)).join(" "),
      partsUsed: (s.partsUsed ?? []).filter((n) => !hinges.includes(n)),
    };
  }
  return out.map((s, i) => ({ ...s, step: i + 1 }));
}

function placeTalk(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const table = tabletopBuild(project), hung = smallHungBuild(project);
  if (!table && !hung) return steps;
  const say = (t: string | undefined) => t
    ?.replace(/\s*Mark the rectangle on the floor\.\s*/g, " ")
    .replace(/\bon the floor, square to the marks\b/g, "flat on the work surface")
    .replace(/\bup from the floor\b/g, "up from the bottom")
    .replace(/\s{2,}/g, " ")
    .trim();
  return steps.map((s) => {
    if (/^Level it\b/i.test(s.title) || /\bsits on the floor\b|\bfloor is out\b/i.test(s.description)) {
      return hung
        ? { ...s, title: "Hang it and check it hangs level", description: "Hang it where it lives and check it hangs level and every joint is tight. Move a hanger if it tips.", tips: s.tips && !FLOOR_TALK.test(s.tips) ? s.tips : undefined }
        : { ...s, title: "Check it sits flat", description: "Set it on a flat table. It should sit without rocking, with every joint tight; sand a high corner if it rocks.", tips: s.tips && !FLOOR_TALK.test(s.tips) ? say(s.tips) : undefined };
    }
    return { ...s, title: say(s.title)!, description: say(s.description)!, tips: say(s.tips) };
  });
}

/** The step pass: one step per hinge, and placement words that fit where the build lives. */
export function stepTextForPlace(project: YardProject, plan: BuildPlan): BuildPlan {
  return { ...plan, instructions: placeTalk(project, dropHingeRepeat(plan.instructions)) };
}
