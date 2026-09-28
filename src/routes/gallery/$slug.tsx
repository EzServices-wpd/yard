import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteChrome } from "@/components/site/chrome";
import { useMemo } from "react";
import { GALLERY, galleryBySlug } from "@/lib/yard/gallery";
import { generateFromPrompt } from "@/lib/yard/prompt";
import { buildPlan } from "@/lib/yard/report";
import { planOverviewSvg } from "@/lib/yard/planStepPicture";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/gallery/$slug")({
  loader: ({ params }) => {
    const plan = galleryBySlug(params.slug);
    if (!plan) throw notFound();
    return plan;
  },
  head: ({ loaderData }) => {
    const plan = loaderData;
    if (!plan) return {};
    return {
      meta: [
        { title: `${plan.label} · Yard` },
        { name: "description", content: `${plan.blurb} ${plan.size}. Open on the Yard bench.` },
        { property: "og:title", content: `${plan.label} · Yard` },
        { property: "og:description", content: plan.blurb },
        { property: "og:url", content: `https://${host}/gallery/${plan.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://${host}/gallery/${plan.slug}` }],
    };
  },
  component: GalleryPlanPage,
});

function GalleryPlanPage() {
  const plan = Route.useLoaderData();
  const others = GALLERY.filter((g) => g.slug !== plan.slug).slice(0, 6);
  // Same deterministic engine as the bench: the picture and step titles are the real plan.
  const built = useMemo(() => {
    try {
      const project = generateFromPrompt(plan.prompt);
      const bp = buildPlan(project);
      return {
        svg: planOverviewSvg(project, 480, 300).svg,
        parts: bp.cutList.reduce((a, c) => a + c.quantity, 0),
        steps: bp.instructions.map((s) => s.title),
        whole: bp.partsKind === "whole",
      };
    } catch {
      return null;
    }
  }, [plan.prompt]);
  return (
    <SiteChrome active="gallery">
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
          <Link to="/gallery" className="hover:text-ink">
            Gallery
          </Link>
          <span className="mx-2 text-rule">/</span>
          {plan.group === "weekend" ? "Weekend" : "House"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          {plan.label}
        </h1>
        <p className="mt-2 font-mono text-sm tracking-tight text-ink">{plan.size}</p>
        <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg">{plan.blurb}</p>
        {built && (
          <figure className="mt-8">
            <span
              className="block aspect-[16/10] w-full overflow-hidden rounded-xl border border-rule bg-paper [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label={`${plan.label} — finished piece`}
              dangerouslySetInnerHTML={{ __html: built.svg }}
            />
            <figcaption className="mt-2 text-xs text-ink-muted">
              Finished piece, drawn from the model · {built.parts} {built.whole ? "pieces" : "cut parts"} ·{" "}
              {built.steps.length} steps
            </figcaption>
          </figure>
        )}
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          This is a real Yard plan — cut list, buy list, and steps from the same model the bench
          shows. Open it to edit the size, swap stock, or print the plan.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/workspace"
            search={{ q: plan.prompt }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Open on the bench
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/gallery"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-rule px-5 text-sm text-ink transition-colors duration-150 hover:border-ink/40"
          >
            All plans
          </Link>
        </div>

        {built && built.steps.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">The steps</h2>
            <ol className="mt-3 space-y-1.5 text-sm text-ink">
              {built.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 shrink-0 font-mono text-xs leading-5 text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="mt-6 rounded-md border border-rule/80 bg-rule/25 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-muted">
          Prompt · {plan.prompt}
        </p>

        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">More plans</h2>
            <ul className="mt-3 space-y-2">
              {others.map((g) => (
                <li key={g.slug}>
                  <Link
                    to="/gallery/$slug"
                    params={{ slug: g.slug }}
                    className="text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                  >
                    {g.label}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-ink-muted">{g.size}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </SiteChrome>
  );
}
