import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import PublicRoutesOnly from './shell/publicRoutes';
import { HELP_ARTICLES } from './content/helpArticles';

// Routes prerendered at build time. Exported so scripts/prerender.mjs can stay TS-free
// and load everything it needs from this single SSR bundle (no tsx dependency).
export const publicRoutes = ['/', '/ayuda', ...HELP_ARTICLES.map((a) => `/ayuda/${a.slug}`)];

// Article metadata used by scripts/buildSitemap.mjs. Re-exported from this bundle so
// the sitemap script can read TS content (HELP_ARTICLES) without needing a TS loader.
export const helpArticles = HELP_ARTICLES.map((a) => ({
  slug: a.slug,
  updatedAt: a.updatedAt,
}));

/**
 * SSR entry used by scripts/prerender.ts.
 *
 * Renders public routes (`/`, `/ayuda`, `/ayuda/:slug`) to static HTML for SEO
 * and social sharing. Deliberately excludes Firebase, Auth, Toast, Pick and the
 * SidebarProvider — public pages must work without any of them, and SSR cannot
 * initialize a real Firebase client anyway.
 *
 * The client still mounts the full CoachesApp via createRoot in src/main.jsx,
 * which replaces this prerendered markup on first paint. We are NOT using
 * hydrateRoot — the prerendered HTML is for crawlers/social cards; users get
 * the SPA on hydration.
 */
export function render(url) {
  const helmetContext = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <PublicRoutesOnly />
      </StaticRouter>
    </HelmetProvider>,
  );
  return { html, helmet: helmetContext.helmet || null };
}
