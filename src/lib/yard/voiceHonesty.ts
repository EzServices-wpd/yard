/** Voice/PDF honesty helpers — hardware↔Buy class match, species title/stock, footprint talk, plain shop words, parts-plate + one-join densify. */

import { namedLumberFromPrompt } from "./namedLumberSpecies";
import type { AssemblyStep, CutLine } from "./types";

/**
 * Map BOM / step hardware language to a Buy catalogId class.
 * Piano / continuous / lid-stay must NOT collapse to soft-close concealed cabinet hinges.
 */
export function hardwareCatalogIdFromHay(hay: string): string | null {
  const h = hay.toLowerCase();
  if (/piano|continuous\s*hinge/.test(h)) return "piano-hinge";
  if (/lid\s*stay|lid\s*support/.test(h)) return "lid-stay";
  // Pulls before hinge catch-alls — "cup hinge" ≠ "cup pulls".
  if (/cup\s*pulls?/.test(h)) return "cup-pulls";
  if (/bar\s*pulls?|door\s*pulls?|cabinet\s*pulls?|cabinet\s*bar\s*pulls?/.test(h)) return "cabinet-bar-pulls";
  if (/soft-?close|concealed|cup\s*hinge/.test(h)) return "cabinet-hinges";
  if (/utility\s*hinge|butt\s*hinge|support-?leg\s*hinge/.test(h)) return "utility-hinges";
  if (/\bhinge/.test(h)) return "cabinet-hinges";
  return null;
}

/** Named lumber species display (Cedar, Oak, …) when the prompt speaks it. */
export function speciesDisplayFromPrompt(prompt: string): string | null {
  return namedLumberFromPrompt(prompt)?.display ?? null;
}

/**
 * Honor typed species in a title stem — "Chest" + cedar prompt → "Cedar chest".
 * No silent drop; does not invent species when the prompt never named one.
 */
export function honorSpeciesInTitle(stem: string, prompt: string): string {
  const sp = speciesDisplayFromPrompt(prompt);
  if (!sp) return stem;
  const esc = sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("\\b" + esc + "\\b", "i").test(stem)) return stem;
  if (/^Chest$/i.test(stem)) return `${sp} chest`;
  if (/^Toy chest$/i.test(stem)) return `${sp} toy chest`;
  return `${sp} ${stem}`;
}

/** Geometry-aware footprint confirm language (round ≠ "check it is square"). */
export function footprintConfirmTalk(opts: {
  shape?: string | null;
  widthLabel: string;
  depthLabel?: string;
}): string {
  const shape = (opts.shape ?? "").toLowerCase();
  if (shape === "round" || shape === "circle") {
    return `Mark the circle on the floor (diameter ${opts.widthLabel}"). Check the diameter matches — a round top is not a square footprint.`;
  }
  if (shape === "oval") {
    const d = opts.depthLabel ?? opts.widthLabel;
    return `Mark the oval footprint ${opts.widthLabel}" × ${d}". Check the long and short axes — not a square box.`;
  }
  return "Mark the footprint on the floor. Check it is square.";
}

/**
 * When prompt names a species but densify stays plywood / generic, say the substitute out loud.
 */
export function speciesSubstituteNote(prompt: string, stockLabel: string): string | null {
  const sp = namedLumberFromPrompt(prompt);
  if (!sp) return null;
  if (!/ply|plywood|sheet/i.test(stockLabel)) return null;
  return `Prompt names ${sp.display} — densify uses ${stockLabel} as the structural substitute (not a silent drop). Stock stays ply; buy ${sp.display} boards or lining/finish if you want the named-species story.`;
}

/** Prefer plain stranger words in step/PDF/glossary body — never carcase/toekick. */
export function strangerPlainShopTalk(text: string): string {
  return text
    .replace(/carcase\s*\(\s*the main box\s*\)/gi, "main box")
    .replace(/main box\s*\(\s*carcase\s*\)/gi, "main box")
    .replace(/kick strip\s*\(\s*toekick\s*\)/gi, "kick strip")
    .replace(/\bthe carcase\b/gi, "the main box")
    .replace(/\ba carcase\b/gi, "a main box")
    .replace(/\bcarcases\b/gi, "main boxes")
    .replace(/\bcarcase\b/gi, "main box")
    .replace(/\btoe[- ]?kicks\b/gi, "kick strips")
    .replace(/\btoekicks\b/gi, "kick strips")
    .replace(/\btoe[- ]?kick\b/gi, "kick strip")
    .replace(/\btoekick\b/gi, "kick strip")
    .replace(/\borbit-?chrome\b/gi, "skeleton chrome");
}

/** Short kit-style orientation cue when hinge/face direction matters. */
export function orientationCueTalk(kind: "hinge-toward-you" | "flip-the-box" | "lid-opens-back"): string {
  if (kind === "hinge-toward-you") return "Orientation: hinge edge toward you on the bench.";
  if (kind === "flip-the-box") return "Orientation: flip the box right-side up before this join.";
  return "Orientation: lid opens up and back — hinge along the back edge.";
}

// ── Parts plate + one-join densify (universal kit craft) ───────────────────

/** Stable A, B, C… plate letters (same alphabet as report stampLabels). */
export function letterLabel(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Ensure every cut line has a stable plate letter. */
export function stampPartsPlate(lines: CutLine[]): CutLine[] {
  if (!lines.length) return lines;
  if (lines.every((c) => c.label && /^[A-Z]+$/.test(c.label))) return lines;
  const sorted = [...lines].sort((a, b) => b.lengthIn - a.lengthIn || a.name.localeCompare(b.name));
  return sorted.map((line, i) => ({ ...line, label: line.label && /^[A-Z]+$/.test(line.label) ? line.label : letterLabel(i) }));
}

type PlateEntry = { label: string; name: string; quantity: number; family: string };

function plateFamily(name: string): string {
  const bare = name.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (/^(left|right)\s+door\b|^door\b/.test(bare)) return "door";
  if (/^(left|right)\s+(side|upright)\b|^upright\b|^side\b/.test(bare)) return "upright";
  if (/^leg\b/.test(bare)) return "leg";
  if (/^apron\b/.test(bare)) return "apron";
  if (/^lid\b/.test(bare)) return "lid";
  if (/^back\b/.test(bare)) return "back";
  if (/^front\b/.test(bare)) return "front";
  if (/^bottom\b/.test(bare)) return "bottom";
  if (/^top\b|^counter\b|^desktop\b/.test(bare)) return "top";
  if (/^shelf\b/.test(bare)) return "shelf";
  if (/^toekick\b|^kick strip\b/.test(bare)) return "toekick";
  return bare;
}

/** Parts plate index: cut-list rows with stable letters for step/PDF refs. */
export function partsPlateEntries(cutList: CutLine[]): PlateEntry[] {
  return stampPartsPlate(cutList)
    .filter((c) => c.label)
    .map((c) => ({
      label: c.label!,
      name: c.name,
      quantity: c.quantity,
      family: plateFamily(c.name),
    }));
}

function plateRef(entry: PlateEntry, spoken?: string): string {
  const word = (spoken ?? entry.name).replace(/\s+/g, " ").trim();
  // Avoid "A A Lid" if already lettered.
  if (new RegExp(`^${entry.label}\\b`, "i").test(word)) return word;
  return `${entry.label} ${word}`;
}

function findPlate(entries: PlateEntry[], spoken: string): PlateEntry | undefined {
  const fam = plateFamily(spoken);
  const exact = entries.find((e) => e.family === fam || e.name.toLowerCase() === spoken.toLowerCase());
  if (exact) return exact;
  return entries.find((e) => e.family === fam || e.name.toLowerCase().startsWith(fam));
}

/**
 * Inject cut-list plate letters into step/PDF talk so strangers can match
 * "B Back" on the bench to letter B on the cut list / nest plate.
 */
export function densifyPartsPlateTalk(text: string, cutList: CutLine[]): string {
  const entries = partsPlateEntries(cutList);
  if (!entries.length || !text) return text;
  let out = text;

  // Dimension lines: "Back — 34.50" / "Left side — 20 × 18" / "Top (cut round…) — 40"
  // Require a digit after the em-dash so rhetorical "open shelf — not a mini…" is not plated.
  // Prefer Drawer bottom/front/back/side before bare Bottom/Front/Back (avoids "Drawer C bottom").
  out = out.replace(
    /(?<![A-Z]\s)\b((?:Left|Right)\s+(?:side|upright|door)|Drawer\s+(?:side|front|back|bottom)|Uprights?|Sides?|Lid|(?<!\bDrawer\s)Back|(?<!\bDrawer\s)Front|(?<!\bDrawer\s)Bottom|Top(?:\s*\([^)]*\))?|Counter|Doors?|Legs?|Aprons?|Shelf|Shelves)(\s+\d+)?(\s*—\s*(?=\d|\())/gi,
    (full, rawName: string, qty: string | undefined, dash: string) => {
      const plate = findPlate(entries, rawName);
      if (!plate) return full;
      if (new RegExp(`\\b${plate.label}\\s+${rawName}`, "i").test(full)) return full;
      return `${plateRef(plate, rawName)}${qty ?? ""}${dash}`;
    },
  );

  // Bare part tokens in prose (longest names first).
  const byLen = [...entries].sort((a, b) => b.name.length - a.name.length);
  for (const e of byLen) {
    const esc = e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Skip tiny tokens that are too ambiguous.
    if (e.name.length < 3) continue;
    const re = new RegExp(`(?<![A-Z]\\s)\\b(${esc})\\b`, "gi");
    out = out.replace(re, (m) => {
      // Already prefixed with this letter.
      return m;
    });
    // Safer: prefix only on "the Name" / "Name and" style when not already lettered.
    const theRe = new RegExp(`\\b([Tt]he)\\s+(?!${e.label}\\b)(${esc})\\b`, "g");
    out = out.replace(theRe, (_m, the: string, name: string) => `${the} ${plateRef(e, name)}`);
  }

  // Synonym families for uprights / sides that cut-list groups as Upright.
  const upright = entries.find((e) => e.family === "upright");
  if (upright) {
    out = out.replace(/\b([Ll]ay the)\s+two uprights\b/g, `$1 two ${upright.label} uprights`);
    out = out.replace(/\b([Tt]he)\s+two uprights\b/g, `$1 two ${upright.label} uprights`);
    out = out.replace(/\bboth uprights\b/gi, `both ${upright.label} uprights`);
  }

  return out;
}

const SCREW_HW = '#8 × 1¼" screws';
const JOIN_BLOB =
  /Glue and (#8[^:]*?):\s*([^.]*?)(\.|$)(?:\s*)(Do NOT[^.]*\.)?/i;

type JoinBit = { part: string; onto: string; hardware: string };

/** Parse "back into both uprights, then bottom, then front" → one-join bits. */
function parseJoinSequence(seq: string, _screwClass: string): JoinBit[] {
  const cleaned = seq.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  // "back into both uprights, then bottom, then front"
  const into = cleaned.match(/^(.+?)\s+into\s+(.+?)(?:,\s*then\s+|$)(.*)$/i);
  const bits: JoinBit[] = [];
  const hw = `4 × ${SCREW_HW} (2 per upright)`;
  if (into) {
    const firstPart = into[1].trim();
    const onto = into[2].replace(/,/g, "").trim();
    bits.push({ part: firstPart, onto, hardware: hw });
    const rest = (into[3] ?? "").trim();
    if (rest) {
      for (const t of rest.split(/\s*,\s*then\s+/i)) {
        const name = t.replace(/^then\s+/i, "").replace(/\.$/, "").trim();
        if (!name || /^into\b/i.test(name)) continue;
        if (bits.some((b) => b.part.toLowerCase() === name.toLowerCase())) continue;
        bits.push({ part: name, onto, hardware: hw });
      }
    }
  } else if (/\bthen\b/i.test(cleaned)) {
    const parts = cleaned.split(/\s*,\s*then\s+/i).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      bits.push({ part: p, onto: "the main box", hardware: `4 × ${SCREW_HW}` });
    }
  }
  return bits;
}

function joinTitle(bit: JoinBit, entries: PlateEntry[], keepStand: boolean, isFirst: boolean): string {
  if (keepStand && isFirst) return ""; // caller keeps original
  const partPlate = findPlate(entries, bit.part);
  const ontoPlate = findPlate(entries, bit.onto.replace(/^both\s+/i, "").replace(/uprights?/i, "upright"));
  const partTalk = partPlate ? plateRef(partPlate, bit.part.replace(/^\w/, (c) => c.toUpperCase())) : bit.part;
  const ontoTalk = ontoPlate
    ? plateRef(ontoPlate, bit.onto.replace(/^both\s+/i, ""))
    : bit.onto;
  return `Attach ${partTalk} to ${ontoTalk}`;
}

function joinDescription(bit: JoinBit, entries: PlateEntry[], screwClass: string, coda: string): string {
  const partPlate = findPlate(entries, bit.part);
  const upright = entries.find((e) => e.family === "upright");
  const partTalk = partPlate ? plateRef(partPlate, bit.part.replace(/^\w/, (c) => c.toUpperCase())) : bit.part;
  const ontoRaw = bit.onto.replace(/^both\s+/i, "");
  const ontoTalk = upright && /upright/i.test(ontoRaw)
    ? `both ${upright.label} uprights`
    : bit.onto;
  const count = bit.hardware || `4 × ${SCREW_HW} (2 per upright)`;
  // Prefer exact screw class from source when present.
  const hw = /#8/.test(screwClass) ? count.replace(SCREW_HW, SCREW_HW) : count;
  return `One join: attach ${partTalk} to ${ontoTalk} with ${hw}. Glue the mating edges. Predrill near the ends so the ply does not split.${coda ? ` ${coda}` : ""}`;
}

/**
 * Densify assembly steps to kit craft bar:
 * 1) Parts plate letters on cut/BOM pieces referenced in steps
 * 2) One join per step with named parts + exact hardware count
 * Confirm/cut/level steps stay as-is (not joins). Leaves freezes' titles intact
 * ("Stand the main box" kept on the first carcase join).
 */
export function densifyOneJoinInstructions(instructions: AssemblyStep[], cutList: CutLine[]): AssemblyStep[] {
  const entries = partsPlateEntries(cutList);
  const out: AssemblyStep[] = [];

  for (const step of instructions) {
    const title = densifyPartsPlateTalk(step.title, cutList);
    const tips = step.tips ? densifyPartsPlateTalk(step.tips, cutList) : step.tips;
    const desc0 = densifyPartsPlateTalk(step.description, cutList);

    // Non-join steps (confirm / cut / level / footprint) — plate letters only.
    if (/confirm|cut the|cut \d|level it|footprint|do not cut|mark the/i.test(step.title) && !/stand the main box|attach |screw the|hinge|hang /i.test(step.title)) {
      out.push({ ...step, title, description: densifyHardwareCountTalk(desc0), tips });
      continue;
    }

    const blob = desc0.match(JOIN_BLOB);
    const keepStand = /stand the main box/i.test(step.title);
    if (blob && /then/i.test(blob[2] ?? "")) {
      const screwClass = (blob[1] ?? SCREW_HW).trim();
      const bits = parseJoinSequence(blob[2], screwClass);
      const coda = (blob[4] ?? "").trim();
      // Lead-in before the glue/screw clause (part dim list).
      const lead = desc0.slice(0, blob.index ?? 0).trim();
      if (bits.length >= 2) {
        bits.forEach((bit, i) => {
          const isFirst = i === 0;
          const t =
            isFirst && keepStand
              ? title
              : joinTitle(bit, entries, keepStand, isFirst) || title;
          const d = [
            isFirst && lead ? lead : "",
            joinDescription(bit, entries, screwClass, isFirst ? coda : ""),
          ]
            .filter(Boolean)
            .join(" ");
          out.push({
            ...step,
            title: t,
            description: densifyHardwareCountTalk(d),
            tips: isFirst ? tips : "One join at a time — dry-fit, then glue and drive the screws for this join only.",
            partsUsed: step.partsUsed,
          });
        });
        continue;
      }
    }

    // Single-join densify for hinge / stay / apron / hang patterns.
    out.push({
      ...step,
      title,
      description: densifyHardwareCountTalk(densifyNamedJoinTalk(desc0, title, entries)),
      tips,
    });
  }

  return out.map((s, i) => ({ ...s, step: i + 1 }));
}

/** Ensure hinge/stay/apron joins name hardware count explicitly. */
function densifyNamedJoinTalk(desc: string, title: string, entries: PlateEntry[]): string {
  let d = desc;
  const hayTitle = title;

  // Lid stay first — must not inherit piano-hinge join from body mention of piano hinge.
  if (/lid stay|lid support/i.test(hayTitle) && !/with\s+1\s+lid stay/i.test(d)) {
    const lid = entries.find((e) => e.family === "lid");
    if (!/one join:/i.test(d)) {
      d = `One join: attach 1 lid stay / lid support to ${lid ? plateRef(lid, "Lid") : "the lid"} with 1 lid stay. ${d}`;
    }
    return d;
  }

  // Piano hinge join — name parts + 1 hinge (title-gated).
  if (/piano-?hinge|piano hinge/i.test(hayTitle) && !/with\s+1\s+piano hinge/i.test(d)) {
    const lid = entries.find((e) => e.family === "lid");
    const back = entries.find((e) => e.family === "back");
    if (lid && back && !/one join:/i.test(d)) {
      d = `One join: attach ${plateRef(lid, "Lid")} to ${plateRef(back, "Back")} with 1 piano hinge (continuous hinge). ${d}`;
    } else if (!/one join:/i.test(d)) {
      d = `One join: attach the lid to the main box back with 1 piano hinge. ${d}`;
    }
  }

  // Aprons → legs: stamp one-join + plate letters + screws per end.
  if (/apron/i.test(hayTitle) && /leg/i.test(hayTitle + d) && !/one join:/i.test(d)) {
    const apron = entries.find((e) => e.family === "apron");
    const leg = entries.find((e) => e.family === "leg");
    const hw = `2 × ${SCREW_HW} per end`;
    const aTalk = apron ? plateRef(apron, "Aprons") : "aprons";
    const lTalk = leg ? plateRef(leg, "Legs") : "legs";
    d = `One join class: attach each ${aTalk} to ${lTalk} with ${hw}. ${d}`;
  }

  // Doors — "2 hinges each" / "Two concealed hinges".
  if (/hang\s+\d*\s*doors?/i.test(hayTitle) && !/one join:/i.test(d)) {
    const door = entries.find((e) => e.family === "door");
    const dTalk = door ? plateRef(door, "Door") : "door";
    if (/(?:2|two)\s+(?:concealed\s+)?hinges/i.test(d + hayTitle)) {
      d = `One join per door: hang each ${dTalk} with 2 concealed hinges. ${d}`;
    }
  }

  // Top on base (table) — screw count from aprons into top.
  if (/center the (round |oval )?top|set the top on the base/i.test(hayTitle) && !/one join:/i.test(d)) {
    const top = entries.find((e) => e.family === "top");
    const apron = entries.find((e) => e.family === "apron");
    d = `One join: attach ${top ? plateRef(top, "Top") : "the top"} to ${apron ? plateRef(apron, "Aprons") : "the aprons"} with ${SCREW_HW} up through the aprons (not down through the face). ${d}`;
  }

  return d;
}

/** Normalize "#8 x 1-1/4" variants already present; no-op if counts exist. */
function densifyHardwareCountTalk(text: string): string {
  return text
    .replace(/#8\s*x\s*1-1\/4"/gi, SCREW_HW)
    .replace(/#8\s*×\s*1-1\/4"/gi, SCREW_HW);
}


/** Cut list already exploded drawers into side/back/bottom (not envelope Drawer box). */
export function cutListHasExplodedDrawers(cutList: Array<{ name: string }>): boolean {
  return cutList.some((c) => /drawer\s+side/i.test(c.name));
}

/**
 * Universal drawer-furniture Voice densify: when cut list names exploded drawer
 * parts, Build/BOM prose must not speak a lone envelope "drawer box" (implies one cut).
 * Tied to exploded cut names (Drawer side/back/bottom). Assembly language after parts
 * are named ("nail the box square", "set the box") stays.
 */
export function densifyDrawerExplodeTalk(
  text: string,
  cutList: Array<{ name: string }>,
): string {
  if (!text || !cutListHasExplodedDrawers(cutList)) return text;
  let out = text;

  // Step titles: "Build 1 drawer box + front" / "Build N drawer boxes + fronts"
  out = out.replace(
    /\bBuild\s+1\s+drawer\s+box\s*\+\s*fronts?\b/gi,
    "Build drawer sides, front, back, and bottom",
  );
  out = out.replace(
    /\bBuild\s+(\d+)\s+drawer\s+boxes\s*\+\s*fronts?\b/gi,
    (_m, n: string) => `Build ${n} drawers (sides, fronts, backs, and bottoms)`,
  );

  // BOM notes: "Nail drawer boxes square …"
  out = out.replace(
    /\bNail\s+drawer\s+boxes\s+square\b/gi,
    "Nail each drawer (sides, back, and bottom) square",
  );

  // Lead-in after exploded parts: "(N boxes)" → "(N drawers)"
  out = out.replace(/\((\d+)\s+boxes\)/gi, (_m, n: string) => `(${n} drawers)`);

  // Stranger assemble phrases that still treat the envelope as one cut blob
  out = out.replace(
    /\bassemble\s+(?:a|the|one)\s+drawer\s+box\b/gi,
    "assemble the drawer sides, front, back, and bottom",
  );

  return out;
}

/** Honest wood piece count from cut-list rows (qty sum) — same class as chip/totals.pieces. */
export function cutListWoodPieceCount(cutList: Array<{ quantity: number }>): number {
  return cutList.reduce((s, c) => s + Math.max(0, c.quantity || 0), 0);
}

/**
 * Soft leftover: Confirm/plate intro still said "N parts on this list" from panels.length
 * (bounding drawer envelopes) while chip + cut list use exploded wood pieces.
 * Rewrite to cut-list qty sum (same honest count as plan.totals.pieces / woodCutPieceCount).
 */
export function densifyPartsCountTalk(
  text: string,
  cutList: Array<{ quantity: number }>,
): string {
  if (!text || !cutList.length) return text;
  const n = cutListWoodPieceCount(cutList);
  if (n <= 0) return text;
  const phrase = n === 1 ? "1 part on this list" : `${n} parts on this list`;
  return text.replace(/\b\d+\s+parts?\s+on\s+this\s+list\b/gi, phrase);
}

/**
 * Full kit-craft densify for packPlan: plain shop words already applied;
 * then parts-plate refs + one-join split + honest parts-count + drawer-explode Voice honesty.
 */
export function densifyKitCraftInstructions(instructions: AssemblyStep[], cutList: CutLine[]): AssemblyStep[] {
  const plated = stampPartsPlate(cutList);
  const joined = densifyOneJoinInstructions(instructions, plated);
  const counted = joined.map((s) => ({
    ...s,
    title: densifyPartsCountTalk(s.title, plated),
    description: densifyPartsCountTalk(s.description, plated),
    tips: s.tips ? densifyPartsCountTalk(s.tips, plated) : s.tips,
  }));
  if (!cutListHasExplodedDrawers(plated)) return counted;
  return counted.map((s) => ({
    ...s,
    title: densifyDrawerExplodeTalk(s.title, plated),
    description: densifyDrawerExplodeTalk(s.description, plated),
    tips: s.tips ? densifyDrawerExplodeTalk(s.tips, plated) : s.tips,
  }));
}

/** Shelf panel enough to name an installed height from engine position.y. */
export type ShelfHeightDatum = {
  name: string;
  position: { y: number };
};

/** Shop inch from engine y — nearest eighth; never invent a height. */
export function shelfHeightInch(y: number): string {
  const r = Math.round(y * 8) / 8;
  if (Number.isInteger(r)) return String(r);
  if (Math.abs(r - Math.floor(r) - 0.5) < 1e-6) return `${Math.floor(r)}½`;
  return String(r)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

/**
 * One shelf's marked install height from panel.position.y (engine measure).
 * Floor / alcove → AFF; wall-hung → from the bottom of the unit.
 */
export function shelfMarkedHeightTalk(
  shelf: ShelfHeightDatum,
  opts?: { wallMounted?: boolean },
): string {
  const inch = shelfHeightInch(shelf.position.y);
  const where = opts?.wallMounted ? `${inch}" from the bottom` : `${inch}" AFF`;
  return `${shelf.name} at ${where}`;
}

/**
 * Clause listing every shelf's marked height for install / pin / glue / cleat steps.
 * Empty when no shelves — caller keeps prior talk. Sorted low→high by engine y.
 */
export function shelfInstallHeightsClause(
  shelves: ShelfHeightDatum[],
  opts?: { wallMounted?: boolean },
): string {
  if (!shelves.length) return "";
  const sorted = [...shelves].sort(
    (a, b) => a.position.y - b.position.y || a.name.localeCompare(b.name),
  );
  const marks = sorted.map((s) => shelfMarkedHeightTalk(s, opts));
  if (marks.length === 1) return `Marked height: ${marks[0]}.`;
  return `Marked heights: ${marks.join("; ")}.`;
}

// ── Voice/PDF impress pack: glossary gate · round envelope · species stock ─

/**
 * Cabinetry / fitted-alcove families keep Main box / Kick strip + overlay/slides
 * glossary terms. Stranger Voice never speaks carcase/toekick jargon (plain densify).
 * Tables, lounge, chests, nightstands, desks, crafts drop cabinetry glossary terms.
 */
export function wantsCabinetryShopWords(hay: string): boolean {
  const h = hay.toLowerCase();
  if (!h.trim()) return false;
  // Explicit non-cabinetry — no cabinetry glossary chip/terms.
  if (
    /\b(table|desk|lounge|chair|bench|stool|chest|nightstand|bedside|catapult|trough|bridge|eiffel|shelf|ledge|rack|cart|swing|bed|headboard|planter)\b/.test(
      h,
    ) &&
    !/\b(vanity|linen|closet|cabinet|pantry|wardrobe|cupboard)\b/.test(h)
  ) {
    return false;
  }
  return /\b(vanity|linen|closet|cabinet|pantry|wardrobe|cupboard|kitchen\s*(base|upper|island)|built-?in|alcove|mudroom\s*cubb)/.test(
    h,
  );
}

/** Shop-words chip for the plan drawer — gated.
 * Cabinetry still names Main box / Kick strip (needed on fitted walks), but never
 * introduces carcase/toekick jargon on the stranger path.
 */
export function shopWordsChipTalk(hay: string): string {
  if (wantsCabinetryShopWords(hay)) {
    return "Main box = uprights, top, bottom, and back screwed together · Kick strip = recessed strip at the floor so your toes clear · Dry-fit = assemble without glue first · Kerf = width the saw blade removes";
  }
  return "Dry-fit = assemble without glue first · Kerf = width the saw blade removes · Square = matching diagonals within about 1/16\"";
}

export type GlossaryEntry = { term: string; def: string };

/** Cabinetry-only glossary terms (plain Main box / Kick strip + cabinetry siblings). */
const CABINETRY_GLOSSARY_TERM_RE =
  /\bmain box\b|\bkick strip\b|carcase|toekick|overlay|side-mount slides|concealed hinges|32mm pin/i;

/**
 * Filter shop glossary: drop Main box / Kick strip / overlay siblings unless
 * the project is cabinetry / fitted alcove. Entries themselves use plain shop
 * words — never carcase/toekick on the stranger PDF path.
 */
export function glossaryForPlan(hay: string, entries: GlossaryEntry[]): GlossaryEntry[] {
  const plain = entries.map((e) => ({
    term: strangerPlainShopTalk(e.term),
    def: strangerPlainShopTalk(e.def),
  }));
  if (wantsCabinetryShopWords(hay)) return plain;
  return plain.filter((e) => !CABINETRY_GLOSSARY_TERM_RE.test(`${e.term} ${e.def}`));
}

/** True when overall W≈D is a round/circular table diameter echo. */
export function isRoundUnitEnvelope(opts: {
  width: number;
  height: number;
  depth: number;
  shape?: string | null;
  prompt?: string | null;
  name?: string | null;
}): boolean {
  const hay = `${opts.prompt ?? ""} ${opts.name ?? ""}`.toLowerCase();
  const shape = (opts.shape ?? "").toLowerCase();
  if (shape === "round" || shape === "circle") return true;
  if (/\b(oval)\b/.test(hay) || shape === "oval") return false;
  if (/\b(round|circular|diameter|\bdia\b)\b/.test(hay) && /table|top/.test(hay)) return true;
  // Geometry echo: W≈D and prompt/name says round, or table with equal plan axes from diameter densify.
  if (
    Number.isFinite(opts.width) &&
    Number.isFinite(opts.depth) &&
    Math.abs(opts.width - opts.depth) < 0.51 &&
    opts.width >= 12 &&
    (/\b(round|circular|diameter|\bdia\b)\b/.test(hay) || /round\s*table/i.test(opts.name ?? ""))
  ) {
    return true;
  }
  return false;
}

/**
 * Honest unit envelope for HUD / PDF / plan chip.
 * Round tables: "40\" dia × 30\" H" — never "40 × 30 × 40" diameter echo.
 */
/**
 * Bare size beside a desk / writing-desk noun.
 * "60\" desk with drawers 30\" deep × 29\" tall" must bind W=60 — never let the
 * deep×tall pair echo as title 30×29×30 (same axis-honesty class as round Dia×H).
 * Returns NaN when no bare desk width is spoken.
 */
export function deskWidthFromPrompt(prompt: string): number {
  const t = prompt.replace(/×/g, "x").replace(/[″""]/g, '"');
  const ahead = t.match(
    /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s+(?:writing\s+)?desk\b/i,
  );
  if (ahead) {
    const n = parseFloat(ahead[1]);
    if (Number.isFinite(n) && n >= 18 && n <= 120) return n;
  }
  const after = t.match(
    /\b(?:writing\s+)?desk\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?(?!\s*(?:wide|width|deep|depth|tall|high|height|long|length|knee))/i,
  );
  if (after) {
    const n = parseFloat(after[1]);
    if (Number.isFinite(n) && n >= 18 && n <= 120) return n;
  }
  return NaN;
}

/**
 * Typed overall width before a storage / opening noun — universal densify, not linen-only.
 * "31.5 inch linen closet" / "36\" tall pantry" / "24 inch bathroom alcove" must bind W
 * (halves welcome). Do not steal axis-labeled measures ("16 inch deep linen closet").
 * Returns NaN when no bare opening width is spoken.
 */

/**
 * Title stamp from axes the stranger actually typed — never invent stock H/D into the title.
 * Width-only linen/closet → `Linen 31.5" wide` (overall may still densify H/D for geometry).
 * Bare opening-storage (no typed digits) → stem only (`Linen` / `Closet`) — densified
 * envelope stays in geometry + Assumed Voice notes, never stamped as typed W×H×D.
 * Full typed triple keeps classic `Stem W" × H" × D"`.
 */
export function stampTypedAxesTitle(
  stem: string,
  labeled: { width: boolean; height: boolean; depth: boolean },
  overall: { width: number; height: number; depth: number },
  typed?: { width?: number; height?: number; depth?: number },
): string {
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return "—";
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : String(r);
  };
  const w = typed?.width ?? overall.width;
  const h = typed?.height ?? overall.height;
  const d = typed?.depth ?? overall.depth;
  const parts: string[] = [];
  if (labeled.width) parts.push(`${fmt(w)}"`);
  if (labeled.height) parts.push(`${fmt(h)}"`);
  if (labeled.depth) parts.push(`${fmt(d)}"`);
  const base = stem.trim() || "Unit";
  // Zero typed axes (bare "linen closet") — never full-stamp densified envelope as typed.
  if (parts.length === 0) {
    return base;
  }
  if (parts.length === 1) {
    if (labeled.width) return `${base} ${parts[0]} wide`;
    if (labeled.height) return `${base} ${parts[0]} tall`;
    return `${base} ${parts[0]} deep`;
  }
  return `${base} ${parts.join(" × ")}`;
}

/** Closet / linen / alcove / pantry / wardrobe — opening storage title class. */

/**
 * Which opening-storage axes the stranger typed (closet / linen / pantry / wardrobe / alcove).
 * Used so title/HUD densify never presents stock H=84 (or D=16) as typed on width-only prompts.
 */
export function typedOpeningStorageAxes(prompt: string): {
  width: boolean;
  height: boolean;
  depth: boolean;
} {
  const t = prompt.replace(/×/g, "x").replace(/[″""]/g, '"');
  const lower = t.toLowerCase();
  const pick = (re: RegExp): number => {
    const m = t.match(re);
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : NaN;
  };
  const labeledW = pick(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide|width)\b/i);
  const labeledH = pick(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tall|high|height)\b/i);
  const labeledD = pick(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:deep|depth)\b/i);
  const openingW = openingWidthFromPrompt(prompt);
  const saidAxis = /wide|width|deep|depth|tall|high|height|long|length/.test(lower);
  const trip = t.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/i,
  );
  let width = Number.isFinite(labeledW) || Number.isFinite(openingW);
  let height = Number.isFinite(labeledH);
  let depth = Number.isFinite(labeledD);
  if (!saidAxis && trip) {
    const a = parseFloat(trip[1]);
    const b = parseFloat(trip[2]);
    const c = trip[3] ? parseFloat(trip[3]) : NaN;
    // Skip lumber-ish pairs
    if (!(a <= 4 && b <= 12 && (!Number.isFinite(c) || c <= 16))) {
      if (Number.isFinite(c)) {
        width = true;
        height = true;
        depth = true;
      } else {
        // Closet opening order W×H
        width = true;
        height = true;
        depth = false;
      }
    }
  }
  return { width, height, depth };
}

export function isOpeningStoragePrompt(prompt: string): boolean {
  return /\b(?:linen|closet|alcove|pantry|wardrobe|armoire|hutch|locker)\b/i.test(prompt);
}

/**
 * Fitted classes that densify class-default W×H×D when the stranger typed no axes.
 * Same honesty class as bare linen: title/HUD must not stamp densified envelope as typed.
 * Universal mechanism — opening-storage / vanity / chest / floor-carcase class defaults
 * (bookcase, dresser, media sideboard class, shoe rack, entry bench, floating shelf).
 * Not desk/nightstand (stock design stamp protect) and not chest-of-drawers (drawer bank).
 * Chest gate matches isHingedLidChest bare-chest densify (cedar/blanket/hope without spelling "lid").
 */
export function isClassDefaultDensifyPrompt(prompt: string): boolean {
  if (isOpeningStoragePrompt(prompt)) return true;
  const p = prompt.toLowerCase();
  if (/\bvanity\b/.test(p)) return true;
  // Chest class — not "chest of drawers". Bare cedar/blanket/hope densify here too.
  if (/\bchest\b/.test(p) && !/of\s+drawers/.test(p)) return true;
  if (/hinged\s+(?:lid|top)/.test(p) && /\b(?:chest|box|trunk)\b/.test(p)) return true;
  // Floor / hung carcase class defaults — shared gate, not per-noun title patches.
  // Desk / nightstand / picture ledge stay outside (typed-axes / stock stamp protect).
  if (/\b(?:bookcase|bookshelf)\b/.test(p)) return true;
  if (/\bdresser\b/.test(p)) return true;
  if (/\b(?:sideboard|buffet|credenza)\b/.test(p)) return true;
  if (/\b(?:media|tv)\s*console\b/.test(p)) return true;
  if (/\bmedia\b/.test(p) && /\b(?:console|cabinet|unit)\b/.test(p)) return true;
  if (/shoe\s*rack/.test(p)) return true;
  if (/entry\s*bench/.test(p)) return true;
  if (/floating\s+shel(?:f|ves)\b/.test(p)) return true;
  return false;
}

/** Typed axes for class-default densify prompts — shared digit parser (opening-storage). */
export function typedClassDefaultAxes(prompt: string): {
  width: boolean;
  height: boolean;
  depth: boolean;
} {
  return typedOpeningStorageAxes(prompt);
}

/**
 * Title for class-default densify — stem / partial typed axes; never invent stock W×H×D.
 * Early-return builders (shoe / floating shelf / entry bench) share this with stampFull.
 */
export function classDefaultDensifyTitle(
  stem: string,
  prompt: string,
  overall: { width: number; height: number; depth: number },
): string {
  const base = stem.trim() || "Unit";
  if (!isClassDefaultDensifyPrompt(prompt)) {
    return `${base} ${overall.width}" × ${overall.height}" × ${overall.depth}"`;
  }
  return stampTypedAxesTitle(base, typedClassDefaultAxes(prompt), overall);
}

/** Assumed Voice notes for densified (untyped) axes — shared across early-return builders. */
export function classDefaultAssumedNotes(
  prompt: string,
  stem: string,
  overall: { width: number; height: number; depth: number },
): string[] {
  if (!isClassDefaultDensifyPrompt(prompt)) return [];
  const axes = typedClassDefaultAxes(prompt);
  if (axes.width && axes.height && axes.depth) return [];
  const klass = `${(stem.trim() || "unit").toLowerCase()} class default`;
  const notes: string[] = [];
  if (!axes.width) notes.push(`Assumed ${overall.width}" wide (${klass}) — type a width to lock it.`);
  if (!axes.height) notes.push(`Assumed ${overall.height}" tall (${klass}) — type a height to lock it.`);
  if (!axes.depth) notes.push(`Assumed ${overall.depth}" deep (${klass}) — type a depth to lock it.`);
  return notes;
}

export function openingWidthFromPrompt(prompt: string): number {
  const t = prompt.replace(/×/g, "x").replace(/[″""]/g, '"');
  // Adjectives may sit between the measure and the noun (linen, tall, utility, broom…).
  // Negative lookahead blocks "16 inch deep …" / "78 inch tall …" from becoming width.
  const storageNoun =
    String.raw`(?:(?:bathroom|linen|utility|broom|coat|pantry|tall|storage|closet|wardrobe)\s+){0,3}` +
    String.raw`(?:alcove|opening|niche|closet|wardrobe|pantry|cabinet|cupboard|armoire|hutch|locker|linen)\b`;
  const ahead = t.match(
    new RegExp(
      String.raw`(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s+(?!(?:wide|width|deep|depth|tall|high|height|long|length)\b)` +
        storageNoun,
      "i",
    ),
  );
  if (ahead) {
    const n = parseFloat(ahead[1]);
    // Opening / carcase widths — reject hardware ("2 inch closet rod").
    if (Number.isFinite(n) && n >= 12 && n <= 120) return n;
  }
  const after = t.match(
    new RegExp(
      String.raw`\b` +
        storageNoun +
        String.raw`\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?(?!\s*(?:wide|width|deep|depth|tall|high|height|long|length))`,
      "i",
    ),
  );
  if (after) {
    const n = parseFloat(after[1]);
    if (Number.isFinite(n) && n >= 12 && n <= 120) return n;
  }
  return NaN;
}

/**
 * Measure overlay / panel axis labels.
 * Round tables: Dia × H only — never W×H×D diameter echo (40×30×40).
 */
export function measureChipAxisLabels(opts: {
  width: number;
  height: number;
  depth: number;
  shape?: string | null;
  prompt?: string | null;
  name?: string | null;
}): { mode: "round" | "box"; labels: string[] } {
  if (isRoundUnitEnvelope(opts)) return { mode: "round", labels: ["Dia", "H"] };
  return { mode: "box", labels: ["W", "H", "D"] };
}

export function fmtUnitEnvelopeInches(
  width: number,
  height: number,
  depth: number,
  opts?: {
    shape?: string | null;
    prompt?: string | null;
    name?: string | null;
    legs?: number | null;
  },
): string {
  const round = isRoundUnitEnvelope({
    width,
    height,
    depth,
    shape: opts?.shape,
    prompt: opts?.prompt,
    name: opts?.name,
  });
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return "—";
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };
  if (round) {
    const dia = Math.abs(width - depth) < 0.51 ? width : Math.max(width, depth);
    let s = `${fmt(dia)}" dia × ${fmt(height)}" H`;
    if (opts?.legs && opts.legs > 0) s += ` · ${opts.legs} legs`;
    return s;
  }
  // Class-default densify typed-axes honesty — HUD must not present densified axes as typed.
  // Opening-storage + vanity + hinged chest (same class as bare linen).
  const prompt = opts?.prompt ?? "";
  if (prompt && isClassDefaultDensifyPrompt(prompt)) {
    const axes = typedClassDefaultAxes(prompt);
    const any = axes.width || axes.height || axes.depth;
    // Bare class-default densify (no digits) — densify may still build; never stamp W×H×D as typed.
    if (!any) return "—";
    if (axes.width && !axes.height && !axes.depth) {
      return `${fmt(width)}" wide`;
    }
    if (axes.width && axes.height && !axes.depth) {
      return `${fmt(width)}" × ${fmt(height)}"`;
    }
    if (axes.width && !axes.height && axes.depth) {
      return `${fmt(width)}" × ${fmt(depth)}" deep`;
    }
    if (!axes.width && axes.height && !axes.depth) {
      return `${fmt(height)}" tall`;
    }
    if (!axes.width && !axes.height && axes.depth) {
      return `${fmt(depth)}" deep`;
    }
    if (axes.width && axes.height && axes.depth) {
      return `${fmt(width)}" × ${fmt(height)}" × ${fmt(depth)}"`;
    }
    // Mixed partials (e.g. H+D without W)
    const parts: string[] = [];
    if (axes.width) parts.push(`${fmt(width)}"`);
    if (axes.height) parts.push(`${fmt(height)}"`);
    if (axes.depth) parts.push(`${fmt(depth)}"`);
    return parts.join(" × ");
  }
  return `${fmt(width)}" × ${fmt(height)}" × ${fmt(depth)}"`;
}

/**
 * Class-default densify Measure / HUD empty-state when the stranger typed no axes.
 * Universal (linen / closet / pantry / wardrobe / alcove / vanity / hinged chest) —
 * densify may still build a class envelope, but stranger copy must not imply those
 * dims were typed and must avoid shop jargon ("the unit") next to a bare dash.
 * Partial typed axes keep normal Measure/HUD language.
 */
export function openingStorageMeasureEmptyTalk(prompt: string | null | undefined): {
  bare: boolean;
  hudCompanion: string;
  panelBlurb: string;
  overlayHint: string;
} | null {
  const p = (prompt ?? "").trim();
  if (!p || !isClassDefaultDensifyPrompt(p)) return null;
  const axes = typedClassDefaultAxes(p);
  if (axes.width || axes.height || axes.depth) return null;
  return {
    bare: true,
    // HUD after fmt "—" — action, not jargon.
    hudCompanion: " · type Measure to lock size",
    panelBlurb:
      "No size typed yet. These fields start from Yard's class guess — type your opening to lock width, height, and depth.",
    overlayHint: "Yard sized this — type to lock",
  };
}

/**
 * Shared Measure refit talk densify — universal round envelope class
 * (isRoundUnitEnvelope), not table-noun only.
 * Aligns Check suggestion + Measure panel blurb with Dia×H HUD/paper honesty
 * so strangers are never told to change W×H×D on a Dia×H round build.
 */
export function measureRefitTalk(opts: {
  width: number;
  height: number;
  depth: number;
  shape?: string | null;
  prompt?: string | null;
  name?: string | null;
}): {
  round: boolean;
  panelBlurb: string;
  checkSuggestion: string;
} {
  if (isRoundUnitEnvelope(opts)) {
    return {
      round: true,
      // Universal round class — diameter × height, not W×H×D axis jargon.
      panelBlurb:
        "Dia × H refits this unit — diameter on both plan axes, never W×H×W.",
      checkSuggestion: "Measure is live. Change Dia × H to refit.",
    };
  }
  return {
    round: false,
    panelBlurb: "W × H × D refits this unit. Drawers, knee, doors, and shelves stay.",
    checkSuggestion: "Measure is live. Change W × H × D to refit.",
  };
}

/**
 * Densify Assumed notes from project.notes — filter existing text only; do not invent.
 * Universal (any Assumed … densify disclosure), not linen-only.
 */
export function assumedDensifyNotes(notes: readonly string[] | null | undefined): string[] {
  return (notes ?? []).filter((n) => /^Assumed\b/i.test(String(n).trim()));
}

/** Stranger Confirm/Build Voice — join existing Assumed densify notes as-is. */
export function assumedDensifyNotesTalk(notes: readonly string[] | null | undefined): string {
  return assumedDensifyNotes(notes).join(" ");
}

/**
 * Append Assumed densify notes onto the first Confirm* Build step description
 * so densified size is disclosed in Confirm/Build (and PDF), not silent in notes[].
 */
export function densifyConfirmAssumedNotes(
  instructions: AssemblyStep[],
  notes: readonly string[] | null | undefined,
): AssemblyStep[] {
  const talk = assumedDensifyNotesTalk(notes);
  if (!talk) return instructions;
  let applied = false;
  return instructions.map((s) => {
    if (applied) return s;
    if (!/^Confirm\b/i.test(s.title ?? "")) return s;
    if (/Assumed\b/i.test(s.description ?? "")) {
      applied = true;
      return s;
    }
    applied = true;
    return { ...s, description: `${s.description} ${talk}`.trim() };
  });
}

/**
 * Named-lumber Buy lead Voice note — qty honesty when wood is split across
 * primary board line + separate leg stock (e.g. 2×2 legs).
 *
 * When legs are listed on their own BOM line, primary pcs are structural-only
 * (top/aprons/rails). Never claim Confirm/chip total parity in that case —
 * Confirm/chip count includes the legs. Prefer naming what the qty counts.
 * Shared (not teak-only): any named-lumber primary with legCuts split.
 */
export function honestNamedLumberBuyWoodNote(opts: {
  qty: number;
  legQty?: number;
}): string {
  const n = Math.max(1, opts.qty | 0);
  const legs = Math.max(0, opts.legQty ?? 0);
  const pcs = `${n} piece${n === 1 ? "" : "s"}`;
  if (legs > 0) {
    return `${pcs} · board pcs excluding ${legs} leg${legs === 1 ? "" : "s"} listed below · cut from stock.`;
  }
  return `${pcs} · same wood count as Confirm/chip · cut from stock.`;
}

/**
 * Stranger-facing species stock honesty — title may say Cedar while stock is ply.
 * Prefer this on Buy plywood notes / PDF so the substitute is not silent.
 */
export function speciesStockHonestyTalk(prompt: string, stockLabel: string): string | null {
  const note = speciesSubstituteNote(prompt, stockLabel);
  if (!note) return null;
  const sp = speciesDisplayFromPrompt(prompt);
  if (!sp) return note;
  return `Stock is ${stockLabel} (structural). ${sp} in the title means optional ${sp.toLowerCase()} lining or finish — not silent solid-${sp.toLowerCase()} boards.`;
}

