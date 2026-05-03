import { describe, it, expect, vi } from 'vitest';

// Override the global firebase/* mocks from src/test/setup.js so we get the
// real `initializeApp` + `doc` / `collection` factories (needed to assert
// `ref.path`). `setDoc`, `deleteDoc`, `serverTimestamp` are overridden with
// spies that the saveWorkspaceDoc / deleteWorkspaceDoc tests assert against.
vi.mock('firebase/app', async () => {
  const actual = await vi.importActual('firebase/app');
  return { ...actual };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    setDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    serverTimestamp: () => ({ __ts: true }),
  };
});

import { initializeApp } from 'firebase/app';
import { getFirestore, setDoc, deleteDoc } from 'firebase/firestore';
import { workspaceDocRef, workspaceColRef, saveWorkspaceDoc, deleteWorkspaceDoc } from '../firestoreHelpers';

const app = initializeApp({ projectId: 'test-project' }, 'test-app-paths');
const db = getFirestore(app);

describe('workspaceDocRef', () => {
  it('builds top-level workspace doc path', () => {
    const ref = workspaceDocRef(db, 'app1', 'ws1', 'teams', 'team1');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1');
  });

  it('supports deeply nested paths via varargs', () => {
    const ref = workspaceDocRef(db, 'app1', 'ws1', 'teams', 'team1', 'cuaderno', 'jugadores');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1/cuaderno/jugadores');
  });
});

describe('workspaceColRef', () => {
  it('builds top-level workspace collection path', () => {
    const ref = workspaceColRef(db, 'app1', 'ws1', 'teams');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams');
  });

  it('supports nested collection paths via varargs', () => {
    const ref = workspaceColRef(db, 'app1', 'ws1', 'teams', 'team1', 'trainings');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1/trainings');
  });
});

describe('saveWorkspaceDoc', () => {
  it('writes with auto timestamps and merge', async () => {
    setDoc.mockClear();
    await saveWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1'], { name: 'Equipo' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/t1');
    expect(data.name).toBe('Equipo');
    expect(data.createdAt).toEqual({ __ts: true });
    expect(data.updatedAt).toEqual({ __ts: true });
    expect(options).toEqual({ merge: true });
  });

  it('preserves existing createdAt if provided', async () => {
    setDoc.mockClear();
    await saveWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1'], { name: 'Equipo', createdAt: 'EXISTING' });
    const [, data] = setDoc.mock.calls[0];
    expect(data.createdAt).toBe('EXISTING');
    expect(data.updatedAt).toEqual({ __ts: true });
  });
});

describe('deleteWorkspaceDoc', () => {
  it('deletes via deleteDoc with the right ref', async () => {
    deleteDoc.mockClear();
    await deleteWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1']);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = deleteDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/t1');
  });
});
