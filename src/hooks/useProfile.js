import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToProfile } from '../services/settingsService';
import { useFirestoreSubscription } from './useFirestoreSubscription';

/**
 * Subscribe to the current user's profile.
 * Returns { profile, loading }.
 */
export function useProfile() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const subscribeFn = useCallback((cb) => subscribeToProfile(user.uid, db, appId, cb), [user, db, appId]);

  const { data: profile, loading } = useFirestoreSubscription(user && db ? subscribeFn : null, {
    initialData: {},
  });

  return { profile, loading };
}
