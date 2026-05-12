import { useEffect, useState, useMemo, useCallback } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTeams } from './useTeams';
import { useTrainingNumbers } from './useTrainingNumbers';
import { subscribeToCalendarSessions } from '../services/calendarService';
import { workspaceColRef } from '../services/firestoreHelpers';
import { buildPlayoffSessions } from '../utils/calendarUtils';
import { toYMD } from '../utils/dateUtils';
import { mergeBracketsWithPrevious, useSharedBracketSubscriptions } from './useSharedBrackets';

function getDateRange(date, mode) {
  if (mode === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);
    return [toYMD(start), toYMD(end)];
  }
  if (mode === 'week') {
    const monday = getMonday(date);
    const start = new Date(monday);
    start.setDate(monday.getDate() - 7);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 13);
    return [toYMD(start), toYMD(end)];
  }
  const start = new Date(date);
  start.setDate(date.getDate() - 1);
  const end = new Date(date);
  end.setDate(date.getDate() + 1);
  return [toYMD(start), toYMD(end)];
}

export function getMonday(date) {
  const d = new Date(date);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useCalendarSessions(currentDate, viewMode) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId, activeWorkspace, activeMember } = useWorkspace();
  const { teams } = useTeams();
  const trainingNumbers = useTrainingNumbers();

  const [sessions, setSessions] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loadedSubscriptionKey, setLoadedSubscriptionKey] = useState('');
  const [start, end] = useMemo(() => getDateRange(currentDate, viewMode), [currentDate, viewMode]);

  const isOwner = !!user && !!activeWorkspace && activeWorkspace.ownerId === user.uid;
  const rawIds = activeMember?.assignedTeamIds;
  const assignedKey = Array.isArray(rawIds) ? rawIds.join(',') : '';

  // Sub-4: el caller necesita activeMember resuelto si NO es owner para evitar
  // queries collection-wide que fallan con permission-denied.
  const ready = !!user && !!db && !!activeWsId && !!activeWorkspace && (isOwner || !!activeMember);

  const subscriptionKey = `${user?.uid || 'guest'}:${activeWsId || 'no-ws'}:${appId}:${start}:${end}:${isOwner ? 'all' : assignedKey || 'none'}`;
  const loading = ready && loadedSubscriptionKey !== subscriptionKey;

  const mergeBracketSnapshot = useCallback(
    (fetchedBrackets, previousBrackets) =>
      mergeBracketsWithPrevious(fetchedBrackets, previousBrackets, (bracket, existing) => {
        if (!bracket.shareCode) return bracket;
        return { ...bracket, bracketData: existing.bracketData || bracket.bracketData };
      }),
    [],
  );
  const handleSharedSnapshot = useCallback((code, data) => {
    setBrackets((prev) =>
      prev.map((bracket) => (bracket.shareCode === code ? { ...bracket, bracketData: data.bracketData } : bracket)),
    );
  }, []);

  // Subscribe to workspace bracket docs
  useEffect(() => {
    if (!ready) return undefined;
    let q = workspaceColRef(db, appId, activeWsId, 'brackets');
    if (!isOwner) {
      const ids = assignedKey ? assignedKey.split(',') : [];
      if (ids.length === 0) {
        // Non-owner sin assignments → no subscribir, brackets queda en [].
        setBrackets([]);
        return undefined;
      }
      q = query(q, where('teamId', 'in', ids));
    }
    return onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        setBrackets((prev) => mergeBracketSnapshot(fetched, prev));
      },
      (err) => {
        console.error('[useCalendarSessions] brackets subscription error', err);
        setBrackets([]);
      },
    );
  }, [appId, db, mergeBracketSnapshot, user, activeWsId, ready, isOwner, assignedKey]);

  const shareCodes = useMemo(() => brackets.filter((b) => b.shareCode).map((b) => b.shareCode), [brackets]);
  useSharedBracketSubscriptions({ db, appId, shareCodes, onSharedSnapshot: handleSharedSnapshot });

  useEffect(() => {
    if (!ready) return undefined;
    const scope = isOwner
      ? { scope: 'all' }
      : { scope: 'assigned', assignedTeamIds: assignedKey ? assignedKey.split(',') : [] };
    return subscribeToCalendarSessions(
      activeWsId,
      db,
      appId,
      start,
      end,
      (data) => {
        setSessions(data);
        setLoadedSubscriptionKey(subscriptionKey);
      },
      scope,
      () => {
        // Aún en error, marcar la subscription como "resuelta" para que la UI no
        // se quede cargando indefinidamente. Mostrará lista vacía.
        setLoadedSubscriptionKey(subscriptionKey);
      },
    );
  }, [appId, db, end, start, subscriptionKey, user, activeWsId, ready, isOwner, assignedKey]);

  const playoffSessions = useMemo(() => buildPlayoffSessions(brackets, teams), [brackets, teams]);
  const teamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const allSessions = useMemo(
    () => [...sessions, ...playoffSessions].filter((s) => !s.teamId || teamIds.has(s.teamId)),
    [sessions, playoffSessions, teamIds],
  );

  function getTrainingNum(session) {
    return trainingNumbers.get(session.id) ?? session.sessionNumber;
  }

  return { sessions: allSessions, loading, teams, getTrainingNum };
}
