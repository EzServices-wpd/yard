/**
 * Endless Ideas (specs/004-ideas): the anonymous query log, shared by server and client.
 * Pure: no engine import, no store, no xAI. Records hold a prompt, size, result key and status only (R1, R2).
 */
export type LogStatus = "Trusted" | "Unverified" | "Failed";
export const STATUS_RANK: Record<LogStatus, number> = { Failed: 0, Unverified: 1, Trusted: 2 };
export type LogRecord = { key: string; prompt: string; size: string; resultKey: string; status: LogStatus };
export type SnapshotRow = { key: string; prompt: string; size: string; resultKey: string; status: Exclude<LogStatus, "Failed">; count: number; /** Last time it was built (ISO UTC), when it is in the recent log. */ lastSeen?: string | null };
export type IdeasSnapshot = { at: string; live: boolean; rows: SnapshotRow[]; popular: SnapshotRow[]; recent: SnapshotRow[] };
export const EMPTY_SNAPSHOT: IdeasSnapshot = { at: "", live: false, rows: [], popular: [], recent: [] };
export const PROMPT_CAP = 140;

// ---- R10: PII stripping -------------------------------------------------------------------------
const PII: RegExp[] = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, // email
  /\b(?:https?:\/\/|www\.)\S+/gi, // URL
  /\b[\w-]+\.(?:com|net|org|io|co|wiki|app|dev|me|us|uk)\b\S*/gi, // bare domain
  /(?<!\w)@\w{2,}/g, // handle
  // Phones look like phones: (212) 555-0199, 212-555-0199, 555-0199, +1 212 555 0199, 2125550199. Bare size lists ("36 72 12 16") pass.
  /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g,
  /\+\d[\d\s().-]{9,16}\d/g,
  /\b\d{3}[.-]\d{4}\b/g,
  /\b\d{10,11}\b/g,
  /\bp\.?\s?o\.?\s+box\s+\d+/gi, // PO box
  /\b\d{1,6}\s+(?:[a-z]+\s+){1,3}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|circle|cir|highway|hwy)\b\.?(?!\s*(?:settings?|mats?|cards?|holders?)\b)/gi, // street address: a name word before the suffix
  /(?<![\d.\/-])\b\d{5}(?:-\d{4})?\b(?![\d.\/])(?!\s*(?:btu|lbs?|watts?|mah|rpm|gal|ml|mm|psi)\b)/gi, // standalone ZIP or ZIP+4 (F33)
];

/** Strips addresses, emails, phones, URLs and handles. Returns null when anything was stripped (the prompt is dropped, R10). */
export function stripPii(raw: string): string | null {
  const text = normalisePrompt(raw);
  for (const re of PII) if (new RegExp(re.source, re.flags.replace("g", "")).test(text)) return null;
  return text;
}

export function normalisePrompt(raw: string): string {
  return String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, PROMPT_CAP);
}

// ---- R11: offensive-text filter (local list, leetspeak folded; no AI call) -----------------------
const FOLD: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };
const fold = (s: string) => s.toLowerCase().replace(/[013457@$!]/g, (c) => FOLD[c] ?? c).replace(/(.)\1{2,}/g, "$1$1");
// Stems matched at word start; kept short and blunt on purpose. Woodworking words that contain them are allowed below.
const BAD = ["fuck", "shit", "cunt", "bitch", "whore", "slut", "nigger", "nigga", "fag", "retard", "retarded", "rape", "nazi", "kike", "spic", "chink", "tranny", "dick", "cock", "pussy", "porn", "penis", "vagina", "dildo", "kill", "suicide", "bomb", "gun rack for killing"];

export function isOffensive(text: string): boolean {
  // "f.u.c.k" / "f u c k": runs of single letters are joined into one word too.
  const raw = fold(text).split(/[^a-z]+/).filter(Boolean);
  const words = [...raw, ...fold(text).split(/\s{2,}|(?<=[a-z]{2})\s|\s(?=[a-z]{2})/).map((g) => g.replace(/[^a-z]/g, "")).filter(Boolean)];
  // F33: whole words only ("cockatoo", "dickens" pass), plus simple inflections of a stem.
  return words.some((w) => BAD.some((b) => !b.includes(" ") && new RegExp(`^${b}(?:s|es|ed|er|ers|ing|y)?$`).test(w)));
}

/** What may be stored and shown: sanitised text, or null (never stored, never shown). */
export function safePrompt(raw: string): string | null {
  const t = stripPii(raw);
  if (!t || t.length < 2 || isOffensive(t)) return null;
  return t;
}

// ---- R4: dedup key ---------------------------------------------------------------------------------
/** FNV-1a 32-bit, hex. Stable across server and client. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
export function logKey(prompt: string, resultKey: string, size: string): string {
  return hash(`${prompt.toLowerCase()}|${resultKey}|${size}`);
}

// ---- R8: global search over the snapshot -----------------------------------------------------------
export function searchLog(rows: SnapshotRow[], query: string): SnapshotRow[] {
  const toks = query.toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (!toks.length) return [];
  return rows
    .filter((r) => {
      const hay = `${r.prompt} ${r.resultKey.replace(/[:-]/g, " ")}`.toLowerCase();
      return toks.every((t) => hay.includes(t));
    })
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.count - a.count);
}

/** Popular is Trusted only (R9), ranked by count. */
export function trustedPopular(rows: SnapshotRow[], cap = 12): SnapshotRow[] {
  return rows.filter((r) => r.status === "Trusted").sort((a, b) => b.count - a.count).slice(0, cap);
}
