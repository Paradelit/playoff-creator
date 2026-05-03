// src/billing/useWorkspacePlan.js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';

/**
 * @typedef {import('./types').WorkspacePlan} WorkspacePlan
 * @typedef {import('./types').WorkspaceBilling} WorkspaceBilling
 */

/**
 * @typedef {Object} UseWorkspacePlanResult
 * @property {WorkspacePlan} plan
 * @property {WorkspaceBilling | null} billing
 * @property {boolean} isPro
 * @property {boolean} isPastDue
 * @property {boolean} cancelAtPeriodEnd
 * @property {Date | null} currentPeriodEnd
 * @property {boolean} loading
 */

/**
 * @param {string | null} wsId
 * @returns {UseWorkspacePlanResult}
 */
export function useWorkspacePlan(wsId) {
  const { db, appId } = useFirebase();
  const [data, setData] = useState({ plan: 'free', billing: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !db || !appId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', wsId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setData({ plan: 'free', billing: null });
      } else {
        const d = snap.data();
        setData({
          plan: d.plan ?? 'free',
          billing: d.billing ?? null,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [db, appId, wsId]);

  return {
    plan: data.plan,
    billing: data.billing,
    isPro: data.plan === 'pro',
    isPastDue: data.billing?.status === 'past_due',
    cancelAtPeriodEnd: data.billing?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: data.billing?.currentPeriodEnd?.toDate?.() ?? null,
    loading,
  };
}
