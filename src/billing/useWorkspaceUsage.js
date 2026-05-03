// src/billing/useWorkspaceUsage.js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';
import { FREE_QUOTA, FREE_QUOTA_WARNING_THRESHOLD } from './constants';
import { currentMonthId } from './currentMonthId';

/**
 * @typedef {Object} UseWorkspaceUsageResult
 * @property {number} count
 * @property {number} limit
 * @property {number} percentage - capped at 100
 * @property {boolean} isAtCap
 * @property {boolean} isNearCap
 * @property {string} monthId
 * @property {boolean} loading
 */

/**
 * @param {string | null} wsId
 * @returns {UseWorkspaceUsageResult}
 */
export function useWorkspaceUsage(wsId) {
  const { db, appId } = useFirebase();
  const monthId = currentMonthId();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !db || !appId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', wsId, 'usage', monthId);
    const unsub = onSnapshot(ref, (snap) => {
      setCount(snap.exists() ? (snap.data()?.count ?? 0) : 0);
      setLoading(false);
    });
    return unsub;
  }, [db, appId, wsId, monthId]);

  const percentage = Math.min(100, Math.round((count / FREE_QUOTA) * 100));
  const isNearCap = count >= FREE_QUOTA * FREE_QUOTA_WARNING_THRESHOLD;
  const isAtCap = count >= FREE_QUOTA;

  return {
    count,
    limit: FREE_QUOTA,
    percentage,
    isAtCap,
    isNearCap,
    monthId,
    loading,
  };
}
