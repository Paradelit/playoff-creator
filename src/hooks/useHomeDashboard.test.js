import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUser = { uid: 'u1', displayName: 'Coach', isAnonymous: false };
const mockDb = {};
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, handleLogout: vi.fn() }),
}));

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: mockDb, appId: 'app1' }),
}));

vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ activeWsId: 'ws1', memberships: [], isLoading: false }),
}));

vi.mock('./useTeams', () => ({
  useTeams: () => ({
    teams: [{ id: 't1', categoria: 'Infantil' }],
    loading: false,
  }),
}));

vi.mock('./useTrainingNumbers', () => ({
  useTrainingNumbers: () => new Map(),
}));

vi.mock('../services/calendarService', () => ({
  subscribeToCalendarSessions: vi.fn((_wsId, _db, _appId, _start, _end, callback) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayYMD = `${yyyy}-${mm}-${dd}`;
    callback([
      {
        id: 's1',
        teamId: 't1',
        fecha: todayYMD,
        tipo: 'entrenamiento',
        horaInicio: '10:00',
        teamName: 'Infantil',
        sessionNumber: 1,
      },
    ]);
    return vi.fn();
  }),
  linkTrainingToSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/firestoreHelpers', () => ({
  workspaceColRef: vi.fn(() => 'mock-ws-col-ref'),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn((_ref, callback) => {
    callback({ docs: [] });
    return vi.fn();
  }),
}));

vi.mock('../utils/calendarUtils', () => ({
  buildPlayoffSessions: () => [],
}));

vi.mock('./useReminders', () => ({
  useReminders: () => {},
}));

vi.mock('../services/trainingsService', () => ({
  saveTraining: vi.fn(() => Promise.resolve()),
  subscribeToExercises: vi.fn((_wsId, _db, _appId, callback) => {
    callback([]);
    return vi.fn();
  }),
  subscribeToTrainings: vi.fn((_teamId, _wsId, _db, _appId, callback) => {
    callback([]);
    return vi.fn();
  }),
}));

vi.mock('../services/teamsService', () => ({
  subscribeToAllMembers: vi.fn((_teams, _wsId, _db, _appId, callback) => {
    callback([]);
    return vi.fn();
  }),
}));

import { useHomeDashboard } from './useHomeDashboard';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useHomeDashboard', () => {
  it('returns today events', () => {
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.todayEvents).toHaveLength(1);
    expect(result.current.todayEvents[0].id).toBe('s1');
  });

  it('returns teams and loading state', () => {
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.teams).toHaveLength(1);
    expect(result.current.loadingTeams).toBe(false);
  });

  it('provides handleEventAction callback', () => {
    const { result } = renderHook(() => useHomeDashboard());
    expect(typeof result.current.handleEventAction).toBe('function');
  });

  it('weeklySummary counts sessions in current week', () => {
    const { result } = renderHook(() => useHomeDashboard());
    // The mock session has today's date, so should be in current week
    expect(result.current.weeklySummary.total).toBeGreaterThanOrEqual(1);
    expect(result.current.weeklySummary.entrenamientos).toBeGreaterThanOrEqual(1);
  });

  it('returns the upcoming session as nextActionEvent', () => {
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.nextActionEvent).toBeTruthy();
    expect(result.current.nextActionEvent.id).toBe('s1');
  });

  it('flags today training without trainingId as pending', () => {
    const { result } = renderHook(() => useHomeDashboard());
    const pend = result.current.pendingActions;
    expect(pend.length).toBeGreaterThanOrEqual(1);
    expect(pend.some((p) => p.type === 'training')).toBe(true);
  });

  it('exposes a 7-day weekStrip', () => {
    const { result } = renderHook(() => useHomeDashboard());
    expect(result.current.weekStrip).toHaveLength(7);
    expect(result.current.weekStrip[0].label).toBe('L');
  });
});
