import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';

/**
 * Subscribe to all teams for the current user.
 * Returns { teams, loading }.
 */
export function useTeams() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, (data) => {
      setTeams(data);
      setLoading(false);
    });
  }, [user, db, appId]);

  return { teams, loading };
}
