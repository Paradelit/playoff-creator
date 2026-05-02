import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  query: vi.fn((...args) => args),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
}));

import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, where, orderBy } from 'firebase/firestore';
import {
  subscribeToCalendarSessions,
  saveCalendarSession,
  deleteCalendarSession,
  bulkImportCalendarSessions,
  getCalendarSessionsInRange,
  linkTrainingToSession,
  batchUpdateCalendarSessions,
} from './calendarService';

const ctx = { wsId: 'ws1', db: {}, appId: 'app1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToCalendarSessions', () => {
  it('sets up onSnapshot with date range query', () => {
    const cb = vi.fn();
    const unsub = vi.fn();
    onSnapshot.mockReturnValue(unsub);

    const result = subscribeToCalendarSessions('ws1', {}, 'app1', '2025-01-01', '2025-06-30', cb);

    expect(collection).toHaveBeenCalledWith({}, 'artifacts', 'app1', 'workspaces', 'ws1', 'calendarSessions');
    expect(where).toHaveBeenCalledWith('fecha', '>=', '2025-01-01');
    expect(where).toHaveBeenCalledWith('fecha', '<=', '2025-06-30');
    expect(orderBy).toHaveBeenCalledWith('fecha', 'asc');
    expect(onSnapshot).toHaveBeenCalled();
    expect(result).toBe(unsub);
  });

  it('calls callback with mapped docs on snapshot', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [
          { id: 's1', data: () => ({ fecha: '2025-03-01', tipo: 'entrenamiento' }) },
          { id: 's2', data: () => ({ fecha: '2025-03-02', tipo: 'partido' }) },
        ],
      });
      return vi.fn();
    });

    subscribeToCalendarSessions('ws1', {}, 'app1', '2025-03-01', '2025-03-31', cb);

    expect(cb).toHaveBeenCalledWith([
      { id: 's1', fecha: '2025-03-01', tipo: 'entrenamiento' },
      { id: 's2', fecha: '2025-03-02', tipo: 'partido' },
    ]);
  });
});

describe('saveCalendarSession', () => {
  it('calls setDoc with merge and timestamps', async () => {
    const session = { id: 'session-1', fecha: '2025-03-15', tipo: 'entrenamiento' };
    await saveCalendarSession(session, ctx);

    expect(doc).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({
        id: 'session-1',
        fecha: '2025-03-15',
        updatedAt: 'SERVER_TS',
        createdAt: 'SERVER_TS',
      }),
      { merge: true },
    );
  });

  it('does not overwrite existing createdAt', async () => {
    const session = { id: 's1', fecha: '2025-03-15', createdAt: 'existing' };
    await saveCalendarSession(session, ctx);

    const savedData = setDoc.mock.calls[0][1];
    expect(savedData.createdAt).toBe('existing');
  });
});

describe('deleteCalendarSession', () => {
  it('calls deleteDoc with the correct ref', async () => {
    await deleteCalendarSession('session-1', ctx);
    expect(doc).toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });
});

describe('bulkImportCalendarSessions', () => {
  it('saves all sessions', async () => {
    const sessions = [
      { id: 's1', fecha: '2025-03-01' },
      { id: 's2', fecha: '2025-03-02' },
    ];
    await bulkImportCalendarSessions(sessions, ctx);
    expect(setDoc).toHaveBeenCalledTimes(2);
  });
});

describe('getCalendarSessionsInRange', () => {
  it('queries and returns mapped docs', async () => {
    getDocs.mockResolvedValue({
      docs: [{ id: 's1', data: () => ({ fecha: '2025-03-01' }) }],
    });

    const result = await getCalendarSessionsInRange('ws1', {}, 'app1', '2025-03-01', '2025-03-31');
    expect(result).toEqual([{ id: 's1', fecha: '2025-03-01' }]);
  });
});

describe('linkTrainingToSession', () => {
  it('sets trainingId on session doc', async () => {
    await linkTrainingToSession('s1', 't1', ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', { trainingId: 't1', updatedAt: 'SERVER_TS' }, { merge: true });
  });
});

describe('batchUpdateCalendarSessions', () => {
  it('updates all sessions with given fields', async () => {
    const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
    const fields = { horaInicio: '10:00' };
    await batchUpdateCalendarSessions(sessions, fields, ctx);
    expect(setDoc).toHaveBeenCalledTimes(3);
    expect(setDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      { horaInicio: '10:00', updatedAt: 'SERVER_TS' },
      { merge: true },
    );
  });
});
