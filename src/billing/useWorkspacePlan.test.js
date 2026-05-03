// src/billing/useWorkspacePlan.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: {}, appId: 'test-app' }),
}));

import { useWorkspacePlan } from './useWorkspacePlan';

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper: renders the hook, captures the onSnapshot callback, then fires it
 * inside act() so React can flush state updates synchronously.
 */
function renderPlan(wsId, snapData) {
  let capturedCb;
  vi.mocked(onSnapshot).mockImplementation((_ref, cb) => {
    capturedCb = cb;
    return () => {};
  });
  const { result } = renderHook(() => useWorkspacePlan(wsId));
  act(() => {
    capturedCb(snapData);
  });
  return result;
}

describe('useWorkspacePlan', () => {
  it("returns plan='free' and isPro=false when doc is free", () => {
    const result = renderPlan('ws-1', {
      exists: () => true,
      data: () => ({ plan: 'free', billing: null }),
    });
    expect(result.current.plan).toBe('free');
    expect(result.current.isPro).toBe(false);
    expect(result.current.isPastDue).toBe(false);
    expect(result.current.billing).toBeNull();
  });

  it("returns plan='pro' and isPro=true when doc is pro", () => {
    const result = renderPlan('ws-1', {
      exists: () => true,
      data: () => ({
        plan: 'pro',
        billing: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null },
      }),
    });
    expect(result.current.isPro).toBe(true);
    expect(result.current.plan).toBe('pro');
  });

  it('returns isPastDue=true when billing.status is past_due', () => {
    const result = renderPlan('ws-1', {
      exists: () => true,
      data: () => ({ plan: 'pro', billing: { status: 'past_due' } }),
    });
    expect(result.current.isPastDue).toBe(true);
  });
});
