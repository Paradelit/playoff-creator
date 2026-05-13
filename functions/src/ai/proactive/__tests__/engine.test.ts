import { describe, it, expect, vi } from 'vitest';
import { decideProactive } from '../engine';
import type { UserDigest, PendingConvocatoria, PendingMatchAction } from '../../digest/types';

function mkConvocatoria(sessionId: string, fecha: string, teamName: string): PendingConvocatoria {
  return {
    sessionId,
    fecha,
    teamName,
    severity: 'high',
    hoursUntil: 24,
  };
}

function mkMatchAction(sessionId: string, fecha: string, teamName: string, rival?: string): PendingMatchAction {
  return { sessionId, fecha, teamName, rival };
}

function makeDigest(overrides: Partial<UserDigest> = {}): UserDigest {
  return {
    todayISO: '2026-05-13',
    todayLocalDayOfWeek: 'miércoles',
    workspace: { id: 'w1', name: 'Test', type: 'personal', userRole: 'owner' },
    teams: [],
    activeBrackets: [],
    upcomingSessions: [],
    recentPastSessions: [],
    pendingActions: { convocatorias: [], scoutings: [], analyses: [], playerReports: [] },
    preferences: {},
    memories: [],
    ...overrides,
  };
}

const NOW_ISO = '2026-05-13T18:00:00Z';
const DEPS = { db: {} as never, appId: 'a', userId: 'u1' };

describe('decideProactive', () => {
  it('returns null when there are no pendings', async () => {
    const out = await decideProactive(
      { ...DEPS, wasRecentlyDismissed: vi.fn(async () => false) },
      makeDigest(),
      NOW_ISO,
    );
    expect(out).toBeNull();
  });

  it('returns the highest-severity candidate when nothing dismissed', async () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [mkConvocatoria('s1', '2026-05-14', 'Cadete A')], // high
        scoutings: [mkMatchAction('s2', '2026-05-20', 'Cadete A', 'X')], // info
        analyses: [],
        playerReports: [],
      },
    });
    const out = await decideProactive({ ...DEPS, wasRecentlyDismissed: vi.fn(async () => false) }, digest, NOW_ISO);
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('convocatoria_urgent');
  });

  it('skips dismissed kinds and returns the next candidate', async () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [mkConvocatoria('s1', '2026-05-14', 'Cadete A')],
        scoutings: [mkMatchAction('s2', '2026-05-20', 'Cadete A', 'X')],
        analyses: [],
        playerReports: [],
      },
    });
    const wasRecentlyDismissed = vi.fn(async (_d: unknown, kind: string) => kind === 'convocatoria_urgent');
    const out = await decideProactive({ ...DEPS, wasRecentlyDismissed }, digest, NOW_ISO);
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('scouting_missing');
  });

  it('returns null when all kinds are dismissed', async () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [mkConvocatoria('s1', '2026-05-14', 'Cadete A')],
        scoutings: [mkMatchAction('s2', '2026-05-20', 'Cadete A', 'X')],
        analyses: [],
        playerReports: [],
      },
    });
    const out = await decideProactive({ ...DEPS, wasRecentlyDismissed: vi.fn(async () => true) }, digest, NOW_ISO);
    expect(out).toBeNull();
  });

  it('only calls wasRecentlyDismissed once per kind even with multiple candidates of same kind', async () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [
          mkConvocatoria('s1', '2026-05-14', 'Cadete A'),
          mkConvocatoria('s2', '2026-05-15', 'Juniors B'),
        ],
        scoutings: [],
        analyses: [],
        playerReports: [],
      },
    });
    const wasRecentlyDismissed = vi.fn(async () => false);
    await decideProactive({ ...DEPS, wasRecentlyDismissed }, digest, NOW_ISO);
    // Engine returns the first un-dismissed candidate; should only check the kind once.
    expect(wasRecentlyDismissed).toHaveBeenCalledTimes(1);
  });
});
