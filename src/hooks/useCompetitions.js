import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { subscribeToCompetitions } from '../services/competitionsService';

export function useCompetitions(teamId) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !teamId || !activeWsId) {
      setCompetitions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToCompetitions(teamId, activeWsId, db, appId, (list) => {
      setCompetitions(list);
      setLoading(false);
    });
    return unsub;
  }, [user, db, appId, activeWsId, teamId]);

  return { competitions, loading };
}
