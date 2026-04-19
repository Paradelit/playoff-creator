import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUser = { uid: 'u1' };
const mockDb = {};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: mockDb, appId: 'app1' }),
}));

const teamsMock = { teams: [{ id: 't1' }, { id: 't2' }], loading: false };
vi.mock('./useTeams', () => ({
  useTeams: () => teamsMock,
}));

const subscribeToTrainings = vi.fn();
vi.mock('../services/trainingsService', () => ({
  subscribeToTrainings: (...args) => subscribeToTrainings(...args),
}));

import { useAllTrainings } from './useAllTrainings';

beforeEach(() => {
  subscribeToTrainings.mockReset();
});

describe('useAllTrainings', () => {
  it('fans out subscriptions per team and aggregates into allTrainings', () => {
    subscribeToTrainings.mockImplementation((teamId, _uid, _db, _appId, cb) => {
      cb([{ id: `${teamId}-tr1` }, { id: `${teamId}-tr2` }]);
      return vi.fn();
    });
    const { result } = renderHook(() => useAllTrainings());
    expect(subscribeToTrainings).toHaveBeenCalledTimes(2);
    expect(result.current.allTrainings).toHaveLength(4);
    const ids = result.current.allTrainings.map((t) => t.id).sort();
    expect(ids).toEqual(['t1-tr1', 't1-tr2', 't2-tr1', 't2-tr2']);
    expect(result.current.trainingsByTeam.t1).toHaveLength(2);
    expect(result.current.trainingsByTeam.t2).toHaveLength(2);
  });

  it('unsubscribes on unmount', () => {
    const unsubs = [vi.fn(), vi.fn()];
    let i = 0;
    subscribeToTrainings.mockImplementation((_teamId, _uid, _db, _appId, cb) => {
      cb([]);
      return unsubs[i++];
    });
    const { unmount } = renderHook(() => useAllTrainings());
    unmount();
    expect(unsubs[0]).toHaveBeenCalled();
    expect(unsubs[1]).toHaveBeenCalled();
  });
});
