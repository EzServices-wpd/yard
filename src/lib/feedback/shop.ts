/**
 * "Tell the shop": build feedback, shared by the sheet (client) and /api/feedback (server).
 * No identity anywhere: no email, name, IP, user agent or cookie. The prompt and the note pass the
 * same PII scrub as the query log (safePrompt), and a scrubbed-out field is dropped, not stored.
 */
import { safePrompt } from "@/lib/yard/ideaLog";

export const CHIPS = [
  { id: "wrong-object", label: "Wrong object" },
  { id: "wrong-size", label: "Wrong size" },
  { id: "floating", label: "Parts floating" },
  { id: "steps", label: "Steps confusing" },
  { id: "price", label: "Price off" },
  { id: "other", label: "Other" },
] as const;
export type ChipId = (typeof CHIPS)[number]["id"];
const CHIP_IDS = new Set<string>(CHIPS.map((c) => c.id));
export const NOTE_CAP = 140; // the query log's own cap, so the note gets the identical scrub

export type FeedbackIn = { prompt: string; size: string; partCount: number; chips: ChipId[]; note: string };
export type FeedbackRecord = { prompt: string | null; size: string; partCount: number; chips: ChipId[]; note: string | null; tip: string; at: string };

const SIZE = /^[0-9 x×."'/-]{1,40}$/i;

/** Liberal in what it accepts (Postel), strict in what it keeps. Null when there is nothing worth storing. */
export function cleanFeedback(raw: unknown, tip: string, now = new Date()): FeedbackRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const chips = Array.isArray(b.chips) ? [...new Set(b.chips.filter((c): c is ChipId => typeof c === "string" && CHIP_IDS.has(c)))] : [];
  const note = typeof b.note === "string" && b.note.trim() ? safePrompt(b.note) : null;
  if (!chips.length && !note) return null;
  const prompt = typeof b.prompt === "string" ? safePrompt(b.prompt) : null;
  const size = typeof b.size === "string" && SIZE.test(b.size.trim()) ? b.size.trim() : "";
  const n = Number(b.partCount);
  const partCount = Number.isInteger(n) && n >= 0 && n < 10_000 ? n : 0;
  return { prompt, size, partCount, chips, note, tip: /^[0-9a-f]{7,40}$/i.test(tip) ? tip.slice(0, 7) : "local", at: now.toISOString() };
}
