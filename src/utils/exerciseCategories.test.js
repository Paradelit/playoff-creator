import { describe, it, expect } from 'vitest';
import {
  EXERCISE_CATEGORIES,
  matchCategory,
  categoryById,
  activeCategoryIds,
  toggleCategoryInTags,
} from './exerciseCategories';

describe('matchCategory', () => {
  it('resolves canonical labels case-insensitively', () => {
    expect(matchCategory('Tiro')).toBe('tiro');
    expect(matchCategory('TIRO')).toBe('tiro');
    expect(matchCategory('  tiro  ')).toBe('tiro');
  });

  it('resolves aliases in English and Spanish', () => {
    expect(matchCategory('shooting')).toBe('tiro');
    expect(matchCategory('defense')).toBe('defensa');
    expect(matchCategory('offensive')).toBe('ataque');
    expect(matchCategory('dribble')).toBe('bote');
  });

  it('returns null for unknown tags', () => {
    expect(matchCategory('no-existe')).toBeNull();
    expect(matchCategory('')).toBeNull();
    expect(matchCategory(null)).toBeNull();
    expect(matchCategory(undefined)).toBeNull();
  });
});

describe('categoryById', () => {
  it('returns the category object or null', () => {
    expect(categoryById('tiro')?.label).toBe('Tiro');
    expect(categoryById('fake')).toBeNull();
  });
});

describe('activeCategoryIds', () => {
  it('returns a Set of active category ids from a tag list', () => {
    const ids = activeCategoryIds(['Tiro', 'manejo', 'Personalizado']);
    expect(ids.has('tiro')).toBe(true);
    expect(ids.has('bote')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('handles empty or undefined input', () => {
    expect(activeCategoryIds([]).size).toBe(0);
    expect(activeCategoryIds(undefined).size).toBe(0);
  });
});

describe('toggleCategoryInTags', () => {
  it('adds the canonical label when not present', () => {
    const out = toggleCategoryInTags(['Personalizado'], 'tiro');
    expect(out).toEqual(['Personalizado', 'Tiro']);
  });

  it('removes every alias of the category when present', () => {
    const out = toggleCategoryInTags(['shooting', 'Personalizado'], 'tiro');
    expect(out).toEqual(['Personalizado']);
  });

  it('preserves unrelated tags verbatim', () => {
    const out = toggleCategoryInTags(['MiTag', 'otro'], 'defensa');
    expect(out).toContain('MiTag');
    expect(out).toContain('otro');
    expect(out).toContain('Defensa');
  });

  it('returns the input unchanged for unknown categories', () => {
    expect(toggleCategoryInTags(['Tiro'], 'fake')).toEqual(['Tiro']);
  });
});

describe('EXERCISE_CATEGORIES', () => {
  it('has no duplicate ids', () => {
    const ids = EXERCISE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every alias maps back to its category', () => {
    for (const cat of EXERCISE_CATEGORIES) {
      for (const alias of cat.aliases) {
        expect(matchCategory(alias)).toBe(cat.id);
      }
    }
  });
});
