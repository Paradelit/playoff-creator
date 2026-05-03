// src/billing/useWorkspaceUsage.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: {}, appId: 'test-app' }),
}));

vi.mock('./currentMonthId', () => ({
  currentMonthId: () => '2026-05',
}));

import { useWorkspaceUsage } from './useWorkspaceUsage';

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper: renders the hook, captures the onSnapshot callback, then fires it
 * inside act() so React can flush state updates synchronously.
 */
function renderUsage(wsId, snapData) {
  let capturedCb;
  vi.mocked(onSnapshot).mockImplementation((_ref, cb) => {
    capturedCb = cb;
    return () => {};
  });
  const { result } = renderHook(() => useWorkspaceUsage(wsId));
  act(() => {
    capturedCb(snapData);
  });
  return result;
}

describe('useWorkspaceUsage', () => {
  it('returns count=0 when doc does not exist', () => {
    const result = renderUsage('ws-1', { exists: () => false, data: () => undefined });
    expect(result.current.loading).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.limit).toBe(50);
    expect(result.current.percentage).toBe(0);
    expect(result.current.isAtCap).toBe(false);
    expect(result.current.isNearCap).toBe(false);
  });

  it('returns count=32, percentage=64, isNearCap=false', () => {
    const result = renderUsage('ws-1', {
      exists: () => true,
      data: () => ({ count: 32, monthId: '2026-05' }),
    });
    expect(result.current.count).toBe(32);
    expect(result.current.percentage).toBe(64);
    expect(result.current.isNearCap).toBe(false);
  });

  it('returns isNearCap=true when count >= 40 (80% of 50)', () => {
    const result = renderUsage('ws-1', {
      exists: () => true,
      data: () => ({ count: 40, monthId: '2026-05' }),
    });
    expect(result.current.isNearCap).toBe(true);
    expect(result.current.isAtCap).toBe(false);
  });

  it('returns isAtCap=true when count >= 50', () => {
    const result = renderUsage('ws-1', {
      exists: () => true,
      data: () => ({ count: 50, monthId: '2026-05' }),
    });
    expect(result.current.isAtCap).toBe(true);
  });

  it('caps percentage at 100 when count > limit', () => {
    const result = renderUsage('ws-1', {
      exists: () => true,
      data: () => ({ count: 75, monthId: '2026-05' }),
    });
    expect(result.current.percentage).toBe(100);
  });
});
