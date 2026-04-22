import { useEffect, useState } from 'react';

/**
 * Generic hook for Firestore onSnapshot subscriptions with auto cleanup.
 *
 * @param {Function|null} subscribeFn - A function that accepts a callback and returns an unsubscribe function.
 *   Pass `null` to skip subscription (e.g. when deps aren't ready).
 *   Example: `(cb) => subscribeToTeams(uid, db, appId, cb)`
 * @param {Object} [options]
 * @param {*} [options.initialData=[]] - Initial state value before any snapshot fires.
 * @param {Array} [options.deps=[]] - Extra dependencies that trigger re-subscription.
 * @returns {{ data: *, loading: boolean, error: Error|null }}
 */
export function useFirestoreSubscription(subscribeFn, { initialData = [], deps = [] } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subscribeFn) return;

    let unsubscribe;
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });
    try {
      unsubscribe = subscribeFn((result) => {
        setData(result);
        setLoading(false);
      });
    } catch (err) {
      setError(err);
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, [subscribeFn, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
