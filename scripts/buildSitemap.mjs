/**
 * buildSitemap.mjs — writes dist/sitemap.xml from HELP_ARTICLES metadata.
 *
 * Runs after the SSR bundle build (so it can re-use the helpArticles export
 * from dist-ssr/entry-prerender.js without needing a TS loader).
 *
 * Override the production origin via SITE_URL env var if needed; defaults to
 * the Firebase Hosting URL.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SSR_ENTRY = join(ROOT, 'dist-ssr', 'entry-prerender.js');

const SITE_URL = (process.env.SITE_URL || 'https://playoff-creator.web.app').replace(/\/$/, '');
const TODAY = new Date().toISOString().slice(0, 10);

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}

async function main() {
  const ssr = await import(pathToFileURL(SSR_ENTRY).href);
  if (!Array.isArray(ssr.helpArticles)) {
    throw new Error(`SSR entry at ${SSR_ENTRY} must export helpArticles[]`);
  }

  const entries = [
    { loc: '/', lastmod: TODAY, changefreq: 'weekly', priority: 1.0 },
    { loc: '/ayuda', lastmod: TODAY, changefreq: 'weekly', priority: 0.8 },
    // sub-proyecto 7 — funnel B2C/B2B. Alta prioridad para SEO comercial.
    { loc: '/precios', lastmod: TODAY, changefreq: 'monthly', priority: 0.9 },
    { loc: '/para-clubes', lastmod: TODAY, changefreq: 'monthly', priority: 0.9 },
    ...ssr.helpArticles.map((a) => ({
      loc: `/ayuda/${a.slug}`,
      lastmod: (a.updatedAt || TODAY).slice(0, 10),
      changefreq: 'monthly',
      priority: 0.6,
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    '</urlset>',
    '',
  ].join('\n');

  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
  console.log(`✓ Wrote dist/sitemap.xml (${entries.length} URLs, base ${SITE_URL})`);
}

main().catch((err) => {
  console.error('Fatal error during sitemap build:', err);
  process.exit(1);
});
