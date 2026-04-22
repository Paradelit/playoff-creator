import { useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

export function mergeBracketsWithPrevious(fetchedBrackets, previousBrackets, mergeWithExisting) {
  return fetchedBrackets.map((bracket) => {
    const existing = previousBrackets.find((current) => current.id === bracket.id);
    if (!existing) return bracket;

    const merged = mergeWithExisting?.(bracket, existing);
    return merged ?? bracket;
  });
}

export function useSharedBracketSubscriptions({ db, appId, shareCodes, onSharedSnapshot }) {
  const sharedUnsubscribers = useRef({});
  const unsubscribeShareCode = useCallback((code) => {
    const unsubscribe = sharedUnsubscribers.current[code];
    if (!unsubscribe) return;
    unsubscribe();
    delete sharedUnsubscribers.current[code];
  }, []);

  useEffect(() => {
    if (!db) return undefined;

    const activeCodes = new Set(shareCodes);
    Object.entries(sharedUnsubscribers.current).forEach(([code, unsubscribe]) => {
      if (activeCodes.has(code)) return;
      unsubscribe?.();
      delete sharedUnsubscribers.current[code];
    });

    shareCodes.forEach((code) => {
      if (sharedUnsubscribers.current[code]) return;
      sharedUnsubscribers.current[code] = onSnapshot(doc(db, 'artifacts', appId, 'shared', code), (snap) => {
        if (!snap.exists()) return;
        onSharedSnapshot(code, snap.data());
      });
    });

    return () => {
      Object.values(sharedUnsubscribers.current).forEach((unsubscribe) => unsubscribe?.());
      sharedUnsubscribers.current = {};
    };
  }, [appId, db, onSharedSnapshot, shareCodes]);

  return { sharedUnsubscribers, unsubscribeShareCode };
}
