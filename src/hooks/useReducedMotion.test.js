import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setReducedMotion } from '../test/landingHelpers';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  it('tracks the prefers-reduced-motion media query', () => {
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);

    act(() => {
      setReducedMotion(true);
    });

    expect(result.current).toBe(true);

    act(() => {
      setReducedMotion(false);
    });

    expect(result.current).toBe(false);
  });
});
