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

function injectIntoTemplate(template, result) {
  let out = template.replace('<div id="root"></div>', `<div id="root">${result.html}</div>`);
  if (result.helmet) {
    const headParts = [
      result.helmet.title?.toString() ?? '',
      result.helmet.meta?.toString() ?? '',
      result.helmet.link?.toString() ?? '',
      result.helmet.script?.toString() ?? '',
    ]
      .filter(Boolean)
      .join('\n    ');
    if (headParts.trim().length > 0) {
      out = out.replace('</head>', `    ${headParts}\n  </head>`);
    }
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
