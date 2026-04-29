import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToCompetitions } from '../services/competitionsService';

export function useCompetitions(teamId) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !teamId) {
      setCompetitions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToCompetitions(teamId, user.uid, db, appId, (list) => {
      setCompetitions(list);
      setLoading(false);
    });
    return unsub;
  }, [user, db, appId, teamId]);

  return { competitions, loading };
}
