import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { saveTraining, subscribeToExercises } from '../services/trainingsService';
import { useTeams } from './useTeams';
import { useAllTrainings } from './useAllTrainings';
import { useExerciseInsights } from './useExerciseInsights';
import { useTrainingNumbers } from './useTrainingNumbers';
import { subscribeToCalendarSessions, linkTrainingToSession } from '../services/calendarService';
import { userColRef } from '../services/firestoreHelpers';
import { teamDisplayName } from '../utils/teamUtils';
import { buildPlayoffSessions } from '../utils/calendarUtils';
import { isMinibasketSextos } from '../utils/minibasketUtils';
import { toYMD } from '../utils/dateUtils';
import { buildPendingActions, buildNewsItems, buildWeekStrip, pickNextAction } from '../utils/homeUtils';
import { useReminders } from './useReminders';
import { mergeBracketsWithPrevious, useSharedBracketSubscriptions } from './useSharedBrackets';

function getExtendedRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 14);
  const end = new Date(now);
  end.setDate(now.getDate() + 14);
  return { startStr: toYMD(start), endStr: toYMD(end) };
}

function findTeamCurrentMatch(bracketData, myTeam) {
  if (!bracketData?.state || !myTeam) return null;
  return Object.values(bracketData.state).find((m) => !m.winner && (m.team1 === myTeam || m.team2 === myTeam));
}

function getSeriesScore(match, myTeam) {
  if (!match?.scores) return null;
  let wins = 0;
  let losses = 0;
  for (const g of match.scores) {
    const s1 = Number(g.s1);
    const s2 = Number(g.s2);
    if (!s1 && !s2) continue;
    const isTeam1 = match.team1 === myTeam;
    if ((isTeam1 && s1 > s2) || (!isTeam1 && s2 > s1)) wins++;
    else if (s1 !== s2) losses++;
  }
  if (!wins && !losses) return null;
  return { wins, losses, total: match.gamesCount || 1 };
}

export function useHomeDashboard() {
  const { user, handleLogout } = useAuth();
  const { db, appId } = useFirebase();
  const navigate = useNavigate();
  const { teams, loading: loadingTeams } = useTeams();
  const trainingNumbers = useTrainingNumbers();
  const { allTrainings } = useAllTrainings();

  const [sessions, setSessions] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [creatingTraining, setCreatingTraining] = useState(null);

  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const { startStr, endStr } = useMemo(() => getExtendedRange(), []);
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

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToCalendarSessions(user.uid, db, appId, startStr, endStr, setSessions);
  }, [user, db, appId, startStr, endStr]);

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
    return subscribeToExercises(user.uid, db, appId, setExercises);
  }, [user, db, appId]);

  const recentExercises = useMemo(() => {
    const timeOf = (ex) => {
      const raw = ex.updatedAt || ex.createdAt;
      if (!raw) return 0;
      if (typeof raw === 'object' && typeof raw.toMillis === 'function') return raw.toMillis();
      if (typeof raw === 'number') return raw;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };
    return [...exercises].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 3);
  }, [exercises]);

  const bibliotecaInsights = useExerciseInsights(exercises, allTrainings, today, { limit: 3 });

  const playoffSessions = useMemo(() => buildPlayoffSessions(brackets, teams), [brackets, teams]);
  const teamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const allSessions = useMemo(
    () => [...sessions, ...playoffSessions].filter((s) => !s.teamId || teamIds.has(s.teamId)),
    [sessions, playoffSessions, teamIds],
  );

  useReminders(allSessions);

  const todayEvents = useMemo(
    () =>
      allSessions
        .filter((s) => s.fecha === todayYMD)
        .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || '')),
    [allSessions, todayYMD],
  );

  const lastEventByTeam = useMemo(() => {
    const past = allSessions
      .filter((s) => s.fecha < todayYMD && s.teamId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.horaInicio || '').localeCompare(a.horaInicio || ''));
    const seen = new Set();
    return past.filter((s) => {
      if (seen.has(s.teamId)) return false;
      seen.add(s.teamId);
      return true;
    });
  }, [allSessions, todayYMD]);

  const nextEventByTeam = useMemo(() => {
    const future = allSessions
      .filter((s) => s.fecha > todayYMD && s.teamId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    const seen = new Set();
    return future.filter((s) => {
      if (seen.has(s.teamId)) return false;
      seen.add(s.teamId);
      return true;
    });
  }, [allSessions, todayYMD]);

  const activePlayoffs = useMemo(() => {
    const teamIds = new Set(teams.map((t) => t.id));
    return brackets
      .filter((b) => b.teamId && teamIds.has(b.teamId) && b.bracketData)
      .map((b) => {
        const match = findTeamCurrentMatch(b.bracketData, b.myTeam);
        const rival = match ? (match.team1 === b.myTeam ? match.team2 : match.team1) : null;
        const series = match ? getSeriesScore(match, b.myTeam) : null;
        const team = teams.find((t) => t.id === b.teamId);
        return {
          id: b.id,
          name: b.name || b.tournamentNameDetected || 'Torneo',
          teamName: team ? teamDisplayName(team) : '',
          teamId: b.teamId,
          match,
          rival,
          series,
          title: match?.title,
        };
      });
  }, [brackets, teams]);

  const tomorrowYMD = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toYMD(d);
  }, [today]);

  const matchDayEvent = useMemo(() => {
    const matches = allSessions.filter(
      (s) => s.tipo === 'partido' && (s.fecha === todayYMD || s.fecha === tomorrowYMD),
    );
    if (matches.length === 0) return null;
    const todayMatch = matches.find((s) => s.fecha === todayYMD);
    if (todayMatch) return todayMatch;
    return matches.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''))[0];
  }, [allSessions, todayYMD, tomorrowYMD]);

  const weeklySummary = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const monYMD = toYMD(monday);
    const sunYMD = toYMD(sunday);
    const weekSessions = allSessions.filter((s) => s.fecha >= monYMD && s.fecha <= sunYMD);
    return {
      entrenamientos: weekSessions.filter((s) => s.tipo === 'entrenamiento').length,
      partidos: weekSessions.filter((s) => s.tipo === 'partido').length,
      playoffs: weekSessions.filter((s) => s.tipo === 'playoff').length,
      total: weekSessions.length,
    };
  }, [allSessions]);

  const nextMatchByTeam = useMemo(() => {
    const map = {};
    const futureMatches = allSessions
      .filter((s) => s.tipo === 'partido' && s.fecha >= todayYMD)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const s of futureMatches) {
      if (!map[s.teamId]) map[s.teamId] = s;
    }
    return map;
  }, [allSessions, todayYMD]);

  const nextActionEvent = useMemo(
    () => pickNextAction(allSessions, todayYMD, matchDayEvent),
    [allSessions, todayYMD, matchDayEvent],
  );

  const pendingActions = useMemo(
    () => buildPendingActions(allSessions, todayYMD, { limit: 6 }),
    [allSessions, todayYMD],
  );

  const newsItems = useMemo(
    () => buildNewsItems({ trainings: allTrainings, exercises, sessions, brackets, now: today, limit: 8 }),
    [allTrainings, exercises, sessions, brackets, today],
  );

  const weekStrip = useMemo(() => buildWeekStrip(allSessions, today), [allSessions, today]);

  const handleCreateTraining = useCallback(
    async (session) => {
      setCreatingTraining(session.id);
      try {
        const trainingId = crypto.randomUUID();
        await saveTraining(
          {
            id: trainingId,
            teamId: session.teamId,
            meta: {
              numero: trainingNumbers.get(session.id) || session.sessionNumber,
              fecha: session.fecha,
              horaInicio: session.horaInicio,
              horaFin: session.horaFin,
              lugar: session.lugar || '',
              dia: '',
              equipo: session.teamName || '',
            },
            objetivos: '',
            ejercicios: [],
            cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
          },
          session.teamId,
          { uid: user.uid, db, appId },
        );
        await linkTrainingToSession(session.id, trainingId, { uid: user.uid, db, appId });
        navigate(`/teams/${session.teamId}/trainings/${trainingId}`);
      } finally {
        setCreatingTraining(null);
      }
    },
    [user, db, appId, navigate, trainingNumbers],
  );

  const handleEventAction = useCallback(
    (session) => {
      if (session.tipo === 'playoff') {
        const team = teams.find((t) => t.id === session.teamId);
        if (isMinibasketSextos(team)) {
          navigate(`/calendar/${session.id}/planilla`, { state: { playoffSession: session } });
        } else {
          navigate(`/playoffs?teamId=${session.teamId}`);
        }
      } else if (session.tipo === 'entrenamiento') {
        if (session.trainingId) {
          navigate(`/teams/${session.teamId}/trainings/${session.trainingId}`);
        } else {
          handleCreateTraining(session);
        }
      } else if (session.tipo === 'partido') {
        const team = teams.find((t) => t.id === session.teamId);
        if (isMinibasketSextos(team)) {
          navigate(`/calendar/${session.id}/planilla`);
        } else if (session.fecha < todayYMD) {
          navigate(`/calendar/${session.id}/analysis`);
        } else {
          navigate(`/calendar/${session.id}/scouting`);
        }
      }
    },
    [navigate, teams, handleCreateTraining, todayYMD],
  );

  return {
    user,
    handleLogout,
    navigate,
    teams,
    loadingTeams,
    trainingNumbers,
    today,
    todayYMD,
    todayEvents,
    lastEventByTeam,
    nextEventByTeam,
    activePlayoffs,
    matchDayEvent,
    weeklySummary,
    nextMatchByTeam,
    recentExercises,
    exercisesCount: exercises.length,
    bibliotecaInsights,
    allSessions,
    creatingTraining,
    handleEventAction,
    nextActionEvent,
    pendingActions,
    newsItems,
    weekStrip,
  };
}
