import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirestoreSubscription } from './useFirestoreSubscription';

describe('useFirestoreSubscription', () => {
  it('starts with loading=true and initialData', () => {
    const subscribeFn = vi.fn(() => vi.fn());
    const { result } = renderHook(() => useFirestoreSubscription(subscribeFn, { initialData: [] }));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('calls subscribeFn and sets data when callback fires', () => {
    const unsub = vi.fn();
    const subscribeFn = vi.fn((cb) => {
      cb([{ id: '1' }, { id: '2' }]);
      return unsub;
    });

    const { result } = renderHook(() => useFirestoreSubscription(subscribeFn));
    expect(result.current.data).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.loading).toBe(false);
    expect(subscribeFn).toHaveBeenCalledOnce();
  });

  it('returns unsubscribe on unmount', () => {
    const unsub = vi.fn();
    const subscribeFn = vi.fn(() => unsub);

    const { unmount } = renderHook(() => useFirestoreSubscription(subscribeFn));
    unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('skips subscription and clears loading when subscribeFn is null', () => {
    const { result } = renderHook(() => useFirestoreSubscription(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it('uses custom initialData', () => {
    const { result } = renderHook(() => useFirestoreSubscription(null, { initialData: { name: 'test' } }));
    expect(result.current.data).toEqual({ name: 'test' });
  });

  it('re-subscribes when subscribeFn changes', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    const fn1 = vi.fn((cb) => {
      cb('data1');
      return unsub1;
    });
    const fn2 = vi.fn((cb) => {
      cb('data2');
      return unsub2;
    });

    const { result, rerender } = renderHook(({ fn }) => useFirestoreSubscription(fn), {
      initialProps: { fn: fn1 },
    });
    expect(result.current.data).toBe('data1');

    rerender({ fn: fn2 });
    expect(unsub1).toHaveBeenCalledOnce();
    expect(result.current.data).toBe('data2');
  });

  it('sets error if subscribeFn throws synchronously', () => {
    const error = new Error('subscribe failed');
    const subscribeFn = vi.fn(() => {
      throw error;
    });

    const { result } = renderHook(() => useFirestoreSubscription(subscribeFn));
    expect(result.current.error).toBe(error);
    expect(result.current.loading).toBe(false);
  });

  it('handles multiple data updates', () => {
    let callback;
    const subscribeFn = vi.fn((cb) => {
      callback = cb;
      cb([]);
      return vi.fn();
    });

    const { result } = renderHook(() => useFirestoreSubscription(subscribeFn));
    expect(result.current.data).toEqual([]);

    act(() => callback([{ id: '1' }]));
    expect(result.current.data).toEqual([{ id: '1' }]);

    act(() => callback([{ id: '1' }, { id: '2' }]));
    expect(result.current.data).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
