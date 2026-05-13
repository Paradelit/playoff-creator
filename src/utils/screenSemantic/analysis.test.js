import { describe, it, expect } from 'vitest';
import { buildAnalysisSemantic } from './analysis';

describe('buildAnalysisSemantic', () => {
  it('returns null without session', () => {
    expect(buildAnalysisSemantic(null)).toBeNull();
    expect(buildAnalysisSemantic({ session: {} })).toBeNull();
  });

  it('builds label without result when missing', () => {
    const semantic = buildAnalysisSemantic({
      session: { id: 's1', rival: 'Hispano', fecha: '2026-05-10' },
      team: { id: 't1', teamName: 'Cadete A' },
    });
    expect(semantic.surface).toBe('analysis');
    expect(semantic.label).toContain('Hispano');
    expect(semantic.label).toContain('Cadete A');
    expect(semantic.label).not.toMatch(/\(\d+-\d+\)/);
  });

  it('includes result in label when present', () => {
    const semantic = buildAnalysisSemantic({
      session: { id: 's1', rival: 'Hispano' },
      team: { id: 't1', teamName: 'A' },
      result: { ourScore: 65, theirScore: 60 },
    });
    expect(semantic.label).toContain('(65-60)');
  });

  it('exposes referableIds for sesión/partido/análisis/equipo', () => {
    const semantic = buildAnalysisSemantic({
      session: { id: 's1' },
      team: { id: 't1', teamName: 'A' },
    });
    expect(semantic.referableIds['esta sesión']).toBe('s1');
    expect(semantic.referableIds['este partido']).toBe('s1');
    expect(semantic.referableIds['este análisis']).toBe('s1');
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });
});
