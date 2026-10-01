import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SiteChrome } from "@/components/site/chrome";
import { IDEAS, IDEA_SECTIONS, type Idea } from "@/lib/yard/ideas";
import { IDEAS_CHANGED, ideaSearchScore, listLearnedIdeas, type LearnedIdea } from "@/lib/yard/ideaLibrary";

type Row = Idea & { kept?: boolean };

export const Route = createFileRoute("/ideas")({
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
    () => [...learned.map((d) => ({ ...d, kept: true as const })), ...IDEAS],
    [learned],
  );

  const visible = useMemo(() => {
    if (!q) return rows;
    return rows
      .map((d, index) => ({ d, index, score: ideaSearchScore(d, q) }))
      .filter((hit) => hit.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((hit) => hit.d);
  }, [q, rows]);

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
            {visible.length === 0 ? "Nothing matches." : visible.length === 1 ? "1 idea. Enter builds it." : `${visible.length} ideas. Enter builds the first.`}
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
      </main>
    </SiteChrome>
  );
}

function IdeaCard({ idea, onOpen }: { idea: Row; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-xl border border-rule bg-paper p-4 text-left transition-[border-color,background-color] duration-150 hover:border-ink/35 hover:bg-surface/40"
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