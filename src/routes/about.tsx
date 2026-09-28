import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · Yard" },
      {
        name: "description",
        content: "Yard turns what you want to build into a cut list, buy list, and shop-ready plan. Free to use.",
      },
      { property: "og:title", content: "About · Yard" },
      { property: "og:url", content: `https://${host}/about` },
    ],
    links: [{ rel: "canonical", href: `https://${host}/about` }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteChrome active="about">
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">About</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          Type what you want. Get a plan you can build.
        </h1>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-ink-muted sm:text-lg">
          <p>
            Yard is a free shop tool. You type something you want to build — a vanity that fits a bathroom
            pocket, a linen closet for a measured alcove, a popsicle Eiffel for the weekend — and Yard
            returns a 3D model on the bench, a cut list, a buy list with retail links, and step-by-step
            instructions.
          </p>
          <p>
            The size you typed is the size you get. Geometry is deterministic. Assembly voice can be
            polished by an assistant, but it does not invent a different closet.
          </p>
          <p>
            Who it is for: people who already know how to cut and fasten, and just want an honest
            shopping list and a picture. House builds (plywood, lumber, windows) and weekend crafts
            (popsicle sticks, PVC, straws) share the same bench.
          </p>
          <p>
            Yard is free. There is no paywall and no subscription. When you buy through a shop link,
            Yard may earn a commission from that purchase. That is how the site stays free.
          </p>
        </div>

        <section className="mt-12 rounded-xl border border-rule bg-rule/25 p-5">
          <h2 className="font-display text-xl text-ink">Affiliate disclosure</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Yard may earn a commission from qualifying purchases. As an Amazon Associate, Yard earns
            from qualifying purchases. We may also earn from Home Depot, Walmart, and other retailers
            through Impact, CJ, or similar partner programs when those links are live. A commission
            never changes the price, quantity, or product shown on the Buy list — you pay the
            retailer&apos;s normal price.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            See the{" "}
            <Link to="/privacy" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
              Privacy Policy
            </Link>{" "}
            for how cookies and referral tracking work.
          </p>
        </section>

        <p className="mt-10 text-sm text-ink-muted">
          Look at the{" "}
          <Link to="/gallery" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            gallery
          </Link>{" "}
          for plans that already walk on the bench, or{" "}
          <Link to="/workspace" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            open the bench
          </Link>{" "}
          and type your own.
        </p>
      </main>
    </SiteChrome>
  );
}
