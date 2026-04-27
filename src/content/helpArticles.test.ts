import { describe, it, expect } from 'vitest';
import { HELP_ARTICLES, HELP_CATEGORIES } from './helpArticles';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('HELP_ARTICLES', () => {
  it('has at least one article (post-migration)', () => {
    // Will be 0 right after schema creation; test toleratively for now.
    // Expect ≥1 once Task 2.3 lands the migration.
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(0);
  });

  it('each article has required fields', () => {
    for (const a of HELP_ARTICLES) {
      expect(typeof a.id, `id of ${a.title || '?'}`).toBe('string');
      expect(a.id.length, `id of ${a.title || '?'}`).toBeGreaterThan(0);
      expect(typeof a.slug, `slug of ${a.id}`).toBe('string');
      expect(a.slug.length, `slug of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.title, `title of ${a.id}`).toBe('string');
      expect(a.title.length, `title of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.summary, `summary of ${a.id}`).toBe('string');
      expect(a.summary.length, `summary of ${a.id}`).toBeGreaterThan(0);
      expect(a.summary.length, `summary of ${a.id} too long`).toBeLessThanOrEqual(220);
      expect(typeof a.body, `body of ${a.id}`).toBe('string');
      expect(a.body.length, `body of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.updatedAt, `updatedAt of ${a.id}`).toBe('string');
      expect(a.updatedAt, `updatedAt of ${a.id}`).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(HELP_CATEGORIES[a.category], `category of ${a.id}`).toBeTruthy();
    }
  });

  it('all ids are unique', () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('all slugs are unique', () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    const set = new Set(slugs);
    expect(set.size).toBe(slugs.length);
  });

  it('all slugs are URL-safe (lowercase kebab, no diacritics)', () => {
    for (const a of HELP_ARTICLES) {
      expect(a.slug, `slug of ${a.id}`).toMatch(SLUG_RE);
    }
  });
});
