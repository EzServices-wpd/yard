/**
 * The link preview card for one shared build (PR 4, build identity): 1200×630, Night shop palette.
 * Pure and read-only: it decodes the existing ?y= share token, rebuilds it the way the bench does (replayShare)
 * and prices it with buildPlan, the same plan the Buy list prints, so the card and the page say the same total.
 */
import { decodeShare, replayShare, type SharePayload } from "@/lib/yard/shareBuild";
import { buildPlan } from "@/lib/yard/report";
import { headerAxes, headerName } from "@/lib/yard/pdf";
import { planOverviewSvg } from "@/lib/yard/planStepPicture";
import { ignoredTypedWords } from "@/lib/yard/promptMain";
import { engineKeepsPrompt, routesToLearner } from "@/lib/yard/formOwnership";
import { looksLikePocket } from "@/lib/yard/pocket";
import { usd } from "@/lib/utils";

export const CARD_W = 1200, CARD_H = 630;
/** Night shop (PR 2a tokens): ground, ink and muted ink on it. Chalk blue is for marks only, so none here; the drawing keeps its own paper. */
const NIGHT = { bg: "#131518", fg: "#eceae6", muted: "#a2a8af" };
/** Longer tokens are not share links (the longest canary, the pocket vanity, is about 1.5 KB). */
export const MAX_TOKEN = 4096;
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;
/** A drawing this large would take too long to rasterise; the default card goes out instead. */
const MAX_DRAWING = 1_500_000;
/** The drawing is laid out at 400 and shown at 520, so its dimension labels read at thumbnail size. */
const DRAW = 520, LAYOUT = 400;

export type CardFacts = { name: string; size: string; parts: number; price: string; drawing: string };

const count = (v: unknown) => v == null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 99);
/** A token the bench would open exactly as a share link: a well-formed payload with no Measure edits. */
export function cardPayload(token: unknown): SharePayload | null {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN || !TOKEN_RE.test(token)) return null;
  const p = decodeShare(token);
  if (!p || typeof p.prompt !== "string" || !p.prompt.trim() || typeof p.measure !== "object" || p.measure === null) return null;
  // Measure edits are applied by the bench's store after the build: the card shows only builds it can match exactly.
  if (Object.keys(p.measure).length) return null;
  if ((p.stockId != null && typeof p.stockId !== "string") || (p.join != null && typeof p.join !== "string")) return null;
  if (![p.shelves, p.cubbies, p.drawers].every(count)) return null;
  return p;
}

/** The facts the card prints, or null when the default card should go out instead. */
export function cardFacts(token: unknown): CardFacts | null {
  const payload = cardPayload(token);
  if (!payload) return null;
  // The bench opens a link by building the words fresh and then setting the stock on that build (shell.tsx), and
  // the permalink always names the stock it was built on: a stock or join other than the fresh build's own is a
  // switch the card can't reproduce exactly (generateFromPrompt(words, stock) is the switch path, priced
  // differently), so only the fresh build's own stock and join get a built card.
  const project = replayShare({ ...payload, stockId: undefined, join: undefined });
  if (project.refused || project.displayOnly) return null;
  if (payload.stockId != null && payload.stockId !== project.primaryMaterialId) return null;
  if (payload.join != null && payload.join !== project.shopJoin) return null;
  // A noun the engine does not own goes to the learner on the bench (run-prompt.ts): no engine guess on a card.
  const prompt = payload.prompt.trim(), half = ignoredTypedWords(project, prompt).length > 0;
  if (!engineKeepsPrompt(prompt, project, half) && routesToLearner(prompt, project, half) && !looksLikePocket(prompt)) return null;
  const plan = buildPlan(project);
  if (!(plan.totals.pieces > 0)) return null;
  const drawing = planOverviewSvg(project, LAYOUT, LAYOUT).svg;
  if (drawing.length > MAX_DRAWING) return null;
  const cost = usd(plan.totals.estCostUsd);
  const parts = plan.totals.pieces;
  return { name: headerName(project), size: headerAxes(project), parts, price: cost === "—" ? "" : `${cost} estimated`, drawing };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Up to two lines of about `per` characters, the second ending in … when the name runs longer. */
function wrap(text: string, per: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > per) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  const second = lines.slice(1).join(" ");
  return [lines[0], `${second.slice(0, per - 1).trimEnd()}…`];
}

const text = (x: number, y: number, size: number, fill: string, s: string, weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Figtree" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
/** A font size that keeps one line inside `width` (Figtree digits and capitals average about 0.5 em). */
const fit = (s: string, max: number, width: number) => Math.max(20, Math.min(max, Math.floor(width / (0.5 * Math.max(s.length, 1)))));

/** The card SVG: the facts on the dark ground at left, the dimensioned drawing on its sheet at right. */
export function cardSvg(f: CardFacts | null): string {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}"><rect width="100%" height="100%" fill="${NIGHT.bg}"/>`;
  const brand = text(64, 566, 30, NIGHT.fg, "yard.wiki", 700);
  if (!f) {
    return `${open}${text(64, 250, 96, NIGHT.fg, "Yard", 700)}${text(64, 330, 40, NIGHT.fg, "Think it up. Yard works it out.")}${text(64, 390, 30, NIGHT.muted, "One model. Every cut, part and step.")}${brand}</svg>`;
  }
  const name = wrap(f.name, 15);
  const nameSize = 64, top = 132;
  const title = name.map((l, i) => text(64, top + i * 76, nameSize, NIGHT.fg, l, 700)).join("");
  const y = top + (name.length - 1) * 76 + 84;
  const facts = [f.parts === 1 ? "1 part" : `${f.parts} parts`, f.price].filter(Boolean).join(" · ");
  const sheetX = CARD_W - 64 - DRAW, sheetY = (CARD_H - DRAW) / 2;
  const drawing = f.drawing.replace(/^<svg\b[^>]*>/, `<svg x="${sheetX}" y="${sheetY}" width="${DRAW}" height="${DRAW}" viewBox="0 0 ${LAYOUT} ${LAYOUT}">`);
  return `${open}${title}${text(64, y, fit(f.size, 34, 500), NIGHT.muted, f.size)}${text(64, y + 52, fit(facts, 34, 500), NIGHT.fg, facts)}`
    + `${brand}${drawing}</svg>`;
}

/** Width and height from a PNG's IHDR, for the route's own check and the render test. */
export function pngSize(png: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 24 || sig.some((b, i) => png[i] !== b)) return null;
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}
