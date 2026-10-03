/**
 * Cut order — a prompt that names only stock, a count and a length ("pine 20 at 12 inch",
 * "20 pine boards at 12 inches", "cut 20 pieces of 1x4 12 inches long") asks for pieces, not a
 * creature or a piece of furniture. It builds those pieces laid side by side, so the cut list and
 * the buy list read straight off the order.
 */
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { INCH_NUM, inchFrac, parseInchNum } from "./inchText";
import type { CatalogItem, YardProject } from "./types";

const SPECIES = /\b(?:pine|oak|red\s+oak|white\s+oak|cedar|poplar|maple|walnut|birch|fir|douglas\s+fir|spruce|redwood|cherry|ash|hemlock|whitewood|hardwood|softwood|lumber|wood)\b/;
const NOMINAL = /\b(?:[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)|two\s+by\s+(?:two|four|six)|one\s+by\s+(?:two|three|four|six))\b/;
const FILLER = /\b(?:at|of|pieces?|pcs?|cut|cuts|boards?|sticks?|strips?|lengths?|long|each|to|me|please|i|need|want|get|x|by|and|a|the|in|lumber|wood|@)\b/g;

export type CutOrder = { count: number; length: number; species: string | null; nominal: string | null };

/** Read a cut order, or null when the prompt names anything beyond stock, count and length. */
export function cutOrderOf(prompt: string): CutOrder | null {
  const lower = ` ${prompt.toLowerCase().replace(/[″"]/g, " inch ").replace(/[′]/g, " ft ")} `;
  const lenRe = new RegExp(String.raw`(?<![\w/])(${INCH_NUM})\s*(?:-\s*)?(inches|inch|in|ft|foot|feet)\b`);
  const lm = lower.match(lenRe);
  if (!lm) return null;
  const length = parseInchNum(lm[1]) * (/^f/.test(lm[2]) ? 12 : 1);
  if (!Number.isFinite(length) || length < 1 || length > 192) return null;
  let rest = lower.replace(lm[0], " ");
  const nm = rest.match(NOMINAL);
  const nominal = nm ? nm[0].replace(/\s+/g, "") : null;
  if (nm) rest = rest.replace(nm[0], " ");
  const sm = rest.match(SPECIES);
  const species = sm && !/^(?:lumber|wood)$/.test(sm[0]) ? sm[0] : null;
  const stockWord = Boolean(nominal || sm || /\b(?:boards?|sticks?|strips?)\b/.test(rest));
  if (!stockWord) return null;
  const cm = rest.match(/(?<![\w./])(\d{1,3})(?![\w./])/);
  if (!cm) return null;
  const count = parseInt(cm[1], 10);
  if (!(count >= 1 && count <= 200)) return null;
  rest = rest.replace(cm[0], " ").replace(new RegExp(SPECIES.source, "g"), " ").replace(FILLER, " ");
  // Anything left is a subject ("birdhouse", "shelf") — not a bare cut order.
  if (/[a-z0-9]/.test(rest)) return null;
  return { count, length, species, nominal };
}

function stockFor(order: CutOrder): CatalogItem | undefined {
  const nom = order.nominal
    ?.replace(/two\s*by\s*/, "2x")
    .replace(/one\s*by\s*/, "1x")
    .replace(/two$/, "2")
    .replace(/three$/, "3")
    .replace(/four$/, "4")
    .replace(/six$/, "6")
    .replace(/×/, "x");
  return (nom ? getCatalogItem(`lumber-${nom}-8`) : undefined) ?? getCatalogItem("lumber-1x4-8");
}

/** Build the pieces of a cut order, laid side by side, or null when the prompt is not one. */
export function placeCutOrder(prompt: string): YardProject | null {
  const order = cutOrderOf(prompt);
  if (!order) return null;
  const item = stockFor(order);
  if (!item) return null;
  const stockLen = item.dims.length ?? 96;
  const w = item.dims.width ?? 3.5;
  const t = item.dims.height ?? 0.75;
  const L = Math.round(order.length * 16) / 16;
  const nom = (item.name.match(/\d+×\d+/) ?? ["board"])[0];
  const species = order.species ? order.species.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  const stockTalk = `${species ? `${species} ` : ""}${nom}`.trim();
  const gap = 0.5;
  const instances = Array.from({ length: order.count }, (_, i) => {
    const pos = { x: 0, y: t / 2, z: i * (w + gap) - ((order.count - 1) * (w + gap)) / 2 };
    return {
      id: createId("inst"),
      catalogId: item.id,
      position: pos,
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: L,
      role: "member",
      home: pos,
    };
  });
  const kerf = 0.125;
  const perBoard = Math.max(0, Math.floor((stockLen + kerf) / (L + kerf)));
  const notes: string[] = [];
  notes.push(`${order.count} pieces of ${stockTalk} cut to ${inchFrac(L)}" long.`);
  if (perBoard >= 1) {
    const boards = Math.ceil(order.count / perBoard);
    notes.push(
      `${perBoard === 1 ? "1 piece comes" : `${perBoard} pieces come`} out of each ${Math.round(stockLen / 12)} ft board with a 1/8" saw kerf, so you need ${boards} board${boards === 1 ? "" : "s"}.`,
    );
  } else {
    notes.push(`Each piece is longer than a ${Math.round(stockLen / 12)} ft board. Buy longer boards, or join two with a scarf or lap joint.`);
  }
  notes.push("Type what the pieces are for (a shelf, a box, a frame) and Yard builds that instead.");
  const depth = order.count * (w + gap) - gap;
  return {
    id: createId("proj"),
    name: `${order.count} pieces at ${inchFrac(L)}" — ${stockTalk}`,
    prompt,
    kind: "custom",
    overall: { width: L, height: t, depth },
    instances,
    panels: [],
    primaryMaterialId: item.id,
    notes,
    assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}
