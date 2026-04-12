import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUser = { uid: 'u1', displayName: 'Coach', email: 'coach@test.com' };
const mockDb = {};
const mockUnsubscribe = vi.fn();
const mockToast = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: mockDb, appId: 'app1' }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

const mockSaveExercise = vi.fn(() => Promise.resolve());
const mockDeleteExercise = vi.fn(() => Promise.resolve());
const mockPropagateUpdate = vi.fn(() => Promise.resolve());

vi.mock('../services/trainingsService', () => ({
  subscribeToExercises: vi.fn((_uid, _db, _appId, callback) => {
    callback([
      { id: 'ex1', nombre: 'Tiro libre', tags: ['tiro'] },
      { id: 'ex2', nombre: 'Pase y corte', tags: ['pase'] },
    ]);
    return mockUnsubscribe;
  }),
  saveExercise: (...args) => mockSaveExercise(...args),
  deleteExercise: (...args) => mockDeleteExercise(...args),
  propagateExerciseUpdate: (...args) => mockPropagateUpdate(...args),
}));

vi.mock('../services/exerciseSharingService', () => ({
  shareExercise: vi.fn(() => Promise.resolve('abc123')),
}));

import { useExerciseLibrary } from './useExerciseLibrary';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useExerciseLibrary', () => {
  it('loads exercises from subscription', () => {
    const { result } = renderHook(() => useExerciseLibrary());
    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('handleSave calls saveExercise with trimmed name and UUID', async () => {
    const { result } = renderHook(() => useExerciseLibrary());
    await act(async () => {
      await result.current.handleSave({ nombre: '  Test  ', pasos: [] });
    });
    expect(mockSaveExercise).toHaveBeenCalledTimes(1);
    const saved = mockSaveExercise.mock.calls[0][0];
    expect(saved.nombre).toBe('Test');
    expect(saved.id).toBeDefined();
  });

  it('handleSave propagates update for existing exercises', async () => {
    const { result } = renderHook(() => useExerciseLibrary());
    await act(async () => {
      await result.current.handleSave({ id: 'ex1', nombre: 'Updated', pasos: [] });
    });
    expect(mockPropagateUpdate).toHaveBeenCalledTimes(1);
  });

  it('handleDelete deletes exercise', async () => {
    const { result } = renderHook(() => useExerciseLibrary());
    await act(async () => {
      await result.current.handleDelete('ex1');
    });
    expect(mockDeleteExercise).toHaveBeenCalledWith('ex1', expect.any(Object));
  });

  it('doExport creates a download', () => {
    const { result } = renderHook(() => useExerciseLibrary());
    act(() => {
      result.current.openExport();
    });
    expect(result.current.exportSelected.size).toBe(2);
    // doExport creates a blob and downloads — verify it doesn't throw
    act(() => {
      result.current.doExport();
    });
    expect(result.current.showExport).toBe(false);
  });
});
