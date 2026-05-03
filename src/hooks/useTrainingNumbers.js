import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { subscribeToAllTrainingSessions } from '../services/calendarService';
import { getSeasonDateRange } from '../utils/dateUtils';

/**
 * Subscribes to all entrenamiento sessions for the current season and computes
 * chronological training numbers per team (sorted by fecha, then horaInicio).
 * Returns a Map<sessionId, number>.
 */
export function useTrainingNumbers() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const [numberMap, setNumberMap] = useState(new Map());

  useEffect(() => {
    if (!user || !db || !activeWsId) return;
    const { startDate, endDate } = getSeasonDateRange();
    return subscribeToAllTrainingSessions(activeWsId, db, appId, startDate, endDate, (sessions) => {
      const map = new Map();
      const byTeam = {};
      for (const s of sessions) {
        if (!s.teamId) continue;
        if (!byTeam[s.teamId]) byTeam[s.teamId] = [];
        byTeam[s.teamId].push(s);
      }
      for (const teamId of Object.keys(byTeam)) {
        byTeam[teamId]
          .sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
            return (a.horaInicio || '') < (b.horaInicio || '') ? -1 : 1;
          })
          .forEach((s, i) => map.set(s.id, i + 1));
      }
      setNumberMap(map);
    });
  }, [user, db, appId, activeWsId]);

  return numberMap;
}
