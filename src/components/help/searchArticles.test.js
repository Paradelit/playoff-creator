import { describe, it, expect } from 'vitest';
import { searchArticles } from './searchArticles';

const ARTICLES = [
  {
    id: 'a1',
    slug: 'a1',
    title: 'Cómo crear un equipo',
    summary: 'Crea tu primer equipo.',
    tags: ['equipos', 'crear'],
  },
  {
    id: 'a2',
    slug: 'a2',
    title: 'Generar entrenamiento con IA',
    summary: 'Pídele un entrenamiento al copiloto.',
    tags: ['ia', 'entrenamiento'],
  },
  { id: 'a3', slug: 'a3', title: 'Importar calendario', summary: 'Sube tu Excel.', tags: ['calendario', 'importar'] },
];

describe('searchArticles', () => {
  it('returns empty for empty query', () => {
    expect(searchArticles('', ARTICLES)).toEqual([]);
  });

  it('matches by title', () => {
    const r = searchArticles('equipo', ARTICLES);
    expect(r[0].id).toBe('a1');
  });

  it('matches by summary', () => {
    const r = searchArticles('excel', ARTICLES);
    expect(r[0].id).toBe('a3');
  });

  it('matches by tag', () => {
    const r = searchArticles('importar', ARTICLES);
    expect(r[0].id).toBe('a3');
  });

  it('is case- and accent-insensitive', () => {
    const r = searchArticles('CÓMO', ARTICLES);
    expect(r[0].id).toBe('a1');
    const r2 = searchArticles('como', ARTICLES);
    expect(r2[0].id).toBe('a1');
  });

  it('ranks title matches above summary matches', () => {
    const articles = [
      { id: 'a', slug: 'a', title: 'Foo', summary: 'Mentions equipo here', tags: [] },
      { id: 'b', slug: 'b', title: 'Equipo guide', summary: 'Foo', tags: [] },
    ];
    const r = searchArticles('equipo', articles);
    expect(r[0].id).toBe('b');
  });
});
