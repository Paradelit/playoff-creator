import { useEffect, useState, useMemo } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useTeams } from './useTeams';
import { useTrainingNumbers } from './useTrainingNumbers';
import { subscribeToCalendarSessions } from '../services/calendarService';
import { userColRef } from '../services/firestoreHelpers';
import { buildPlayoffSessions } from '../utils/calendarUtils';
import { toYMD } from '../utils/dateUtils';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(userColRef(db, appId, user.uid, 'brackets'), (snap) => {
      setBrackets(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    const [start, end] = getDateRange(currentDate, viewMode);
    setLoading(true);
    return subscribeToCalendarSessions(user.uid, db, appId, start, end, (data) => {
      setSessions(data);
      setLoading(false);
    });
  }, [user, db, appId, currentDate, viewMode]);

  const playoffSessions = useMemo(() => buildPlayoffSessions(brackets, teams), [brackets, teams]);
  const allSessions = useMemo(() => [...sessions, ...playoffSessions], [sessions, playoffSessions]);

  function getTrainingNum(session) {
    return trainingNumbers.get(session.id) ?? session.sessionNumber;
  }

  return { sessions: allSessions, loading, teams, getTrainingNum };
}
