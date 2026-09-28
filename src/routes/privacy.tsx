import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Yard" },
      {
        name: "description",
        content: "How Yard uses cookies, analytics, and affiliate referral tracking.",
      },
      { property: "og:title", content: "Privacy · Yard" },
      { property: "og:url", content: `https://${host}/privacy` },
    ],
    links: [{ rel: "canonical", href: `https://${host}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteChrome active="privacy">
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">Privacy</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-ink-muted">Last updated 28 Sep 2026.</p>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-ink-muted">
          <section>
            <h2 className="font-display text-xl text-ink">What Yard is</h2>
            <p className="mt-2">
              Yard is a free web app at yard.wiki. You type a build, get a plan, and can follow shop
              links to buy the parts. You do not need an account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">What stays in your browser</h2>
            <p className="mt-2">
              Yard saves your current build and a short list of recent builds in your browser&apos;s
              local storage, so the bench is still there when you come back. That data stays on your
              device. Clearing site data removes it.
            </p>
            <p className="mt-2">
              Yard does not set advertising cookies. If you sign in (optional), a session token is kept
              in your browser for that tab so you stay signed in.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">What leaves your browser</h2>
            <p className="mt-2">
              Most of a plan — the model, cut list, and buy list — is worked out in your browser. When
              you ask for more detailed instructions or a rendered picture, the text of your build is
              sent to xAI (the Grok API) to write that text or image. Fonts load from Google Fonts,
              which sees your IP address like any web font request.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Analytics</h2>
            <p className="mt-2">
              Yard uses Plausible Analytics on production to count visits in aggregate — page views,
              referrers, and device class. Plausible does not use advertising cookies and does not
              track you across other sites. You can read their policy at{" "}
              <a
                href="https://plausible.io/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-rule underline-offset-4 hover:decoration-ink"
              >
                plausible.io/privacy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Affiliate partners</h2>
            <p className="mt-2">
              Some Buy links go through affiliate programs so Yard can earn a commission when you buy.
              Partners may include Amazon Associates, Impact (Home Depot, Walmart, and others), and CJ
              Affiliate. When those programs are active, clicking a shop link may set a cookie or
              similar identifier on the partner&apos;s domain so they can credit the referral. Yard
              does not control those cookies; the partner&apos;s own privacy policy applies once you
              leave yard.wiki.
            </p>
            <p className="mt-2">
              Affiliate cookies do not change the prices, quantities, or product titles shown on the
              Buy list, and you pay the retailer&apos;s normal price.
            </p>
            <p className="mt-2">
              Full wording lives on the{" "}
              <Link to="/about" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                About
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">What we do not sell</h2>
            <p className="mt-2">
              Yard does not sell your personal information. We do not run advertising networks on the
              site.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Changes</h2>
            <p className="mt-2">
              If this policy changes, the date at the top changes with it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Contact</h2>
            <p className="mt-2">
              Questions about this policy? Write to{" "}
              <a href="mailto:hello.yardwiki@gmail.com" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                hello.yardwiki@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </SiteChrome>
  );
}
