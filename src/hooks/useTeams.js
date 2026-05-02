import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { subscribeToTeams } from '../services/teamsService';
import { useFirestoreSubscription } from './useFirestoreSubscription';

/**
 * Subscribe to all teams for the active workspace.
 * Returns { teams, loading }.
 */
export function useTeams() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();

  const subscribeFn = useCallback((cb) => subscribeToTeams(activeWsId, db, appId, cb), [activeWsId, db, appId]);

  const { data: teams, loading } = useFirestoreSubscription(user && db && activeWsId ? subscribeFn : null);

  return { teams, loading };
}
