import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUser = { uid: 'u1' };
const mockDb = {};
const mockUnsubscribe = vi.fn();
const mockUseAuth = vi.fn(() => ({ user: mockUser }));
const mockUseWorkspace = vi.fn(() => ({ activeWsId: 'ws1' }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: mockDb, appId: 'app1' }),
}));

vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: (...args) => mockUseWorkspace(...args),
}));

vi.mock('../services/teamsService', () => ({
  subscribeToTeams: vi.fn((_wsId, _db, _appId, callback) => {
    callback([
      { id: 't1', categoria: 'Infantil' },
      { id: 't2', categoria: 'Cadete' },
    ]);
    return mockUnsubscribe;
  }),
}));

import { subscribeToTeams } from '../services/teamsService';
import { useTeams } from './useTeams';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: mockUser });
  mockUseWorkspace.mockReturnValue({ activeWsId: 'ws1' });
});

describe('useTeams', () => {
  it('returns teams and loading=false after subscription fires', () => {
    const { result } = renderHook(() => useTeams());
    expect(result.current.teams).toHaveLength(2);
    expect(result.current.teams[0].categoria).toBe('Infantil');
    expect(result.current.loading).toBe(false);
  });

  it('returns empty teams when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useTeams());
    expect(result.current.teams).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(subscribeToTeams).not.toHaveBeenCalled();
  });

  it('returns empty teams when no active workspace', () => {
    mockUseWorkspace.mockReturnValue({ activeWsId: null });
    const { result } = renderHook(() => useTeams());
    expect(result.current.teams).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(subscribeToTeams).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTeams());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
