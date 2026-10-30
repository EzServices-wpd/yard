/**
 * cardFacts runs the engine and the Buy list for words anyone can put in a URL, and some builds take minutes
 * (a 100 ft popsicle-stick tower, a 100 ft deck). On the request thread that would hold the whole server
 * function (every page shares it), so the card is worked out on one worker thread per instance with a
 * wall-clock budget: past the budget, or while the worker is busy with another card, the default card goes out.
 */
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { cardFacts, type CardFacts } from "./card";

/** The longest a card may take; the linen closet, the pocket vanity and the 3 ft stick tower take well under it. */
export const CARD_BUDGET_MS = 6000;
/** Loading the engine into a new worker is not the card's time; it gets its own, looser bound. */
const LOAD_MS = 20000;
const MARK = "yardOgCard";
/** Run from source (the unit tests, under tsx): the worker needs the same TypeScript loader. The build is plain .mjs. */
const TS_SOURCE = import.meta.url.endsWith(".ts");

if (!isMainThread && (workerData as Record<string, unknown> | null)?.[MARK]) {
  // This module is loaded in the worker through the server chunk it was bundled into, so that chunk's own start-up
  // work runs here too; nothing of it may take the card worker down.
  process.on("unhandledRejection", () => {});
  parentPort!.on("message", (token: string) => {
    parentPort!.postMessage({ started: true });
    let facts: CardFacts | null = null;
    try { facts = cardFacts(token); } catch { facts = null; }
    parentPort!.postMessage({ facts });
  });
}

function spawn(): Worker {
  const w = start();
  // Always listening: an unheard 'error' on a Worker would throw in the request process and take every page down.
  const drop = () => { if (worker === w) worker = null; };
  w.on("error", drop);
  w.on("exit", drop);
  return w;
}

function start(): Worker {
  const opts = { workerData: { [MARK]: true }, resourceLimits: { maxOldGenerationSizeMb: 1024 } };
  if (!TS_SOURCE) return new Worker(new URL(import.meta.url), opts);
  // Under tsx the loader hooks don't reach a worker: register tsx's ESM API in it first, then load this file.
  const loader = process.execArgv.find((a) => /tsx\/dist\/loader\.mjs$/.test(a)) ?? "";
  const api = loader.replace(/loader\.mjs$/, "esm/api/index.mjs");
  const boot = `import(${JSON.stringify(api)}).then((m) => { m.register(); return import(${JSON.stringify(import.meta.url)}); });`;
  return new Worker(boot, { ...opts, eval: true });
}

export type Within = { facts: CardFacts | null; why: "ok" | "busy" | "slow" | "error" };
let worker: Worker | null = null;
let busy = false;

/** Runs in flight by token: the page's title and its /api/og card share one engine run. */
const running = new Map<string, Promise<Within>>();

/** The card's facts within `ms`, never on the request thread; one card at a time per instance. */
export function cardFactsWithin(token: string, ms = CARD_BUDGET_MS): Promise<Within> {
  const run = running.get(token);
  if (run) return run;
  if (busy) return Promise.resolve({ facts: null, why: "busy" });
  const p = startRun(token, ms);
  running.set(token, p);
  void p.then(() => running.delete(token));
  return p;
}

/** How long a /workspace page waits for its title: past this the plain title goes out (the run goes on for the card). */
export const TITLE_BUDGET_MS = 1500;
const titles = new Map<string, { name: string; size: string } | null>();
const TITLES_MAX = 256;

/** Row 578: the engine's name and size for a build token (the card's own), or null: not built, too slow, busy, no token. */
export async function engineTitleWithin(token: string, ms = TITLE_BUDGET_MS): Promise<{ name: string; size: string } | null> {
  if (!token) return null;
  if (titles.has(token)) return titles.get(token)!;
  const title = (r: Within) => r.facts && { name: r.facts.name, size: r.facts.size };
  const run = cardFactsWithin(token);
  // Worked out once per token, like the card (built, none or too slow), even after this page stopped waiting.
  void run.then((r) => {
    if (r.why === "busy") return;
    if (titles.size >= TITLES_MAX) titles.delete(titles.keys().next().value!);
    titles.set(token, title(r));
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((r) => { timer = setTimeout(() => r(null), ms); });
  const r = await Promise.race([run, late]);
  clearTimeout(timer);
  return r && title(r);
}

function startRun(token: string, ms: number): Promise<Within> {
  busy = true;
  const w = (worker ??= spawn());
  w.unref();
  return new Promise((resolve) => {
    const finish = (r: Within, kill: boolean) => {
      clearTimeout(timer); w.off("message", onMessage); w.off("error", onError); w.off("exit", onError);
      if (kill) { if (worker === w) worker = null; void w.terminate(); }
      busy = false; resolve(r);
    };
    const slow = () => finish({ facts: null, why: "slow" }, true);
    const onMessage = (m: { started?: boolean; facts?: CardFacts | null }) => {
      if (m.started) { clearTimeout(timer); timer = setTimeout(slow, ms); return; }
      finish({ facts: m.facts ?? null, why: "ok" }, false);
    };
    const onError = () => finish({ facts: null, why: "error" }, true);
    let timer = setTimeout(slow, LOAD_MS + ms);
    w.on("message", onMessage); w.on("error", onError); w.on("exit", onError);
    w.postMessage(token);
  });
}
