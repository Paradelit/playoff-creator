import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUser = { uid: 'u1' };
const mockDb = {};
const mockUnsubscribe = vi.fn();
const mockUseAuth = vi.fn(() => ({ user: mockUser }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: mockDb, appId: 'app1' }),
}));

vi.mock('../services/calendarService', () => ({
  subscribeToAllTrainingSessions: vi.fn((_uid, _db, _appId, _start, _end, callback) => {
    callback([
      { id: 's3', teamId: 'tA', fecha: '2025-10-15', horaInicio: '10:00' },
      { id: 's1', teamId: 'tA', fecha: '2025-10-01', horaInicio: '09:00' },
      { id: 's2', teamId: 'tA', fecha: '2025-10-08', horaInicio: '09:00' },
      { id: 's4', teamId: 'tB', fecha: '2025-10-01', horaInicio: '18:00' },
    ]);
    return mockUnsubscribe;
  }),
}));

vi.mock('../utils/dateUtils', () => ({
  getSeasonDateRange: () => ({ startDate: '2025-09-01', endDate: '2026-06-30' }),
}));

import { useTrainingNumbers } from './useTrainingNumbers';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: mockUser });
});

describe('useTrainingNumbers', () => {
  it('assigns chronological numbers per team', () => {
    const { result } = renderHook(() => useTrainingNumbers());
    const map = result.current;
    // Team A: s1 (Oct 1) → 1, s2 (Oct 8) → 2, s3 (Oct 15) → 3
    expect(map.get('s1')).toBe(1);
    expect(map.get('s2')).toBe(2);
    expect(map.get('s3')).toBe(3);
    // Team B: s4 → 1 (its own sequence)
    expect(map.get('s4')).toBe(1);
  });

  it('returns empty map when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useTrainingNumbers());
    expect(result.current.size).toBe(0);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTrainingNumbers());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
