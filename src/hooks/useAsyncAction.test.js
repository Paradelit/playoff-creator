import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncAction } from './useAsyncAction';

describe('useAsyncAction', () => {
  it('starts with loading=false and error=null', () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading=true during execution', async () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });

    const { result } = renderHook(() => useAsyncAction());

    let runPromise;
    act(() => {
      runPromise = result.current.run(() => promise);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolve('done');
      await runPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('returns the result of the async function', async () => {
    const { result } = renderHook(() => useAsyncAction());

    let value;
    await act(async () => {
      value = await result.current.run(async () => 42);
    });

    expect(value).toBe(42);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure and re-throws', async () => {
    const { result } = renderHook(() => useAsyncAction());
    const err = new Error('boom');

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw err;
        }),
      ).rejects.toThrow('boom');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(err);
  });

  it('clears error on next run', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current
        .run(async () => {
          throw new Error('first');
        })
        .catch(() => {});
    });
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.run(async () => 'ok');
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=false even if the function throws', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current
        .run(async () => {
          throw new Error('fail');
        })
        .catch(() => {});
    });

    expect(result.current.loading).toBe(false);
  });
});
