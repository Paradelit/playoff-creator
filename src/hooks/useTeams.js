import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { useFirestoreSubscription } from './useFirestoreSubscription';

/**
 * Subscribe to all teams for the current user.
 * Returns { teams, loading }.
 */
export function useTeams() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const subscribeFn = useCallback((cb) => subscribeToTeams(user.uid, db, appId, cb), [user, db, appId]);

  const { data: teams, loading } = useFirestoreSubscription(user && db ? subscribeFn : null);

  return { teams, loading };
}
