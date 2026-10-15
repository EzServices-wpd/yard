import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SiteChrome } from "@/components/site/chrome";
import { CURATED_IDEAS, IDEAS, IDEA_SECTIONS, type Idea } from "@/lib/yard/ideas";
import { isoFaces, newIdeas, popularIdeas, type RecipeIdea } from "@/lib/yard/recipeIdeas";
import { LogCard } from "@/components/ideas/LogCards";
import { EMPTY_SNAPSHOT, searchLog, trustedPopular, type IdeasSnapshot } from "@/lib/yard/ideaLog";
import { loadSnapshot } from "@/lib/yard/ideaLogClient";
import { IDEAS_CHANGED, ideaSearchScore, listLearnedIdeas, type LearnedIdea } from "@/lib/yard/ideaLibrary";

type Row = Idea & { kept?: boolean };

export const Route = createFileRoute("/ideas")({
  // Same HTML for every visitor: the CDN serves it for an hour and refreshes in the background.
  headers: () => ({ "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" }),
  head: () => ({
    meta: [
      { title: "Ideas · Yard" },
      { name: "description", content: "Build ideas for Yard: shelves, benches, toys and weekend projects, each with a model, cut list and Buy list." },
      { property: "og:title", content: "Ideas · Yard" },
      { property: "og:description", content: "Build ideas for Yard: shelves, benches, toys and weekend projects, each with a model, cut list and Buy list." },
      { property: "og:url", content: "https://yard.wiki/ideas" },
    ],
    links: [{ rel: "canonical", href: "https://yard.wiki/ideas" }],
  }),
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === "string" && s.q.trim() ? { q: s.q.slice(0, 80) } : {},
  component: IdeasPage,
});

function IdeasPage() {
  const navigate = useNavigate();
  const incoming = Route.useSearch().q ?? "";
  const [query, setQuery] = useState(incoming);
  const [learned, setLearned] = useState<LearnedIdea[]>([]);
  const q = query.trim();

  useEffect(() => {
    setQuery(incoming);
  }, [incoming]);

  useEffect(() => {
    const load = () => setLearned(listLearnedIdeas());
    load();
    window.addEventListener("storage", load);
    window.addEventListener(IDEAS_CHANGED, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(IDEAS_CHANGED, load);
    };
  }, []);

  const rows = useMemo<Row[]>(
    () => [...learned.map((d) => ({ ...d, kept: true as const })), ...(q ? IDEAS : CURATED_IDEAS)],
    [learned, q],
  );

  const visible = useMemo(() => {
    if (!q) return rows;
    return rows
      .map((d, index) => ({ d, index, score: ideaSearchScore(d, q) }))
      .filter((hit) => hit.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((hit) => hit.d);
  }, [q, rows]);

  const recipes = useMemo(() => popularIdeas(), []);
  // Endless Ideas (004): the CDN snapshot of the log; one search over it, Popular from Trusted only.
  const [snap, setSnap] = useState<IdeasSnapshot>(EMPTY_SNAPSHOT);
  useEffect(() => {
    let live = true;
    void loadSnapshot().then((s) => live && setSnap(s));
    return () => { live = false; };
  }, []);
  const logHits = useMemo(() => (q ? searchLog(snap.rows, q).slice(0, 30) : []), [q, snap]);
  const logPopular = useMemo(() => trustedPopular(snap.popular), [snap]);
  const fresh = useMemo(() => newIdeas(), []);

  function go(text: string) {
    const next = text.trim();
    if (!next) return;
    void navigate({ to: "/workspace", search: { q: next } });
  }

  return (
    <SiteChrome active="ideas">
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-14">
        <h1 className="max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          Ideas
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
          Tap one and the bench fills. A printed plan joins only when it is what you asked for, it is sound, and it is new.
        </p>
        <form
          className="mt-6 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            const top = visible[0];
            if (q && top) go(top.prompt);
          }}
        >
          <label className="block">
            <span className="sr-only">Search ideas</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="desk, closet, PVC…"
              autoComplete="off"
              className="h-12 w-full rounded-lg border border-rule bg-paper px-4 text-base text-ink outline-none ring-ink/20 placeholder:text-ink-muted transition-[box-shadow,border-color] duration-150 focus:border-ink/30 focus:ring-2"
            />
          </label>
        </form>
        {q ? (
          <p className="mt-3 text-xs text-ink-muted">
            {visible.length === 0 ? (logHits.length ? `${logHits.length} from what people built.` : "Nothing matches.") : visible.length === 1 ? "1 idea. Enter builds it." : `${visible.length} ideas. Enter builds the first.`}
          </p>
        ) : learned.length > 0 ? (
          <p className="mt-3 text-xs text-ink-muted">
            {learned.length === 1 ? "1 from a printed plan, filed below." : `${learned.length} from printed plans, filed below.`}
          </p>
        ) : null}

        {q ? (
          visible.length > 0 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((d) => (
                <IdeaCard key={d.id} idea={d} onOpen={() => go(d.prompt)} />
              ))}
            </div>
          ) : null
        ) : (
          IDEA_SECTIONS.map((section) => {
            const sectionRows = visible.filter((d) => d.section === section);
            if (!sectionRows.length) return null;
            return (
              <section key={section} className="mt-12">
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{section}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionRows.map((d) => (
                    <IdeaCard key={d.id} idea={d} onOpen={() => go(d.prompt)} />
                  ))}
                </div>
              </section>
            );
          })
        )}
        {q && logHits.length > 0 ? (
          <section className="mt-12" data-yard-log-search>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">What people built</h2>
            <p className="mt-1 text-sm text-ink-muted">Trusted builds passed review. Unverified ones did not yet: check every part before you cut.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {logHits.map((r) => (
                <LogCard key={r.key} row={r} onOpen={() => go(r.prompt)} />
              ))}
            </div>
          </section>
        ) : null}
        {!q && logPopular.length > 0 ? (
          <section className="mt-12" data-yard-log-popular>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Popular with visitors (Trusted)</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {logPopular.map((r) => (
                <LogCard key={r.key} row={r} onOpen={() => go(r.prompt)} />
              ))}
            </div>
          </section>
        ) : null}
        {!q && fresh.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">New (Unverified)</h2>
            <p className="mt-1 text-sm text-ink-muted">Learned from visitors and passed Yard's checks, not reviewed yet. Check every part before you cut.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fresh.map((r) => (
                <RecipeCard key={r.id} idea={r} onOpen={() => go(r.prompt)} />
              ))}
            </div>
          </section>
        ) : null}
        {!q && recipes.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Popular recently</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((r) => (
                <RecipeCard key={r.id} idea={r} onOpen={() => go(r.prompt)} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </SiteChrome>
  );
}

function IdeaCard({ idea, onOpen }: { idea: Row; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="yard-paper group flex flex-col rounded-xl border border-rule bg-paper p-4 text-left hover:border-ink/35"
    >
      {idea.stock ? (
        <span className="font-display text-sm italic leading-none text-ink-muted">{idea.stock}</span>
      ) : idea.kept ? (
        <span className="font-display text-sm italic leading-none text-ink-muted">From a printed plan</span>
      ) : null}
      <span className={`font-display text-lg text-ink group-hover:underline ${idea.stock || idea.kept ? "mt-2" : ""}`}>
        {idea.label}
      </span>
      <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{idea.size}</span>
      <span className="mt-2 flex-1 text-sm leading-snug text-ink-muted">{idea.blurb}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted group-hover:text-ink">
        Build
        <ArrowRight className="size-3.5" />
      </span>
    </button>
  );
}
/** A recipe card: the thumbnail is Yard's own model of the recipe, drawn in isometric. */
function RecipeCard({ idea, onOpen }: { idea: RecipeIdea; onOpen: () => void }) {
  const faces = useMemo(() => isoFaces(idea.panels, idea.box), [idea]);
  const fill = ["#efe6d2", "#d9c7a3", "#c2ab80"];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-xl border border-rule bg-paper p-4 text-left transition-[border-color,background-color] duration-150 hover:border-ink/35 hover:bg-surface/40"
    >
      <svg viewBox="-4 -4 108 108" className="h-28 w-full" role="img" aria-label={`${idea.label} model`}>
        {faces.map((f, i) => (
          <path key={i} d={f.d} fill={fill[f.shade]} stroke="#6b5a3e" strokeWidth={0.3} strokeLinejoin="round" />
        ))}
      </svg>
      <span className="mt-2 font-display text-lg text-ink group-hover:underline">{idea.label}</span>
      <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{idea.size}</span>
      <span className="mt-2 flex-1 text-sm leading-snug text-ink-muted">{idea.blurb}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted group-hover:text-ink">
        Build
        <ArrowRight className="size-3.5" />
      </span>
    </button>
  );
}
