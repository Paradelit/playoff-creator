import { describe, it, expect } from 'vitest';
import { buildTrainingEditorSemantic, buildTeamTrainingsSemantic } from './training';

describe('buildTrainingEditorSemantic', () => {
  it('returns null without training id', () => {
    expect(buildTrainingEditorSemantic(null)).toBeNull();
    expect(buildTrainingEditorSemantic({ training: {} })).toBeNull();
  });

  it('builds label with numero + fecha + team', () => {
    const semantic = buildTrainingEditorSemantic({
      teamId: 't1',
      team: { id: 't1', teamName: 'Cadete A', categoria: 'cadete' },
      training: { id: 'tr1', meta: { numero: 12, fecha: '2026-05-15' } },
    });
    expect(semantic.surface).toBe('training-editor');
    expect(semantic.label).toContain('#12');
    expect(semantic.label).toContain('2026-05-15');
    expect(semantic.label).toContain('Cadete A');
    expect(semantic.referableIds['este entrenamiento']).toBe('tr1');
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });

  it('falls back to training.meta.equipo when team object missing', () => {
    const semantic = buildTrainingEditorSemantic({
      teamId: 't1',
      training: { id: 'tr1', meta: { equipo: 'Fallback Name' } },
    });
    expect(semantic.label).toContain('Fallback Name');
  });
});

describe('buildTeamTrainingsSemantic', () => {
  it('returns null without teamId', () => {
    expect(buildTeamTrainingsSemantic(null)).toBeNull();
    expect(buildTeamTrainingsSemantic({})).toBeNull();
  });

  it('builds label with team name + trainings count', () => {
    const semantic = buildTeamTrainingsSemantic({
      teamId: 't1',
      team: { id: 't1', teamName: 'Cadete A' },
      trainings: [{ id: 'tr1' }, { id: 'tr2' }, { id: 'tr3' }],
    });
    expect(semantic.surface).toBe('team-trainings');
    expect(semantic.label).toContain('Cadete A');
    expect(semantic.label).toContain('3 entrenamientos');
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });

  it('handles empty trainings list', () => {
    const semantic = buildTeamTrainingsSemantic({
      teamId: 't1',
      team: { id: 't1', teamName: 'X' },
    });
    expect(semantic.label).toContain('0 entrenamientos');
  });
});
