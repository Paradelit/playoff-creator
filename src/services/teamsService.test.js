import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  query: vi.fn((...args) => args),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
}));

vi.mock('./firestoreHelpers', () => ({
  userColRef: vi.fn(() => 'mock-user-col-ref'),
  saveUserDoc: vi.fn(() => Promise.resolve()),
  deleteUserDoc: vi.fn(() => Promise.resolve()),
}));

import { setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { saveUserDoc, deleteUserDoc } from './firestoreHelpers';
import {
  subscribeToTeams,
  saveTeam,
  deleteTeam,
  subscribeToMembers,
  saveMember,
  deleteMember,
  subscribeToTeamJugadores,
  saveTeamJugadores,
  subscribeToTestTiro,
  saveTestTiro,
  subscribeToAsistencia,
  saveAsistencia,
  subscribeToTeamNotes,
  saveTeamNotes,
} from './teamsService';

const ctx = { uid: 'u1', db: {}, appId: 'app1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToTeams', () => {
  it('subscribes and maps docs', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [{ id: 't1', data: () => ({ categoria: 'Infantil' }) }],
      });
      return vi.fn();
    });

    subscribeToTeams('u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([{ id: 't1', categoria: 'Infantil' }]);
  });
});

describe('saveTeam / deleteTeam', () => {
  it('saveTeam delegates to saveUserDoc', async () => {
    await saveTeam({ id: 't1', categoria: 'Cadete' }, ctx);
    expect(saveUserDoc).toHaveBeenCalledWith({}, 'app1', 'u1', 'teams', 't1', { id: 't1', categoria: 'Cadete' });
  });

  it('deleteTeam delegates to deleteUserDoc', async () => {
    await deleteTeam('t1', ctx);
    expect(deleteUserDoc).toHaveBeenCalledWith({}, 'app1', 'u1', 'teams', 't1');
  });
});

describe('subscribeToMembers', () => {
  it('subscribes and maps member docs', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [{ id: 'm1', data: () => ({ nombre: 'Player 1', tipo: 'jugador' }) }],
      });
      return vi.fn();
    });

    subscribeToMembers('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([{ id: 'm1', nombre: 'Player 1', tipo: 'jugador' }]);
  });
});

describe('saveMember / deleteMember', () => {
  it('saveMember calls setDoc with timestamps', async () => {
    await saveMember({ id: 'm1', nombre: 'Test' }, 't1', ctx);
    expect(setDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({ nombre: 'Test', updatedAt: 'SERVER_TS', createdAt: 'SERVER_TS' }),
      { merge: true },
    );
  });

  it('deleteMember calls deleteDoc', async () => {
    await deleteMember('m1', 't1', ctx);
    expect(deleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });
});

describe('cuaderno subscriptions', () => {
  it('subscribeToTeamJugadores returns lista or empty array', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => true, data: () => ({ lista: ['j1', 'j2'] }) });
      return vi.fn();
    });

    subscribeToTeamJugadores('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith(['j1', 'j2']);
  });

  it('subscribeToTeamJugadores returns empty array when doc does not exist', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => false, data: () => null });
      return vi.fn();
    });

    subscribeToTeamJugadores('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('subscribeToTestTiro returns tables or null', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => true, data: () => ({ tables: { a: 1 } }) });
      return vi.fn();
    });

    subscribeToTestTiro('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ a: 1 });
  });

  it('subscribeToAsistencia returns default when doc missing', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => false, data: () => null });
      return vi.fn();
    });

    subscribeToAsistencia('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ attendance: {}, manualSessions: {} });
  });

  it('subscribeToTeamNotes returns text or empty string', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => true, data: () => ({ texto: 'mis notas' }) });
      return vi.fn();
    });

    subscribeToTeamNotes('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith('mis notas');
  });
});

describe('cuaderno saves', () => {
  it('saveTeamJugadores writes lista', async () => {
    await saveTeamJugadores('t1', ['j1'], ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', { lista: ['j1'], updatedAt: 'SERVER_TS' });
  });

  it('saveTestTiro writes tables', async () => {
    await saveTestTiro('t1', { rows: [] }, ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', { tables: { rows: [] }, updatedAt: 'SERVER_TS' });
  });

  it('saveAsistencia writes full data', async () => {
    await saveAsistencia('t1', { attendance: { s1: {} } }, ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', {
      attendance: { s1: {} },
      updatedAt: 'SERVER_TS',
    });
  });

  it('saveTeamNotes writes texto', async () => {
    await saveTeamNotes('t1', 'notas actualizadas', ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', { texto: 'notas actualizadas', updatedAt: 'SERVER_TS' });
  });
});
