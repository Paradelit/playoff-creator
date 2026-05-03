import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { subscribeToTrainings } from '../services/trainingsService';
import { useTeams } from './useTeams';

/**
 * Subscribes to trainings for every team the user has. Returns both a per-team
 * map and a flat list, plus loading state.
 *
 * Shared by useHomeDashboard (news feed, recent exercises) and the Biblioteca
 * screen (recently-used / trending insights) so listeners are not duplicated.
 */
export function useAllTrainings() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const { teams, loading: loadingTeams } = useTeams();
  const [trainingsByTeam, setTrainingsByTeam] = useState({});
  const [ready, setReady] = useState(false);

  const teamIdsKey = useMemo(
    () =>
      teams
        .map((t) => t.id)
        .sort()
        .join('|'),
    [teams],
  );

  useEffect(() => {
    if (!user || !db || !activeWsId) return undefined;
    if (teams.length === 0) {
      setTrainingsByTeam({});
      setReady(true);
      return undefined;
    }
    setReady(false);
    const received = new Set();
    const unsubs = teams.map((team) =>
      subscribeToTrainings(team.id, activeWsId, db, appId, (list) => {
        received.add(team.id);
        setTrainingsByTeam((prev) => ({ ...prev, [team.id]: list }));
        if (received.size === teams.length) setReady(true);
      }),
    );
    return () => {
      unsubs.forEach((u) => u && u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, appId, activeWsId, teamIdsKey]);

  const allTrainings = useMemo(() => {
    const out = [];
    for (const list of Object.values(trainingsByTeam)) {
      if (Array.isArray(list)) out.push(...list);
    }
    return out;
  }, [trainingsByTeam]);

  return {
    trainingsByTeam,
    allTrainings,
    loading: loadingTeams || (teams.length > 0 && !ready),
  };
}
