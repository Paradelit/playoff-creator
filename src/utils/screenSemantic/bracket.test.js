import { describe, it, expect } from 'vitest';
import { buildBracketSemantic } from './bracket';

describe('buildBracketSemantic', () => {
  it('returns null without activeBracketId', () => {
    expect(buildBracketSemantic(null)).toBeNull();
    expect(buildBracketSemantic({ activeBracketId: null })).toBeNull();
    expect(buildBracketSemantic({ activeBracketId: '', activeBracket: {} })).toBeNull();
  });

  it('returns minimal semantic with just bracketId', () => {
    const semantic = buildBracketSemantic({ activeBracketId: 'b1', activeBracket: null });
    expect(semantic.surface).toBe('bracket-editor');
    expect(semantic.label).toContain('cuadro'); // fallback name
    expect(semantic.referableIds['este bracket']).toBe('b1');
    expect(semantic.referableIds['este cuadro']).toBe('b1');
    expect(semantic.referableIds['este playoff']).toBe('b1');
  });

  it('uses bracket.name when present', () => {
    const semantic = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'Liga 2026' },
    });
    expect(semantic.label).toContain('Liga 2026');
  });

  it('falls back to tournamentName when name missing', () => {
    const semantic = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { tournamentName: 'Copa de la Liga' },
    });
    expect(semantic.label).toContain('Copa de la Liga');
  });

  it('includes myTeam in label when present', () => {
    const semantic = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'X', myTeam: 'Juniors B' },
    });
    expect(semantic.label).toContain('Juniors B');
  });

  it('exposes "este equipo" when bracket has teamId', () => {
    const semantic = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'X', teamId: 't1' },
    });
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });

  it('marks read-only mode in label when canEdit is false', () => {
    const semantic = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'X' },
      canEdit: false,
    });
    expect(semantic.label).toContain('solo-lectura');
  });

  it('does not mark read-only when canEdit is true or undefined', () => {
    const semanticTrue = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'X' },
      canEdit: true,
    });
    const semanticUndef = buildBracketSemantic({
      activeBracketId: 'b1',
      activeBracket: { name: 'X' },
    });
    expect(semanticTrue.label).not.toContain('solo-lectura');
    expect(semanticUndef.label).not.toContain('solo-lectura');
  });
});
