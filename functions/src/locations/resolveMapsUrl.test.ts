import { describe, it, expect } from 'vitest';
import { isMapsShortUrl, extractPlaceFromMapsUrl } from './resolveMapsUrl';

describe('isMapsShortUrl', () => {
  it('accepts maps.app.goo.gl', () => {
    expect(isMapsShortUrl('https://maps.app.goo.gl/abc123')).toBe(true);
  });
  it('accepts goo.gl/maps', () => {
    expect(isMapsShortUrl('https://goo.gl/maps/abc')).toBe(true);
  });
  it('rejects non-maps URL', () => {
    expect(isMapsShortUrl('https://example.com')).toBe(false);
  });
  it('rejects empty', () => {
    expect(isMapsShortUrl('')).toBe(false);
  });
});

describe('extractPlaceFromMapsUrl', () => {
  it('extracts place name from /maps/place/<name>/...', () => {
    const url = 'https://www.google.com/maps/place/Pabell%C3%B3n+Ramiro+de+Maeztu/@40.4,-3.7';
    expect(extractPlaceFromMapsUrl(url)).toBe('Pabellón Ramiro de Maeztu');
  });
  it('returns null when no place segment', () => {
    expect(extractPlaceFromMapsUrl('https://www.google.com/maps')).toBe(null);
  });
  it('returns null for invalid URL', () => {
    expect(extractPlaceFromMapsUrl('not a url')).toBe(null);
  });
});
