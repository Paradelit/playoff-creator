import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
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

import { getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { saveMember } from './teamsService';
import {
  subscribeToProfile,
  saveProfile,
  autoAddCoachToTeam,
  exportUserData,
  importUserData,
  deleteAllUserData,
} from './settingsService';

const ctx = { uid: 'u1', db: {}, appId: 'app1' };

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
      'mock-doc-ref',
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
      ctx,
    );
  });

  it('does nothing when profile has no nombre', async () => {
    await autoAddCoachToTeam('t1', {}, ctx);
    expect(saveMember).not.toHaveBeenCalled();
  });

  it('does nothing when profile is null', async () => {
    await autoAddCoachToTeam('t1', null, ctx);
    expect(saveMember).not.toHaveBeenCalled();
  });

  it('trims whitespace-only nombre', async () => {
    await autoAddCoachToTeam('t1', { nombre: '   ' }, ctx);
    expect(saveMember).not.toHaveBeenCalled();
  });
});

describe('exportUserData', () => {
  it('exports profile, teams, members, trainings, exercises, calendar', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ nombre: 'Coach' }) });
    getDocs
      .mockResolvedValueOnce({ docs: [{ id: 't1', data: () => ({ categoria: 'Infantil' }) }] }) // teams
      .mockResolvedValueOnce({ docs: [{ id: 'm1', data: () => ({ nombre: 'Player' }) }] }) // members
      .mockResolvedValueOnce({ docs: [] }) // trainings
      .mockResolvedValueOnce({ docs: [{ id: 'e1', data: () => ({ nombre: 'Drill' }) }] }) // exercises
      .mockResolvedValueOnce({ docs: [{ id: 's1', data: () => ({ fecha: '2025-03-01' }) }] }); // calendar

    const result = await exportUserData('u1', {}, 'app1');

    expect(result.version).toBe(1);
    expect(result.profile).toEqual({ nombre: 'Coach' });
    expect(result.teams).toHaveLength(1);
    expect(result.members.t1).toHaveLength(1);
    expect(result.exercises).toHaveLength(1);
    expect(result.calendarSessions).toHaveLength(1);
  });

  it('returns empty profile when not found', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => null });
    getDocs.mockResolvedValue({ docs: [] });

    const result = await exportUserData('u1', {}, 'app1');
    expect(result.profile).toEqual({});
    expect(result.teams).toEqual([]);
  });
});

describe('importUserData', () => {
  it('imports profile, teams, members, trainings, exercises, calendar', async () => {
    const data = {
      profile: { nombre: 'Coach', updatedAt: 'old', createdAt: 'old' },
      teams: [{ id: 't1', categoria: 'Cadete', updatedAt: 'old', createdAt: 'old' }],
      members: { t1: [{ id: 'm1', nombre: 'Player', updatedAt: 'old', createdAt: 'old' }] },
      trainings: { t1: [{ id: 'tr1', nombre: 'Training', updatedAt: 'old', createdAt: 'old' }] },
      exercises: [{ id: 'e1', nombre: 'Drill', updatedAt: 'old', createdAt: 'old' }],
      calendarSessions: [{ id: 's1', fecha: '2025-03-01', updatedAt: 'old', createdAt: 'old' }],
    };

    await importUserData(data, ctx);

    // Profile + team + member + training + exercise + calendar = 6 setDoc calls
    expect(setDoc).toHaveBeenCalledTimes(6);

    // Verify timestamps are stripped
    const profileCall = setDoc.mock.calls[0];
    expect(profileCall[1]).not.toHaveProperty('updatedAt');
    expect(profileCall[1]).not.toHaveProperty('createdAt');
  });

  it('handles empty data gracefully', async () => {
    await importUserData({}, ctx);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('deleteAllUserData', () => {
  it('deletes all collections and profile', async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [{ id: 't1', ref: 'team-ref' }] }) // teams
      .mockResolvedValueOnce({ docs: [{ id: 'm1', ref: 'member-ref' }] }) // members
      .mockResolvedValueOnce({ docs: [{ id: 'tr1', ref: 'training-ref' }] }) // trainings
      .mockResolvedValueOnce({ docs: [{ id: 'b1', ref: 'bracket-ref' }] }) // brackets
      .mockResolvedValueOnce({ docs: [{ id: 'e1', ref: 'ex-ref' }] }) // exercises
      .mockResolvedValueOnce({ docs: [{ id: 's1', ref: 'cal-ref' }] }); // calendar

    await deleteAllUserData('u1', {}, 'app1');

    // Should delete: member + training + 3 cuaderno docs + team doc + bracket + exercise + calendar + profile
    expect(deleteDoc.mock.calls.length).toBeGreaterThanOrEqual(6);
  });
});
