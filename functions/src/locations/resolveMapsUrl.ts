import { onCall, HttpsError } from 'firebase-functions/v2/https';

export function isMapsShortUrl(s: string): boolean {
  if (typeof s !== 'string' || !s) return false;
  try {
    const u = new URL(s);
    if (u.host === 'maps.app.goo.gl') return true;
    if (u.host === 'goo.gl' && u.pathname.startsWith('/maps/')) return true;
    return false;
  } catch {
    return false;
  }
}

export function extractPlaceFromMapsUrl(longUrl: string): string | null {
  if (typeof longUrl !== 'string') return null;
  try {
    const u = new URL(longUrl);
    const m = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/\+/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

const cache = new Map<string, { result: ResolveResult; expiresAt: number }>();
const TTL_MS = 24 * 3600 * 1000;

interface ResolveResult {
  resolvedUrl: string;
  placeName: string | null;
}

async function followRedirect(shortUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(shortUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return res.url;
  } finally {
    clearTimeout(timeout);
  }
}

export const resolveMapsUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido.');
  const data = request.data as { shortUrl?: unknown };
  const shortUrl = typeof data.shortUrl === 'string' ? data.shortUrl : '';
  if (!isMapsShortUrl(shortUrl)) {
    throw new HttpsError('invalid-argument', 'URL no es un shortlink de Google Maps.');
  }

  const cached = cache.get(shortUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let resolvedUrl: string;
  try {
    resolvedUrl = await followRedirect(shortUrl);
  } catch {
    throw new HttpsError('deadline-exceeded', 'No se pudo resolver la URL en 5 segundos.');
  }

  const result: ResolveResult = {
    resolvedUrl,
    placeName: extractPlaceFromMapsUrl(resolvedUrl),
  };
  cache.set(shortUrl, { result, expiresAt: Date.now() + TTL_MS });
  return result;
});
