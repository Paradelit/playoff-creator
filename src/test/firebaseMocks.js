import { vi } from 'vitest';

// ── Firestore mock helpers ─────────────────────────────────────────────────

/**
 * Creates a mock Firestore snapshot document.
 */
export function createMockDocSnap(data, id = 'doc-1') {
  return {
    id,
    data: () => data,
    exists: () => data !== null,
    ref: { id },
  };
}

/**
 * Creates a mock Firestore query snapshot with multiple docs.
 */
export function createMockQuerySnap(docs) {
  return {
    docs: docs.map((d) => createMockDocSnap(d.data, d.id)),
    empty: docs.length === 0,
    size: docs.length,
  };
}

/**
 * Sets up vi.mock('firebase/firestore') with controllable defaults.
 * Returns an object of mock functions that tests can configure.
 *
 * Usage:
 *   vi.mock('firebase/firestore');
 *   import { setDoc, deleteDoc, ... } from 'firebase/firestore';
 *   // Then configure in beforeEach:
 *   setDoc.mockResolvedValue(undefined);
 */
export function createFirestoreMocks() {
  const mockUnsubscribe = vi.fn();

  return {
    mockUnsubscribe,
    // Call this in beforeEach to wire up onSnapshot to call the callback immediately
    async setupOnSnapshot(snapshotData) {
      const { onSnapshot } = await import('firebase/firestore');
      onSnapshot.mockImplementation((_query, callback) => {
        callback(createMockQuerySnap(snapshotData));
        return mockUnsubscribe;
      });
    },
    // Call this to wire up onSnapshot for a single document
    async setupOnSnapshotDoc(data, id = 'doc-1') {
      const { onSnapshot } = await import('firebase/firestore');
      onSnapshot.mockImplementation((_ref, callback) => {
        callback(createMockDocSnap(data, id));
        return mockUnsubscribe;
      });
    },
  };
}

// ── Context mock factories ─────────────────────────────────────────────────

export function createMockUser(overrides = {}) {
  return {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    ...overrides,
  };
}

export function createMockAuthContext(overrides = {}) {
  return {
    user: createMockUser(),
    loading: false,
    handleLogout: vi.fn(),
    ...overrides,
  };
}

export function createMockFirebaseContext(overrides = {}) {
  return {
    db: {},
    appId: 'test-app-id',
    auth: {},
    storage: {},
    ...overrides,
  };
}
