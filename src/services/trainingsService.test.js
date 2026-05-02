import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col-ref'),
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  query: vi.fn((...args) => args),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
}));

vi.mock('./firestoreHelpers', () => ({
  workspaceColRef: vi.fn(() => 'mock-ws-col-ref'),
  saveWorkspaceDoc: vi.fn(() => Promise.resolve()),
  deleteWorkspaceDoc: vi.fn(() => Promise.resolve()),
}));

import { setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { saveWorkspaceDoc, deleteWorkspaceDoc } from './firestoreHelpers';
import {
  subscribeToTrainings,
  saveTraining,
  deleteTraining,
  subscribeToExercises,
  saveExercise,
  deleteExercise,
  propagateExerciseUpdate,
} from './trainingsService';

const ctx = { wsId: 'ws1', db: {}, appId: 'app1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToTrainings', () => {
  it('subscribes with onSnapshot and returns unsubscribe', () => {
    const unsub = vi.fn();
    onSnapshot.mockReturnValue(unsub);
    const cb = vi.fn();

    const result = subscribeToTrainings('team-1', 'ws1', {}, 'app1', cb);
    expect(onSnapshot).toHaveBeenCalled();
    expect(result).toBe(unsub);
  });

  it('maps snapshot docs to callback', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [{ id: 't1', data: () => ({ nombre: 'Training 1' }) }],
      });
      return vi.fn();
    });

    subscribeToTrainings('team-1', 'ws1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([{ id: 't1', nombre: 'Training 1' }]);
  });
});

describe('saveTraining', () => {
  it('calls setDoc with merge and timestamps', async () => {
    await saveTraining({ id: 't1', nombre: 'Test' }, 'team-1', ctx);
    expect(setDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      expect.objectContaining({
        id: 't1',
        nombre: 'Test',
        updatedAt: 'SERVER_TS',
        createdAt: 'SERVER_TS',
      }),
      { merge: true },
    );
  });
});

describe('deleteTraining', () => {
  it('calls deleteDoc', async () => {
    await deleteTraining('t1', 'team-1', ctx);
    expect(deleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });
});

describe('subscribeToExercises', () => {
  it('normalizes exercise tags from contenido', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [{ id: 'e1', data: () => ({ nombre: 'Drill', contenido: 'pase, bote, tiro' }) }],
      });
      return vi.fn();
    });

    subscribeToExercises('ws1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'e1',
        nombre: 'Drill',
        tags: ['pase', 'bote', 'tiro'],
      }),
    ]);
  });

  it('preserves existing tags array', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_q, callback) => {
      callback({
        docs: [{ id: 'e1', data: () => ({ nombre: 'Drill', tags: ['pase', 'tiro'] }) }],
      });
      return vi.fn();
    });

    subscribeToExercises('ws1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ tags: ['pase', 'tiro'] })]);
  });
});

describe('saveExercise', () => {
  it('converts tags array to contenido string', async () => {
    await saveExercise({ id: 'e1', tags: ['pase', 'tiro'] }, ctx);
    expect(saveWorkspaceDoc).toHaveBeenCalledWith(
      {},
      'app1',
      'ws1',
      ['exercises', 'e1'],
      expect.objectContaining({ contenido: 'pase, tiro' }),
    );
  });
});

describe('deleteExercise', () => {
  it('calls deleteWorkspaceDoc', async () => {
    await deleteExercise('e1', ctx);
    expect(deleteWorkspaceDoc).toHaveBeenCalledWith({}, 'app1', 'ws1', ['exercises', 'e1']);
  });
});

describe('propagateExerciseUpdate', () => {
  it('updates trainings that reference the exercise', async () => {
    getDocs
      .mockResolvedValueOnce({
        // teams
        docs: [{ id: 'team-1' }],
      })
      .mockResolvedValueOnce({
        // trainings for team-1
        docs: [
          {
            id: 'tr1',
            ref: 'mock-training-ref',
            data: () => ({
              ejercicios: [
                { libExerciseId: 'e1', contenido: 'old' },
                { libExerciseId: 'e2', contenido: 'other' },
              ],
            }),
          },
        ],
      });

    await propagateExerciseUpdate(
      { id: 'e1', contenido: 'new-content', descripcion: 'desc', nombre: 'Updated', pasos: [], elementos: [] },
      ctx,
    );

    expect(setDoc).toHaveBeenCalledWith(
      'mock-training-ref',
      expect.objectContaining({
        ejercicios: expect.arrayContaining([
          expect.objectContaining({ libExerciseId: 'e1', contenido: 'new-content' }),
          expect.objectContaining({ libExerciseId: 'e2', contenido: 'other' }),
        ]),
      }),
      { merge: true },
    );
  });

  it('skips trainings that do not reference the exercise', async () => {
    getDocs.mockResolvedValueOnce({ docs: [{ id: 'team-1' }] }).mockResolvedValueOnce({
      docs: [
        {
          id: 'tr1',
          ref: 'ref',
          data: () => ({ ejercicios: [{ libExerciseId: 'e99' }] }),
        },
      ],
    });

    await propagateExerciseUpdate({ id: 'e1', contenido: 'new' }, ctx);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
