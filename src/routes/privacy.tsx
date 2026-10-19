import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Yard" },
      {
        name: "description",
        content: "How Yard uses cookies, analytics, affiliate links, and the prompts and feedback you send.",
      },
      { property: "og:description", content: "How Yard uses cookies, analytics, affiliate links, and the prompts and feedback you send." },
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
        <p className="mt-4 text-sm text-ink-muted">Last updated 20 Oct 2026.</p>

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
            <h2 className="font-display text-xl text-ink">Prompts and feedback we keep</h2>
            <p className="mt-2">
              When you ask Yard for a build, the server saves the text you typed so we can see which
              builds people want and where Yard gets them wrong. Before anything is saved, it strips out
              things that look like personal details, such as email addresses and phone numbers. The
              saved prompt isn&apos;t tied to an account, a name or anything else that identifies you.
            </p>
            <p className="mt-2">
              Each build also has a &quot;Something&apos;s off? Tell the shop&quot; box. If you use it,
              Yard saves the reason you picked and your note (140 characters at most), plus that
              build&apos;s request, size, part count and the version of Yard that made it. The same
              personal-detail scrub runs first, and the feedback isn&apos;t linked to you either. To
              prevent spam, a random id kept in your browser limits feedback to 10 sends a day. That
              count is deleted after a day and is never saved with your feedback, and there&apos;s also
              an overall daily cap across everyone. Yard doesn&apos;t read your IP address or browser
              details, and no IP address, name or email is stored with saved prompts or feedback.
            </p>
            <p className="mt-2">
              We use saved prompts and feedback only to make builds better. We don&apos;t sell them,
              share them with advertisers or use them for marketing. They&apos;re stored with our
              database provider, Upstash.
            </p>
            <p className="mt-2">
              We delete saved prompts and feedback notes after 90 days. Before then, a build that&apos;s
              popular or rated highly may be saved as an anonymous recipe in Yard&apos;s Ideas library.
              A recipe holds only the shape, sizes and parts, never the words you typed or anything
              about your browser. Recipes stay in the library until we retire them.
            </p>
            <p className="mt-2">Please don&apos;t put personal information in your prompt or note.</p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Analytics</h2>
            <p className="mt-2">
              Yard uses Vercel Web Analytics to count visits in aggregate: page views, referrers,
              country and device class. It sets no cookies and does not track you across other sites.
              AI lookups are limited to a fair number per visitor each day. To apply that limit, Yard
              keeps a short-lived counter tied to your IP address. It&apos;s deleted after 24 hours and
              never stored with your prompts or feedback. Like most websites, our host, Vercel, may keep
              IP addresses in its own server logs. Vercel&apos;s policy is at{" "}
              <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                vercel.com/docs/analytics/privacy-policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Affiliate partners</h2>
            <p className="mt-2">
              Some Buy links go through affiliate programs so Yard can earn a commission when you buy.
              Partners include Amazon Associates and CJ Affiliate. When those programs are active, clicking a shop link may set a cookie or
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
              Yard does not sell your personal information. Saved prompts and build feedback are never
              sold. We do not run advertising networks on the site.
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
              <a href="mailto:hello@yard.wiki" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                hello@yard.wiki
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </SiteChrome>
  );
}
