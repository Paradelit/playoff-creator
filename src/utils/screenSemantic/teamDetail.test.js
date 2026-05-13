import { describe, it, expect } from 'vitest';
import { buildTeamDetailSemantic } from './teamDetail';

const TODAY = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

describe('buildTeamDetailSemantic', () => {
  it('returns null when team is missing', () => {
    expect(buildTeamDetailSemantic(null)).toBeNull();
    expect(buildTeamDetailSemantic({ team: null })).toBeNull();
    expect(buildTeamDetailSemantic({ team: {} })).toBeNull();
  });

  it('builds label with team name + jugadores count + categoria', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', teamName: 'Juniors B', categoria: 'junior' },
      members: [
        { id: 'p1', tipo: 'jugador' },
        { id: 'p2', tipo: 'jugador' },
        { id: 's1', tipo: 'staff' },
      ],
      allSessions: [],
    });
    expect(semantic).not.toBeNull();
    expect(semantic.surface).toBe('team-detail');
    expect(semantic.label).toContain('Juniors B');
    expect(semantic.label).toContain('junior');
    expect(semantic.label).toContain('2 jugadores');
    expect(semantic.label).toContain('1 staff');
    expect(semantic.referableIds).toEqual({ 'este equipo': 't1' });
  });

  it('includes nextSession when an upcoming match exists for this team', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
      allSessions: [
        { id: 's-next', teamId: 't1', fecha: TOMORROW, tipo: 'partido', rival: 'Hispano' },
        { id: 's-past', teamId: 't1', fecha: YESTERDAY, tipo: 'partido', rival: 'Olímpico' },
        { id: 's-other-team', teamId: 't2', fecha: TOMORROW, tipo: 'partido', rival: 'X' },
      ],
    });
    expect(semantic.label).toContain('Hispano');
    expect(semantic.referableIds['este partido']).toBe('s-next');
    expect(semantic.referableIds['el próximo partido']).toBe('s-next');
  });

  it('treats today as a future session (>= today)', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
      allSessions: [{ id: 's-hoy', teamId: 't1', fecha: TODAY, tipo: 'partido' }],
    });
    expect(semantic.referableIds['este partido']).toBe('s-hoy');
  });

  it('omits "este partido" when no upcoming session', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
      allSessions: [{ id: 's-past', teamId: 't1', fecha: YESTERDAY, tipo: 'partido' }],
    });
    expect(semantic.referableIds['este partido']).toBeUndefined();
  });

  it('includes activePlayoff reference when present', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
      allSessions: [],
      activePlayoff: { id: 'b1', name: 'Liga 2026' },
    });
    expect(semantic.label).toContain('Liga 2026');
    expect(semantic.referableIds['este playoff']).toBe('b1');
    expect(semantic.referableIds['este bracket']).toBe('b1');
  });

  it('falls back to team.name when teamName missing', () => {
    const semantic = buildTeamDetailSemantic({
      team: { id: 't1', name: 'Fallback' },
      members: [],
      allSessions: [],
    });
    expect(semantic.label).toContain('Fallback');
  });
});
