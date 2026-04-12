import { useState, useCallback, useRef } from 'react';

/**
 * Hook for the common async loading/error pattern.
 *
 * Replaces pairs of `const [loading, setLoading] = useState(false)` +
 * try/catch/finally that repeat across the codebase.
 *
 * @returns {{ run: (fn: () => Promise<*>) => Promise<*>, loading: boolean, error: Error|null }}
 *
 * @example
 * const save = useAsyncAction();
 * // in handler:
 * await save.run(() => saveSession(data));
 * // in JSX:
 * <button disabled={save.loading}>Guardar</button>
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  // Track unmount to avoid setState on unmounted component
  useState(() => {
    return () => {
      mountedRef.current = false;
    };
  });

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err);
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  return { run, loading, error };
}
