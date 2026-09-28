import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteChrome } from "@/components/site/chrome";
import { GALLERY } from "@/lib/yard/gallery";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/gallery/")({
  head: () => ({
    meta: [
      { title: "Gallery · Yard" },
      {
        name: "description",
        content: "Example plans on Yard — pocket vanity, linen closet, nightstand, L desk, weekend crafts, and more.",
      },
      { property: "og:title", content: "Gallery · Yard" },
      { property: "og:url", content: `https://${host}/gallery` },
    ],
    links: [{ rel: "canonical", href: `https://${host}/gallery` }],
  }),
  component: GalleryIndex,
});

function GalleryIndex() {
  const house = GALLERY.filter((g) => g.group === "house");
  const weekend = GALLERY.filter((g) => g.group === "weekend");
  return (
    <SiteChrome active="gallery">
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">Gallery</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          Plans that already walk on the bench.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Each card is a real Yard build — same prompts the site checks every day. Open one for the
          write-up, or send it straight to the bench.
        </p>

        <Section title="For the house" rows={house} />
        <Section title="For the weekend" rows={weekend} className="mt-16" />
      </main>
    </SiteChrome>
  );
}

function Section({
  title,
  rows,
  className,
}: {
  title: string;
  rows: typeof GALLERY;
  className?: string;
}) {
  return (
    <section className={className ?? "mt-12"}>
      <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <Link
            key={g.slug}
            to="/gallery/$slug"
            params={{ slug: g.slug }}
            className="group flex flex-col rounded-xl border border-rule bg-paper p-4 text-left transition-[border-color,background-color] duration-150 hover:border-ink/35 hover:bg-rule/25"
          >
            <span className="font-display text-lg text-ink group-hover:underline">{g.label}</span>
            <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{g.size}</span>
            <span className="mt-2 text-sm leading-snug text-ink-muted">{g.blurb}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted group-hover:text-ink">
              Open plan
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
