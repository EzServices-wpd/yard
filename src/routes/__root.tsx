import { useEffect } from "react";
import { NotFound } from "@/components/site/not-found";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Yard";
/** Production domain. Env override still wins if set on Vercel. */
const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";
const ogImage = `https://${host}/og.jpg`;
const xBanner = `https://og.grok.me/v1/banner.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent(APP_NAME)}`;


/** Google Fonts load after first paint with display=optional: text paints in the metric-matched fallback and never swaps late (a late swap was the occasional 0.11 CLS). */
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=optional";
function LateFonts() {
  useEffect(() => {
    if (document.querySelector(`link[rel="stylesheet"][href="${FONTS_CSS}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONTS_CSS;
    document.head.appendChild(l);
  }, []);
  return null;
}

/** Vercel Web Analytics (free tier): Vercel's own script, served from this site's /_vercel path. No cookies. */
function VercelAnalytics() {
  useEffect(() => {
    if (!/yard\.wiki$/.test(location.hostname) || document.querySelector("script[data-yard-va]")) return;
    const s = document.createElement("script");
    s.defer = true;
    s.dataset.yardVa = "1";
    s.src = "/_vercel/insights/script.js";
    document.head.appendChild(s);
  }, []);
  return null;
}

export const Route = createRootRoute({
  // Only the root matched: the 404 page, which gets its own single title and description.
  head: ({ matches }) => (matches.length === 1 ? {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "strict-origin" },
      { title: "Page not found · Yard" },
      { name: "description", content: "That page isn't here. Type what you want to build, or browse Ideas." },
      { property: "og:title", content: "Page not found · Yard" },
      { name: "twitter:title", content: "Page not found · Yard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }, { rel: "icon", href: "/favicon.ico", sizes: "any" }, { rel: "stylesheet", href: appCss }],
  } : {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "strict-origin" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Think it up. Yard works it out. One model. Every cut, part and step.",
      },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "fo-verify", content: "f9285177-d9e6-455d-926e-ec1f01732cec" },
      { name: "theme-color", content: "#12100e" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: APP_NAME },
      { name: "twitter:description", content: "Think it up. Yard works it out. One model. Every cut, part and step." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: "Think it up. Yard works it out. One model. Every cut, part and step.",
      },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: `https://${host}/` },
      { property: "x:game:image", content: xBanner },
      { property: "x:game:image:width", content: "1200" },
      { property: "x:game:image:height", content: "264" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", as: "style", href: FONTS_CSS },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "canonical", href: `https://${host}/` },
    ],
  }),
  notFoundComponent: NotFound,
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
        <VercelAnalytics />
        <LateFonts />
      </body>
    </html>
  ),
});
