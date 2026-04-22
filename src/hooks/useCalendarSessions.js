import { useEffect, useState, useMemo, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useTeams } from './useTeams';
import { useTrainingNumbers } from './useTrainingNumbers';
import { subscribeToCalendarSessions } from '../services/calendarService';
import { userColRef } from '../services/firestoreHelpers';
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
  const { teams } = useTeams();
  const trainingNumbers = useTrainingNumbers();

  const [sessions, setSessions] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loadedSubscriptionKey, setLoadedSubscriptionKey] = useState('');
  const [start, end] = useMemo(() => getDateRange(currentDate, viewMode), [currentDate, viewMode]);
  const subscriptionKey = `${user?.uid || 'guest'}:${appId}:${start}:${end}`;
  const loading = Boolean(user && db) && loadedSubscriptionKey !== subscriptionKey;
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

  // Subscribe to user bracket docs
  useEffect(() => {
    if (!user || !db) return undefined;
    return onSnapshot(userColRef(db, appId, user.uid, 'brackets'), (snap) => {
      const fetched = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      setBrackets((prev) => mergeBracketSnapshot(fetched, prev));
    });
  }, [appId, db, mergeBracketSnapshot, user]);

  const shareCodes = useMemo(() => brackets.filter((b) => b.shareCode).map((b) => b.shareCode), [brackets]);
  useSharedBracketSubscriptions({ db, appId, shareCodes, onSharedSnapshot: handleSharedSnapshot });

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToCalendarSessions(user.uid, db, appId, start, end, (data) => {
      setSessions(data);
      setLoadedSubscriptionKey(subscriptionKey);
    });
  }, [appId, db, end, start, subscriptionKey, user]);

  const playoffSessions = useMemo(() => buildPlayoffSessions(brackets, teams), [brackets, teams]);
  const allSessions = useMemo(() => [...sessions, ...playoffSessions], [sessions, playoffSessions]);

  function getTrainingNum(session) {
    return trainingNumbers.get(session.id) ?? session.sessionNumber;
  }

  return { sessions: allSessions, loading, teams, getTrainingNum };
}
