import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => ({ kind: 'collection', path: args.join('/') })),
  doc: vi.fn((...args) => ({ kind: 'doc', path: args.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((target, ...clauses) => ({ kind: 'query', target, clauses })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  setDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => 'mock-storage-ref'),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/logo.png')),
}));

vi.mock('./teamsService', () => ({
  saveMember: vi.fn(() => Promise.resolve()),
}));

vi.mock('./dataCleanupService', () => ({
  deleteAllUserDataCascade: vi.fn(() => Promise.resolve()),
}));

import { getDoc, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { saveMember } from './teamsService';
import { deleteAllUserDataCascade } from './dataCleanupService';
import {
  subscribeToProfile,
  saveProfile,
  autoAddCoachToTeam,
  exportUserData,
  importUserData,
  deleteAllUserData,
} from './settingsService';

const ctx = { uid: 'u1', wsId: 'ws1', db: {}, appId: 'app1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToProfile', () => {
  it('calls callback with profile data when doc exists', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => true, data: () => ({ nombre: 'Coach' }) });
      return vi.fn();
    });

    subscribeToProfile('u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ nombre: 'Coach' });
  });

  it('calls callback with empty object when doc missing', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => false, data: () => null });
      return vi.fn();
    });

    subscribeToProfile('u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({});
  });
});

describe('saveProfile', () => {
  it('calls setDoc with merge', async () => {
    await saveProfile({ nombre: 'New Name' }, ctx);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'doc' }),
      expect.objectContaining({ nombre: 'New Name', updatedAt: 'SERVER_TS' }),
      { merge: true },
    );
  });
});

describe('autoAddCoachToTeam', () => {
  it('creates a staff member from profile', async () => {
    await autoAddCoachToTeam('t1', { nombre: 'Coach Name', rol: 'Entrenador', licencia: '123' }, ctx);
    expect(saveMember).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'staff',
        nombre: 'Coach Name',
        rol: 'Entrenador',
        licencia: '123',
      }),
      't1',
      { wsId: 'ws1', db: {}, appId: 'app1' },
    );
  });

  it('does nothing when profile has no nombre', async () => {
    await autoAddCoachToTeam('t1', {}, ctx);
    expect(saveMember).not.toHaveBeenCalled();
  });
});

describe('exportUserData', () => {
  it('exports a v2 backup with full functional data', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ nombre: 'Coach', proactivityMode: 'suggestions' }) });
    getDocs
      .mockResolvedValueOnce({ docs: [{ id: 't1', data: () => ({ categoria: 'Infantil' }) }] }) // teams
      .mockResolvedValueOnce({ docs: [{ id: 'm1', data: () => ({ nombre: 'Player' }) }] }) // members
      .mockResolvedValueOnce({ docs: [{ id: 'tr1', data: () => ({ nombre: 'Training' }) }] }) // trainings
      .mockResolvedValueOnce({
        docs: [
          { id: 'jugadores', data: () => ({ lista: ['A'] }) },
          { id: 'notas', data: () => ({ texto: 'Notas' }) },
        ],
      }) // cuaderno
      .mockResolvedValueOnce({ docs: [{ id: 'e1', data: () => ({ nombre: 'Drill' }) }] }) // exercises
      .mockResolvedValueOnce({ docs: [{ id: 's1', data: () => ({ fecha: '2025-03-01' }) }] }) // calendar
      .mockResolvedValueOnce({ docs: [{ id: 'b1', data: () => ({ name: 'Playoff' }) }] }) // brackets
      .mockResolvedValueOnce({ docs: [{ id: 'sc1', data: () => ({ rival: 'Rival' }) }] }) // scoutings
      .mockResolvedValueOnce({ docs: [{ id: 'a1', data: () => ({ mejorar: 'Cerrar rebote' }) }] }) // analisis
      .mockResolvedValueOnce({ docs: [{ id: 'p1', data: () => ({ jugadores: [] }) }] }) // planillas
      .mockResolvedValueOnce({ docs: [{ id: 'SHARE1', data: () => ({ name: 'Shared playoff' }) }] }); // shared

    const result = await exportUserData({ uid: 'u1', wsId: 'ws1', db: {}, appId: 'app1' });

    expect(result.version).toBe(2);
    expect(result.profile).toEqual({ nombre: 'Coach', proactivityMode: 'suggestions' });
    expect(result.members.t1).toHaveLength(1);
    expect(result.trainings.t1).toHaveLength(1);
    expect(result.cuaderno.t1).toEqual({
      jugadores: { lista: ['A'] },
      notas: { texto: 'Notas' },
    });
    expect(result.brackets).toEqual([{ id: 'b1', name: 'Playoff' }]);
    expect(result.scoutings).toEqual([{ id: 'sc1', rival: 'Rival' }]);
    expect(result.analisis).toEqual([{ id: 'a1', mejorar: 'Cerrar rebote' }]);
    expect(result.planillas).toEqual([{ id: 'p1', jugadores: [] }]);
    expect(result.sharedBrackets.SHARE1).toEqual({ name: 'Shared playoff', shareCode: 'SHARE1' });
  });
});

describe('importUserData', () => {
  it('imports a v2 backup including shared brackets and domain docs', async () => {
    const data = {
      version: 2,
      profile: { nombre: 'Coach', updatedAt: 'old', createdAt: 'old' },
      teams: [{ id: 't1', categoria: 'Cadete', updatedAt: 'old', createdAt: 'old' }],
      members: { t1: [{ id: 'm1', nombre: 'Player', updatedAt: 'old', createdAt: 'old' }] },
      trainings: { t1: [{ id: 'tr1', nombre: 'Training', updatedAt: 'old', createdAt: 'old' }] },
      cuaderno: {
        t1: {
          notas: { texto: 'Hola', updatedAt: 'old' },
          'test-tiro': { tables: [{ rows: [] }], createdAt: 'old' },
        },
      },
      exercises: [{ id: 'e1', nombre: 'Drill', updatedAt: 'old', createdAt: 'old' }],
      calendarSessions: [{ id: 's1', fecha: '2025-03-01', updatedAt: 'old', createdAt: 'old' }],
      brackets: [{ id: 'b1', name: 'Playoff', updatedAt: 'old', createdAt: 'old' }],
      scoutings: [{ id: 'sc1', rival: 'Rival', updatedAt: 'old', createdAt: 'old' }],
      analisis: [{ id: 'a1', mejorar: 'Box out', updatedAt: 'old', createdAt: 'old' }],
      planillas: [{ id: 'p1', jugadores: [], updatedAt: 'old', createdAt: 'old' }],
      sharedBrackets: {
        SHARE1: { name: 'Shared playoff', shareCode: 'SHARE1', updatedAt: 'old', createdAt: 'old' },
      },
    };

    await importUserData(data, ctx);

    expect(setDoc).toHaveBeenCalledTimes(13);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('shared/SHARE1') }),
      { name: 'Shared playoff', shareCode: 'SHARE1' },
      { merge: true },
    );
  });

  it('keeps v1 imports compatible', async () => {
    const data = {
      version: 1,
      profile: { nombre: 'Coach', updatedAt: 'old', createdAt: 'old' },
      teams: [{ id: 't1', categoria: 'Cadete', updatedAt: 'old', createdAt: 'old' }],
      members: { t1: [{ id: 'm1', nombre: 'Player', updatedAt: 'old', createdAt: 'old' }] },
      trainings: { t1: [{ id: 'tr1', nombre: 'Training', updatedAt: 'old', createdAt: 'old' }] },
      exercises: [{ id: 'e1', nombre: 'Drill', updatedAt: 'old', createdAt: 'old' }],
      calendarSessions: [{ id: 's1', fecha: '2025-03-01', updatedAt: 'old', createdAt: 'old' }],
    };

    await importUserData(data, ctx);

    expect(setDoc).toHaveBeenCalledTimes(6);
  });
});

describe('deleteAllUserData', () => {
  it('delegates full deletion to the backend cleanup callable', async () => {
    await deleteAllUserData('app1');
    expect(deleteAllUserDataCascade).toHaveBeenCalledWith({ appId: 'app1' });
  });
});
