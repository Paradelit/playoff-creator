/**
 * Site URL constants used by SEO-relevant screens (Landing, Help index, Help article)
 * and the sitemap generator. Centralized here so a domain change is a one-line edit.
 *
 * If we later set up a custom domain (e.g. pickandcoach.com), update SITE_URL and
 * also pass `SITE_URL=https://pickandcoach.com npm run build:sitemap` for the sitemap
 * (or just rely on the default below — both code and sitemap script read the same value).
 */
export const SITE_URL = 'https://playoff-creator.web.app';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
