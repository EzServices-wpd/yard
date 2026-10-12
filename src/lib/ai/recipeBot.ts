/**
 * Recipe bot (spec 001, persistence): a recipe that passed on the live site is proposed for the committed
 * store as a candidate, on one open bot PR that collects them. GitHub REST with a fine-grained token from
 * YARD_RECIPE_BOT_TOKEN (this repo only: contents + pull requests, read and write). No token: skip quietly.
 */
import { createServerFn } from "@tanstack/react-start";
import { parseRecipe, type Recipe, type RecipeStore } from "@/lib/yard/recipes";

const REPO = process.env.YARD_RECIPE_REPO ?? "EzServices-wpd/yard";
const BRANCH = "yard-recipe-bot";
const FILE = "src/lib/yard/recipes.json";
const COUNTS = "src/lib/yard/promptCounts.json";
/** Per server instance: at most this many proposals an hour, and each key once. */
const PER_HOUR = 10;
const sent = new Set<string>();
let window0 = 0;
let inWindow = 0;

/** The store with the recipe added as a version-1 candidate, or null when the key is already there. */
export function addCandidate(text: string, recipe: Recipe): string | null {
  const store = JSON.parse(text) as RecipeStore;
  if (store.recipes.some((r) => r.key === recipe.key)) return null;
  store.recipes.push({ ...recipe, version: 1, trust: "candidate" });
  return `${JSON.stringify(store, null, 1)}\n`;
}

/** The prompt-count file with one more request for this key (the Popular recently ranking). */
export function bumpCount(text: string, key: string): string {
  const file = JSON.parse(text) as { counts: Record<string, number> };
  file.counts[key] = (file.counts[key] ?? 0) + 1;
  return `${JSON.stringify(file, null, 1)}\n`;
}

/** Rate limit and de-duplication by key; true when this key may be proposed now. */
export function admit(key: string, now = Date.now()): boolean {
  if (sent.has(key)) return false;
  if (now - window0 > 3_600_000) { window0 = now; inWindow = 0; }
  if (inWindow >= PER_HOUR) return false;
  inWindow++;
  sent.add(key);
  return true;
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  return { ok: res.ok, status: res.status, json: res.ok || res.status === 422 ? await res.json().catch(() => null) : null };
}

export async function proposeRecipe(raw: unknown): Promise<{ ok: boolean; status: string; pr?: number }> {
  const token = process.env.YARD_RECIPE_BOT_TOKEN;
  if (!token) return { ok: true, status: "skipped: no token" };
  const recipe = parseRecipe(raw);
  if (!recipe) return { ok: false, status: "not a recipe" };
  if (!admit(recipe.key)) return { ok: true, status: "skipped: duplicate or rate limited" };
  const owner = REPO.split("/")[0];
  // The bot branch: reuse it while its PR is open, else start it from main.
  const open = await gh(token, `/pulls?state=open&head=${owner}:${BRANCH}`);
  let pr: number | undefined = (open.json as { number: number }[] | null)?.[0]?.number;
  if (!pr) {
    const main = await gh(token, `/git/ref/heads/main`);
    const sha = (main.json as { object?: { sha: string } } | null)?.object?.sha;
    if (!sha) return { ok: false, status: `main not readable (${main.status})` };
    const made = await gh(token, `/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
    if (!made.ok) {
      const moved = await gh(token, `/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha, force: true }) });
      if (!moved.ok) return { ok: false, status: `branch not writable (${made.status}/${moved.status})` };
    }
  }
  const file = await gh(token, `/contents/${FILE}?ref=${BRANCH}`);
  const f = file.json as { sha: string; content: string } | null;
  if (!f) return { ok: false, status: `store not readable (${file.status})` };
  const next = addCandidate(Buffer.from(f.content, "base64").toString("utf8"), recipe);
  if (next) {
    const put = await gh(token, `/contents/${FILE}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Recipe candidate: ${recipe.title} (${recipe.key})`, content: Buffer.from(next).toString("base64"), sha: f.sha, branch: BRANCH }),
    });
    if (!put.ok) return { ok: false, status: `commit failed (${put.status})` };
  }
  // Every proposal counts one request on the same PR, so Popular recently ranks without a paid store.
  const counts = await gh(token, `/contents/${COUNTS}?ref=${BRANCH}`);
  const c = counts.json as { sha: string; content: string } | null;
  if (c) await gh(token, `/contents/${COUNTS}`, { method: "PUT", body: JSON.stringify({ message: `Prompt count: ${recipe.key}`, content: Buffer.from(bumpCount(Buffer.from(c.content, "base64").toString("utf8"), recipe.key)).toString("base64"), sha: c.sha, branch: BRANCH }) });
  if (!next && !pr) return { ok: true, status: "skipped: already in the store" };
  if (!pr) {
    const made = await gh(token, `/pulls`, {
      method: "POST",
      body: JSON.stringify({ title: "Recipe candidates from the live site", head: BRANCH, base: "main", body: "Recipes that passed the build-and-validate checks on the live site, added as candidates. Run the gate before merging; Critic grades promote them to trusted." }),
    });
    pr = (made.json as { number?: number } | null)?.number;
    if (!pr) return { ok: false, status: `pull request not opened (${made.status})` };
  }
  return { ok: true, status: "proposed", pr };
}

export const proposeRecipeFn = createServerFn({ method: "POST" })
  .validator((input: { recipeJson: string }) => input)
  .handler(async ({ data }) => {
    // One log line per proposal (never the token), so the runtime logs say why a PR did or didn't open.
    try {
      const out = await proposeRecipe(JSON.parse(data.recipeJson));
      console.info(`[recipe-bot] ${out.status}${out.pr ? ` pr=${out.pr}` : ""}`);
      return out;
    } catch (e) {
      console.error(`[recipe-bot] error: ${(e as Error).message}`);
      return { ok: false, status: "error" };
    }
  });
