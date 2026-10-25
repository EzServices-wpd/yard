/**
 * The live Ideas feed (REVIEW.md (a)–(e), PR-PLAN.md (a)): the visitor log grouped by build type, test traffic
 * dropped, then today's curated sections. Built on the server from the store snapshot (never in the browser),
 * served by /api/ideas behind the CDN. Pure: no engine, no store. Deletes nothing: test rows are only skipped.
 */
import type { IdeasSnapshot, SnapshotRow } from "@/lib/yard/ideaLog";
import { IDEAS } from "@/lib/yard/ideas";
import TYPES from "./types.json";
import { isHeldType } from "./held";
import { drawingFor, sizeOf, type IdeaCard, type IdeaHero, type IdeaSection, type IdeasFeed } from "./feed";
import { isLoggedTest } from "./testTraffic";

/** #56 merged (2026-10-16 12:24 ET): from then the log records no offline, x-yard-test or preview traffic. */
export const TEST_CUTOFF = "2026-10-16T16:24:56Z";
/** Max cards sent per section (the UI shows 6–8 and "Show all"). */
export const SECTION_MAX = 24;
export const HERO_DAYS = 7;
export const HERO_MAX_PARTS = 150;
const DAY = 86_400_000;

/** Our own release prompts: scripts/weekend-canaries.ts CANARIES, the gate's linen closet and the Critic bookshelf. */
export const TEST_PROMPTS = new Set([
  "big ben", "eiffel tower", "brooklyn bridge", "trebuchet", "submarine", "water wheel",
  "linen closet 31.5 wide 78 tall 16 deep", "bookshelf 36x12x72",
]);

/** Build types that are the engine's generic fallback, not a thing anyone asked for by name. */
export const GENERIC_TYPES = new Set(["storage-unit", "storage", "thing", "box", "unit", "rough-block", "block"]);

/** Chained follow-ups ("birdhouse. Then: 3/8 dowel") are a test or a session, never an idea to build. */
export const isChained = (prompt: string) => /\bthen\s*:/i.test(prompt);

/**
 * Test traffic: a row the log stamped as test (the test=1 flag or x-yard-test header, src/lib/ideas/testTraffic.ts),
 * our exact release prompts, chained prompts, placeholders, or a row not seen since #56 (Critic before the filter).
 * Never a word in the prompt: "test tube rack" is a real build.
 */
export function isTestRow(r: Pick<SnapshotRow, "prompt" | "resultKey"> & { lastSeen?: string | null; source?: SnapshotRow["source"] }, cutoff = TEST_CUTOFF): boolean {
  const p = r.prompt.trim().toLowerCase();
  return isLoggedTest(r) || TEST_PROMPTS.has(p) || isChained(p) || /^unknown:|^failed$/.test(r.resultKey) || !r.lastSeen || r.lastSeen < cutoff;
}

/** Synonyms the engine names differently but a visitor sees as one build. */
const ALIAS: Record<string, string> = { bookshelf: "bookcase", "raised-bed": "raised-garden-bed", "garden-bed": "raised-garden-bed", "planter-bo": "planter-box", "jewelry-bo": "jewelry-box" };

/** One build type per result key: "builtin:bookcase-36" / "recipe:bookshelf" → "bookcase". */
export function typeKey(resultKey: string): string {
  // A leading stock size is not the object: "builtin:3-4-soccer-goal" (3/4 PVC) is a soccer goal, not type "3" (row 111).
  let k = resultKey.replace(/^[a-z]+:/, "").replace(/^(?:\d+-)+(?=[a-z])/, "").replace(/-\d.*$/, "").replace(/-(?:along|to|wide|tall|long|for)(?:-.*)?$/, "");
  k = ALIAS[k] ?? k;
  // Quick win (e): the log's 40-char result keys cut "box" to "bo" ("Pine toolbo"): any key ending "bo" is a box.
  if (/bo$/.test(k) && !/(?:^|-)(?:jum|gum|com|ho|lim|bim|ram|dum)bo$/.test(k)) k = `${k}x`;
  return k || "thing";
}

/**
 * The shared card-quality rule (row 111): a card title needs at least MIN_TITLE_LETTERS letters, so a title that is
 * only digits, a fraction or a stub ("3", "3/4", "X") never renders in any section. liveFeed drops such cards and
 * feedViolations reports one if it ever gets through.
 */
export const MIN_TITLE_LETTERS = 3;
export const isJunkTitle = (title: string) => (title.match(/[a-z]/gi)?.length ?? 0) < MIN_TITLE_LETTERS;

const titleOf = (k: string) => k.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

export function dimsOf(size: string): IdeaCard["dims"] {
  const m = /^(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)$/.exec(size.trim());
  return m ? { width: +m[1], depth: +m[2], height: +m[3] } : null; // recordFromPrompt stores W×D×H
}

/**
 * Critic-graded build types (row 169): the base feed's checked cards, i.e. the curated ideas and the trusted recipes
 * Critic walked. A built-in shape is Trusted by default (buildInfo), so "Trusted" alone let ungraded builds reach
 * Popular: the cardboard dollhouse (a sealed box) and "shoe rack by the door" (a prehung door). A log build counts as
 * checked only when its type is graded; Popular and the hero take checked cards only.
 */
export function gradedTypes(base: IdeasFeed): Set<string> {
  const out = new Set<string>();
  for (const s of base.sections) for (const c of s.cards) if (c.status === "checked") out.add(c.buildType);
  return out;
}

type Group = { type: string; count: number; lastSeen: string; trusted: boolean; rows: SnapshotRow[] };

/** Log rows that are real visitor builds, folded by build type. */
export function groupRows(rows: SnapshotRow[], cutoff = TEST_CUTOFF): Group[] {
  const by = new Map<string, Group>();
  for (const r of rows) {
    if (isTestRow(r, cutoff)) continue;
    const type = typeKey(r.resultKey);
    const g = by.get(type) ?? { type, count: 0, lastSeen: "", trusted: false, rows: [] };
    g.count += r.count;
    if ((r.lastSeen ?? "") > g.lastSeen) g.lastSeen = r.lastSeen!;
    g.trusted ||= r.status === "Trusted";
    g.rows.push(r);
    by.set(type, g);
  }
  return [...by.values()];
}

/** Yard's own prompt per engine build type (types.json maps each idea slug to its type); first idea wins. */
const YARD_PROMPT = new Map<string, string>();
for (const d of IDEAS) { const t = (TYPES as Record<string, string>)[d.id]; if (t && !YARD_PROMPT.has(t)) YARD_PROMPT.set(t, d.prompt); }

/**
 * What a log-only card builds when tapped: Yard's own prompt for that build type, else the engine's type and logged
 * W×D×H ("mailbox 8 wide 18 tall 8 deep"). Never the words a visitor typed: the privacy page says the Ideas library
 * never keeps them, so no feed field may carry them.
 */
export function logCardPrompt(type: string, dims: IdeaCard["dims"]): string {
  const yard = YARD_PROMPT.get(type);
  if (yard) return yard;
  const t = type.replace(/-/g, " ");
  return dims ? `${t} ${dims.width} wide ${dims.height} tall ${dims.depth} deep` : t;
}

/** Count desc, then lastSeen desc (null last), then the source order. */
export function sortCards(cards: IdeaCard[]): IdeaCard[] {
  return cards.map((c, i) => ({ c, i })).sort((a, b) => b.c.count - a.c.count || (b.c.lastSeen ?? "").localeCompare(a.c.lastSeen ?? "") || a.i - b.i).map((x) => x.c);
}

function cardFor(g: Group, curated: Map<string, IdeaCard>, graded: Set<string>): IdeaCard {
  const top = [...g.rows].sort((a, b) => b.count - a.count)[0];
  const sizes = new Map<string, number>();
  for (const r of g.rows) sizes.set(r.size, (sizes.get(r.size) ?? 0) + r.count);
  const size = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  // Checked = graded by Critic (row 169): a curated card keeps its own status, and a log-only type is checked only when
  // Critic graded it too. The engine's own Trusted never makes a card checked.
  const status: IdeaCard["status"] = g.trusted && graded.has(g.type) ? "checked" : "new";
  const c = curated.get(g.type);
  if (c) return { ...c, count: g.count, lastSeen: g.lastSeen, status: c.status === "checked" ? "checked" : "new", dims: c.dims ?? dimsOf(size) };
  const recipe = top.resultKey.startsWith("recipe:");
  const drawing = drawingFor(g.type);
  const logged = dimsOf(size);
  // The size is the engine's: the drawing's own labels when there is a drawing, else the logged W×D×H.
  return {
    slug: g.type, buildType: g.type, title: titleOf(g.type), count: g.count, lastSeen: g.lastSeen, examplePrompt: logCardPrompt(g.type, logged),
    recipeKey: recipe ? g.type : null, dims: logged, ...sizeOf(drawing?.dims ?? logged), status, section: "Popular", drawing,
  };
}

/** Home "People are making right now" rows (MakingNow.tsx). `q` is what a tap builds. */
export type MakingNowItem = { slug: string; title: string; size: string; sizeAria: string; q: string };
export const MAKING_NOW_MAX = 12;

/**
 * The home strip: the live feed's counted, drawn cards, newest build first. Each row is a card's display title and engine
 * size, so it carries no visitor's typed words (privacy page) and drops what the feed drops (test traffic, generic,
 * held, junk titles). The fallback feed has no live rows → no strip.
 */
export function makingNow(feed: IdeasFeed, cap = MAKING_NOW_MAX): MakingNowItem[] {
  if (!feed.live) return [];
  return feed.sections.flatMap((s) => s.cards)
    // A drawn card is a build Yard authored, so a tap builds what the row names (an undrawn log type's fallback prompt can drop its stock).
    .filter((c) => c.count > 0 && c.lastSeen && c.drawing && !isJunkTitle(c.title))
    .sort((a, b) => b.lastSeen!.localeCompare(a.lastSeen!))
    .slice(0, cap)
    .map((c) => ({ slug: c.slug, title: c.title, size: c.size, sizeAria: c.sizeAria, q: c.examplePrompt }));
}

/** Most-built checked idea over the last 7 days that is cheap to turn live on a phone, else null. */
export function pickHero(cards: IdeaCard[], now: Date): IdeaHero | null {
  const since = new Date(now.getTime() - HERO_DAYS * DAY).toISOString();
  const ok = sortCards(cards.filter((c) => c.status === "checked" && c.lastSeen && c.lastSeen >= since && c.drawing && c.drawing.parts <= HERO_MAX_PARTS && c.count > 0));
  const h = ok[0];
  return h ? { slug: h.slug, examplePrompt: h.examplePrompt, title: h.title, count: h.count } : null;
}

/**
 * The feed: Popular (Trusted types by real count), Popular recently (built in the last 7 days), then the curated
 * sections. One card per build type across the page (first section wins). Not live, or no real rows → `base`.
 */
export function liveFeed(snap: IdeasSnapshot, base: IdeasFeed, now = new Date(), cutoff = TEST_CUTOFF): IdeasFeed {
  const groups = groupRows(snap.rows, cutoff);
  if (!snap.live || !groups.length) return { ...base, live: false };
  const curated = new Map<string, IdeaCard>();
  for (const s of base.sections) for (const c of s.cards) if (!curated.has(c.buildType)) curated.set(c.buildType, c);
  // Quick win (e): a generic fallback ("Storage unit") is never an idea; it stays off the page (the row is kept in the log).
  // A held recipe (held.ts, the shared flag) never renders on Ideas, in Popular, Popular recently or a curated section.
  const graded = gradedTypes(base);
  const trusted = new Set(groups.filter((g) => g.trusted).map((g) => g.type));
  const cards = groups.filter((g) => !GENERIC_TYPES.has(g.type) && !isHeldType(g.type)).map((g) => cardFor(g, curated, graded));
  const since = new Date(now.getTime() - HERO_DAYS * DAY).toISOString();
  const used = new Set<string>();
  // Only a card a section actually renders is used (Critic row 111: Popular marked every Trusted card used, not just
  // the SECTION_MAX it shows, so low-count builds like the mail organizer and under-stairs shelves showed nowhere).
  const take = (id: string, title: string, list: IdeaCard[]): IdeaSection => {
    const all = sortCards(list).filter((c) => !isJunkTitle(c.title) && !used.has(c.slug) && !used.has(c.buildType));
    const shown = all.slice(0, SECTION_MAX);
    shown.forEach((c) => { used.add(c.slug); used.add(c.buildType); });
    return { id, title, order: 0, total: all.length, cards: shown.map((c) => ({ ...c, section: title })) };
  };
  const sections = [
    // Popular: Trusted builds Critic graded (row 169), never a type the engine called Trusted on its own.
    take("popular", "Popular", cards.filter((c) => c.status === "checked" && graded.has(c.buildType) && trusted.has(c.buildType))),
    take("recent", "Popular recently", cards.filter((c) => (c.lastSeen ?? "") >= since)),
    ...base.sections.map((s) => {
      const counted = s.cards.filter((c) => !isHeldType(c.buildType) && !isHeldType(c.recipeKey)).map((c) => cards.find((x) => x.slug === c.slug) ?? c);
      return take(s.id, s.title, counted);
    }),
  ].filter((s) => s.cards.length).map((s, order) => ({ ...s, order }));
  return { at: snap.at || now.toISOString(), live: true, countsLive: true, hero: pickHero(cards, now), sections };
}

/**
 * The invariant (REVIEW.md (e)): every way the feed can go wrong, as messages. Empty = good. With the snapshot, a
 * counted card whose example is a row the log stamped as test traffic is a violation too. With `graded` (the live
 * feed's gradedTypes(base)), a counted checked card or any Popular card whose type Critic never graded fails (row 169).
 */
export function feedViolations(feed: IdeasFeed, snap?: Pick<IdeasSnapshot, "rows">, graded?: Set<string>): string[] {
  const out: string[] = [];
  const loggedTest = new Set((snap?.rows ?? []).filter(isLoggedTest).map((r) => r.prompt.trim().toLowerCase()));
  const seenSlug = new Map<string, string>(), seenType = new Map<string, string>();
  for (const s of feed.sections) {
    if (s.cards.length > SECTION_MAX) out.push(`${s.id}: ${s.cards.length} cards (max ${SECTION_MAX})`);
    if (s.total < s.cards.length) out.push(`${s.id}: total ${s.total} < ${s.cards.length} cards`);
    if (!s.title.trim()) out.push(`${s.id}: no title`);
    const sorted = sortCards(s.cards);
    if (feed.countsLive && sorted.some((c, i) => c.slug !== s.cards[i].slug)) out.push(`${s.id}: not sorted by count, then lastSeen`);
    for (const c of s.cards) {
      if (seenSlug.has(c.slug)) out.push(`slug ${c.slug} in ${seenSlug.get(c.slug)} and ${s.id}`);
      if (seenType.has(c.buildType)) out.push(`build type ${c.buildType} in ${seenType.get(c.buildType)} and ${s.id}`);
      seenSlug.set(c.slug, s.id); seenType.set(c.buildType, s.id);
      const p = c.examplePrompt.trim().toLowerCase();
      if (!p || isChained(p) || /placeholder|learner/i.test(p)) out.push(`${c.slug}: example prompt "${c.examplePrompt}" is not buildable`);
      // A counted card from the log never shows a test prompt: our release prompts, or a row logged as test traffic.
      if (c.count > 0 && (TEST_PROMPTS.has(p) || loggedTest.has(p))) out.push(`${c.slug}: test prompt "${c.examplePrompt}"`);
      if (!c.title.trim() || c.title.trim() === c.examplePrompt.trim() || /^[a-z]/.test(c.title)) out.push(`${c.slug}: title "${c.title}" is not a display title`);
      if (isJunkTitle(c.title)) out.push(`${c.slug}: junk title "${c.title}" (fewer than ${MIN_TITLE_LETTERS} letters)`);
      if (c.status !== "checked" && c.status !== "new") out.push(`${c.slug}: status ${c.status}`);
      if (graded && ((c.count > 0 && c.status === "checked") || s.id === "popular") && !graded.has(c.buildType)) out.push(`${c.slug}: not graded by Critic, in ${s.id} as ${c.status}`);
      if (s.id === "popular" && c.status !== "checked") out.push(`${c.slug}: Popular shows only checked cards (${c.status})`);
      if (GENERIC_TYPES.has(c.buildType)) out.push(`${c.slug}: generic fallback card`);
      if (isHeldType(c.buildType) || isHeldType(c.recipeKey)) out.push(`${c.slug}: held recipe on Ideas (${s.id})`);
      if (/bo$/.test(c.title) && !/(?:jum|gum|com|ho|lim|bim|ram|dum)bo$/i.test(c.title)) out.push(`${c.slug}: cut-off title "${c.title}"`);
      if (c.drawing && !/^\/ideas\/drawings\/[\w-]+\.[0-9a-f]+(?:\.\w+)?\.svg$/.test(c.drawing.src)) out.push(`${c.slug}: drawing ${c.drawing.src}`);
      for (const k of Object.keys(c)) if (/href|store|offer|affiliate|price|shop/i.test(k)) out.push(`${c.slug}: store field ${k}`);
    }
  }
  if (!feed.live && feed.hero) out.push("hero on the fallback feed");
  if (feed.hero) {
    const h = feed.sections.flatMap((s) => s.cards).find((c) => c.slug === feed.hero!.slug);
    if (!h || h.status !== "checked" || (h.drawing?.parts ?? Infinity) > HERO_MAX_PARTS) out.push(`hero ${feed.hero.slug} is not a checked card with ≤${HERO_MAX_PARTS} parts`);
  }
  return out;
}
