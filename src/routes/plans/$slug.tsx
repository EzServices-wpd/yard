import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";
import { planBySlug, TAGLINE } from "@/lib/yard/plans";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/plans/$slug")({
  // Same HTML for every visitor: the CDN serves it for an hour and refreshes in the background.
  headers: () => ({ "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" }),
  loader: async ({ params }) => {
    const page = planBySlug(params.slug);
    if (!page) throw notFound();
    const { planPageData } = await import("@/lib/yard/planPageData");
    return { page, data: planPageData(page.prompt) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { page, data } = loaderData;
    const url = `https://${host}/plans/${page.slug}`;
    const title = `${page.name} plan, ${data.overall.width}×${data.overall.height} · Yard`;
    const desc = `${page.blurb} Free plan: 3D model, ${data.pieces} cut pieces, Buy list and steps. ${TAGLINE}`;
    const howTo = { "@context": "https://schema.org", "@type": "HowTo", name: `How to build a ${page.name.toLowerCase()}`, description: page.blurb, step: data.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.text })) };
    const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
    return {
      meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:url", content: url }, { name: "twitter:title", content: title }, { name: "twitter:description", content: desc }],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(howTo) }, { type: "application/ld+json", children: JSON.stringify(faq) }],
    };
  },
  component: PlanRoute,
});

function PlanRoute() {
  const { page, data } = Route.useLoaderData();
  const o = data.overall;
  return (
    <SiteChrome active="ideas">
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">Free plan</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">{page.name}</h1>
        <p className="mt-2 font-mono text-sm text-ink">{o.width}″ W × {o.height}″ H × {o.depth}″ D · {data.pieces} cut pieces · Buy list ~${data.buyUsd.toLocaleString("en-US")}</p>
        <p className="mt-3 text-base text-ink-muted">{page.blurb}</p>
        <p className="mt-1 text-sm italic text-ink-muted">{TAGLINE}</p>
        <div role="img" aria-label={`Yard model of the ${page.name.toLowerCase()}`} className="mt-6 aspect-[4/3] w-full overflow-hidden rounded-xl border border-rule bg-paper" dangerouslySetInnerHTML={{ __html: data.svg }} />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/workspace" search={{ q: page.prompt }} className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Open the 3D model</Link>
          <Link to="/" search={{ q: `${page.name.toLowerCase()} ${o.width} wide ${o.height} tall ${o.depth} deep` }} className="rounded-full border border-rule px-4 py-2 text-sm text-ink">Make it your size</Link>
        </div>
        <h2 className="mt-10 font-display text-2xl text-ink">Cut list</h2>
        <ul className="mt-3 space-y-1 font-mono text-sm text-ink">
          {data.cuts.map((c, i) => <li key={i}>{c.n} × {c.name} · {c.size} · {c.material}</li>)}
        </ul>
        <h2 className="mt-10 font-display text-2xl text-ink">Questions</h2>
        <dl className="mt-3 space-y-4">
          {page.faqs.map(([q, a]) => <div key={q}><dt className="font-medium text-ink">{q}</dt><dd className="mt-1 text-ink-muted">{a}</dd></div>)}
        </dl>
      </main>
    </SiteChrome>
  );
}
