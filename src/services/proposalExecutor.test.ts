import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  doc: vi.fn((...args: unknown[]) => ({ kind: 'doc', path: args.join('/') })),
  getDoc: vi.fn(),
}));

vi.mock('./firestoreHelpers', () => ({
  userDocRef: vi.fn((_db, appId, uid, collectionName, docId) => ({
    kind: 'user-doc',
    path: `artifacts/${appId}/users/${uid}/${collectionName}/${docId}`,
  })),
  userColRef: vi.fn((_db, appId, uid, collectionName) => ({
    kind: 'user-col',
    path: `artifacts/${appId}/users/${uid}/${collectionName}`,
  })),
}));

vi.mock('../utils/bracketEngine', () => ({
  calculateMatchWinner: vi.fn(
    (match: { team1?: string; team2?: string; scores?: Array<{ s1?: string; s2?: string }> }) => {
      const firstGame = match.scores?.[0];
      if (!firstGame) return null;
      const s1 = firstGame.s1 === '' || firstGame.s1 == null ? Number.NaN : Number(firstGame.s1);
      const s2 = firstGame.s2 === '' || firstGame.s2 == null ? Number.NaN : Number(firstGame.s2);
      if (Number.isNaN(s1) || Number.isNaN(s2) || s1 === s2) return null;
      return s1 > s2 ? (match.team1 ?? null) : (match.team2 ?? null);
    },
  ),
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { executeProposal } from './proposalExecutor';
import type { ExecuteContext } from './proposalExecutor';

const ctx = {
  db: {},
  appId: 'app1',
  uid: 'u1',
} as unknown as ExecuteContext;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeProposal', () => {
  it('writes bracket score updates inside bracketData.state and propagates winner changes', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        bracketData: {
          state: {
            'R1-M0': {
              id: 'R1-M0',
              team1: 'Uros',
              team2: 'Rival',
              gamesCount: 1,
              scores: [{ s1: '', s2: '' }],
              nextId: 'R2-M0',
              slot: 'team1',
              winner: null,
            },
            'R2-M0': {
              id: 'R2-M0',
              team1: null,
              team2: 'Otro rival',
              gamesCount: 1,
              scores: [{ s1: '12', s2: '20' }],
              winner: 'Otro rival',
            },
          },
        },
      }),
    });

    await executeProposal(ctx, {
      proposalId: 'p1',
      kind: 'update_bracket_scores',
      summary: 'Actualizar marcador',
      payload: {
        bracketId: 'b1',
        updates: [{ matchId: 'R1-M0', scores: [{ s1: 65, s2: 58 }] }],
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'artifacts/app1/users/u1/brackets/b1' }),
      expect.objectContaining({
        bracketData: {
          state: expect.objectContaining({
            'R1-M0': expect.objectContaining({
              scores: [{ s1: '65', s2: '58' }],
              winner: 'Uros',
            }),
            'R2-M0': expect.objectContaining({
              team1: 'Uros',
              scores: [{ s1: '', s2: '20' }],
              winner: null,
            }),
          }),
        },
        updatedAt: 'SERVER_TS',
      }),
      { merge: true },
    );
  });

  it('updates shared brackets through the shared document', async () => {
    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ shareCode: 'SHARE1' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bracketData: {
            state: {
              'R1-M0': {
                id: 'R1-M0',
                team1: 'Uros',
                team2: 'Rival',
                gamesCount: 1,
                scores: [{ s1: '', s2: '' }],
                winner: null,
              },
            },
          },
        }),
      });

    await executeProposal(ctx, {
      proposalId: 'p2',
      kind: 'update_bracket_scores',
      summary: 'Actualizar shared',
      payload: {
        bracketId: 'b-shared',
        updates: [{ matchId: 'R1-M0', scores: [{ s1: 10, s2: 8 }] }],
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('artifacts/app1/shared/SHARE1') }),
      expect.objectContaining({
        bracketData: expect.any(Object),
        updatedAt: 'SERVER_TS',
      }),
      { merge: true },
    );
  });

  it('persists team linkage when creating a bracket', async () => {
    await executeProposal(ctx, {
      proposalId: 'p3',
      kind: 'create_bracket',
      summary: 'Crear playoff',
      payload: {
        teamId: 'team-1',
        bracket: { name: 'Playoff escolar' },
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('/brackets/') }),
      expect.objectContaining({
        name: 'Playoff escolar',
        teamId: 'team-1',
        teamName: null,
        createdAt: 'SERVER_TS',
        updatedAt: 'SERVER_TS',
      }),
      { merge: true },
    );
  });

  it('stores attendance under the attendance map and preserves manual sessions', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        attendance: { s0: { m1: 'F' } },
        manualSessions: { septiembre: [{ id: 'manual-1', label: 'Extra' }] },
      }),
    });

    await executeProposal(ctx, {
      proposalId: 'p4',
      kind: 'save_attendance',
      summary: 'Guardar asistencia',
      payload: {
        teamId: 'team-1',
        sessionId: 's1',
        attendance: { m2: 'R' },
      },
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('cuaderno/asistencia') }),
      {
        attendance: {
          s0: { m1: 'F' },
          s1: { m2: 'R' },
        },
        manualSessions: { septiembre: [{ id: 'manual-1', label: 'Extra' }] },
        updatedAt: 'SERVER_TS',
      },
      { merge: true },
    );
  });

  it('normalizes player report and shooting test shapes to the real screen contracts', async () => {
    await executeProposal(ctx, {
      proposalId: 'p5',
      kind: 'save_player_report',
      summary: 'Guardar informe',
      payload: {
        teamId: 'team-1',
        report: { rows: [{ nombre: 'Ana' }], extra: 'keep' },
      },
    });

    await executeProposal(ctx, {
      proposalId: 'p6',
      kind: 'save_shooting_test',
      summary: 'Guardar tiro',
      payload: {
        teamId: 'team-1',
        testResults: { fecha: '2025-03-01', rows: [] },
      },
    });

    expect(setDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: expect.stringContaining('cuaderno/informe-jugadores') }),
      {
        rows: [{ nombre: 'Ana' }],
        extra: 'keep',
        updatedAt: 'SERVER_TS',
      },
      { merge: true },
    );
    expect(setDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: expect.stringContaining('cuaderno/test-tiro') }),
      {
        fecha: '2025-03-01',
        rows: [],
        tables: { fecha: '2025-03-01', rows: [] },
        updatedAt: 'SERVER_TS',
      },
      { merge: true },
    );
  });
});
