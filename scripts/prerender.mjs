/**
 * prerender.mjs — runs after `vite build` + `vite build --ssr` to write static HTML
 * for each public route. See docs/superpowers/specs/2026-04-25-fase-1-web-publica-design.md.
 *
 * Inputs (produced by the preceding build steps):
 *   - dist/index.html             — client template (Vite's build output)
 *   - dist-ssr/entry-prerender.js — SSR bundle exporting render(url) and publicRoutes
 *
 * Outputs:
 *   - dist/index.html             — overwritten with prerendered landing
 *   - dist/ayuda/index.html       — help center index
 *   - dist/ayuda/<slug>/index.html for each HelpArticle
 *
 * Run with: node scripts/prerender.mjs
 *
 * Note: kept as `.mjs` (not `.ts`) so it can run with plain Node. Earlier attempts
 * using tsx tripped on react-helmet-async's named exports under tsx's ESM loader.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SSR_ENTRY = join(ROOT, 'dist-ssr', 'entry-prerender.js');

// Under React 19, react-helmet-async 3.x is a no-op Fragment (it expects React 19's native
// head deduplication, which only works in the streaming SSR APIs — not renderToString).
// So Helmet's <title>/<meta>/<link>/<script type="application/ld+json"> elements get rendered
// inline into the body output. We extract them here and move them into <head> so crawlers
// and social-card scrapers find them where they expect.
const HEAD_TAG_PATTERNS = [
  /<title\b[^>]*>[\s\S]*?<\/title>/g,
  /<meta\b[^>]*\/?>(?:<\/meta>)?/g,
  /<link\b[^>]*\/?>(?:<\/link>)?/g,
  /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
];

function extractHeadTags(html) {
  let body = html;
  const headTags = [];
  for (const pattern of HEAD_TAG_PATTERNS) {
    const matches = body.match(pattern);
    if (matches) headTags.push(...matches);
    body = body.replace(pattern, '');
  }
  // Strip the original <title>Pick&Coach</title> from the template so we don't end up with two.
  return { body, headTags };
}

function injectIntoTemplate(template, result) {
  const { body, headTags } = extractHeadTags(result.html);
  let out = template.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  if (headTags.length > 0) {
    // Drop the placeholder <title> in the template — Helmet's title supersedes it.
    out = out.replace(/\s*<title>[^<]*<\/title>/, '');
    out = out.replace('</head>', `    ${headTags.join('\n    ')}\n  </head>`);
  }
  return out;
}

function outputPathFor(route) {
  if (route === '/') return join(DIST, 'index.html');
  return join(DIST, route, 'index.html');
}

async function main() {
  console.log('\n🏀 Pick&Coach prerender\n');

  const template = readFileSync(join(DIST, 'index.html'), 'utf8');
  if (!template.includes('<div id="root"></div>')) {
    throw new Error(
      'dist/index.html is missing the <div id="root"></div> placeholder. ' +
        'It was likely overwritten by a previous prerender run. ' +
        "Run `npm run build:client` first to regenerate Vite's pristine template.",
    );
  }
  const ssr = await import(pathToFileURL(SSR_ENTRY).href);

  if (typeof ssr.render !== 'function' || !Array.isArray(ssr.publicRoutes)) {
    throw new Error(`SSR entry at ${SSR_ENTRY} must export render() and publicRoutes[]`);
  }

  let written = 0;
  for (const route of ssr.publicRoutes) {
    const result = ssr.render(route);
    const html = injectIntoTemplate(template, result);
    const outPath = outputPathFor(route);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`  ✓ ${route}  →  ${outPath.replace(ROOT, '.')}`);
    written++;
  }

  console.log(`\n✨ Wrote ${written} prerendered HTML files.\n`);
}

main().catch((err) => {
  console.error('Fatal error during prerender:', err);
  process.exit(1);
});
