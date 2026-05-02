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

vi.mock('../services/settingsService', () => ({
  subscribeToProfile: vi.fn((_uid, _db, _appId, callback) => {
    callback({ nombre: 'Coach Test', rol: 'Entrenador' });
    return mockUnsubscribe;
  }),
}));

import { subscribeToProfile } from '../services/settingsService';
import { useProfile } from './useProfile';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: mockUser });
});

describe('useProfile', () => {
  it('returns profile data after subscription fires', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({ nombre: 'Coach Test', rol: 'Entrenador' });
    expect(result.current.loading).toBe(false);
  });

  it('returns empty profile when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(subscribeToProfile).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useProfile());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
