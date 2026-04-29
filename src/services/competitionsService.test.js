import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => ({ _path: args.slice(1).join('/') })),
  doc: vi.fn((col, id) => ({ _path: `${col._path}/${id}` })),
  setDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  onSnapshot: vi.fn(() => () => undefined),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn((col) => col),
  orderBy: vi.fn(() => undefined),
}));

import { saveCompetition, deleteCompetition, subscribeToCompetitions } from './competitionsService';

const ctx = { uid: 'u1', db: {}, appId: 'app1' };

describe('competitionsService', () => {
  it('saveCompetition writes with createdAt when new', async () => {
    const { setDoc } = await import('firebase/firestore');
    setDoc.mockClear();
    await saveCompetition({ id: 'c1', nombre: 'Liga' }, 't1', ctx);
    const call = setDoc.mock.calls.at(-1);
    expect(call[1]).toMatchObject({
      id: 'c1',
      nombre: 'Liga',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    });
  });

  it('saveCompetition skips createdAt when already set', async () => {
    const { setDoc } = await import('firebase/firestore');
    setDoc.mockClear();
    await saveCompetition({ id: 'c1', createdAt: 'X' }, 't1', ctx);
    const call = setDoc.mock.calls.at(-1);
    expect(call[1].createdAt).toBe('X');
    expect(call[1].updatedAt).toBe('SERVER_TIMESTAMP');
  });

  it('deleteCompetition deletes the doc', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    deleteDoc.mockClear();
    await deleteCompetition('c1', 't1', ctx);
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('subscribeToCompetitions registers snapshot listener', async () => {
    const { onSnapshot } = await import('firebase/firestore');
    onSnapshot.mockClear();
    const cb = vi.fn();
    subscribeToCompetitions('t1', 'u1', {}, 'app1', cb);
    expect(onSnapshot).toHaveBeenCalled();
  });
});
