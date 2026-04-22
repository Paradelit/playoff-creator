import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToMembers, subscribeToAsistencia, saveAsistencia } from '../services/teamsService';
import { subscribeToTeamSessions } from '../services/calendarService';
import { subscribeToTrainings, saveTraining } from '../services/trainingsService';
import { useTeams } from './useTeams';
import { useProfile } from './useProfile';

const VALID_CODES = ['F', 'r', 'R', '-', 'L', 'L+', ''];

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const MONTHS = [
  { key: 'septiembre', label: 'Sep', full: 'Septiembre', num: 8 },
  { key: 'octubre', label: 'Oct', full: 'Octubre', num: 9 },
  { key: 'noviembre', label: 'Nov', full: 'Noviembre', num: 10 },
  { key: 'diciembre', label: 'Dic', full: 'Diciembre', num: 11 },
  { key: 'enero', label: 'Ene', full: 'Enero', num: 0 },
  { key: 'febrero', label: 'Feb', full: 'Febrero', num: 1 },
  { key: 'marzo', label: 'Mar', full: 'Marzo', num: 2 },
  { key: 'abril', label: 'Abr', full: 'Abril', num: 3 },
  { key: 'mayo', label: 'May', full: 'Mayo', num: 4 },
  { key: 'junio', label: 'Jun', full: 'Junio', num: 5 },
];

function sessionLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_LETTERS[d.getDay()]}-${d.getDate()}`;
}

export function monthKeyFromDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth();
  return MONTHS.find((mo) => mo.num === m)?.key || null;
}

function mergeFromTrainings(baseAttendance, mems, sessions, trns) {
  if (mems.length === 0 || sessions.length === 0 || trns.length === 0) return baseAttendance;
  const merged = { ...baseAttendance };
  let changed = false;
  for (const sess of sessions) {
    if (!sess.trainingId) continue;
    const training = trns.find((t) => t.id === sess.trainingId);
    if (!training?.cierre) continue;
    const faltas = training.cierre.faltas || '';
    const retrasos = training.cierre.retrasos || '';
    const sessionAtt = { ...(merged[sess.id] || {}) };
    for (const member of mems) {
      if (sessionAtt[member.id]) continue;
      const name = member.nombre.toLowerCase();
      if (faltas.toLowerCase().includes(name)) {
        sessionAtt[member.id] = 'F';
        changed = true;
      } else if (retrasos.toLowerCase().includes(name)) {
        sessionAtt[member.id] = 'R';
        changed = true;
      }
    }
    if (Object.keys(sessionAtt).length > 0) merged[sess.id] = sessionAtt;
  }
  return changed ? merged : baseAttendance;
}

export function useAttendance() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const { teams } = useTeams();
  const { profile } = useProfile();
  const team = teams.find((t) => t.id === teamId) || null;

  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [manualSessions, setManualSessions] = useState({});
  const [calSessions, setCalSessions] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [activeMonth, setActiveMonth] = useState('resumen');
  const [showExplicacion, setShowExplicacion] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const debounceRef = useRef(null);
  const isFirstLoad = useRef(true);

  const membersRef = useRef([]);
  const calSessionsRef = useRef([]);
  const trainingsRef = useRef([]);

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToMembers(teamId, user.uid, db, appId, (data) => {
      const jugadores = data.filter((m) => m.tipo === 'jugador');
      membersRef.current = jugadores;
      setMembers(jugadores);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToTeamSessions(user.uid, db, appId, teamId, 'entrenamiento', (data) => {
      calSessionsRef.current = data;
      setCalSessions(data);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToTrainings(teamId, user.uid, db, appId, (data) => {
      trainingsRef.current = data;
      setTrainings(data);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return undefined;
    return subscribeToAsistencia(teamId, user.uid, db, appId, (data) => {
      if (isFirstLoad.current) {
        const base = data.attendance || {};
        const merged = mergeFromTrainings(base, membersRef.current, calSessionsRef.current, trainingsRef.current);
        setAttendance(merged);
        setManualSessions(data.manualSessions || {});
        isFirstLoad.current = false;
      }
    });
  }, [user, db, appId, teamId]);

  const triggerSave = useCallback(
    (newAttendance, newManual) => {
      setSaveStatus('unsaved');
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        await saveAsistencia(
          teamId,
          { attendance: newAttendance, manualSessions: newManual ?? manualSessions },
          { uid: user.uid, db, appId },
        );
        setSaveStatus('saved');
      }, 1500);
    },
    [teamId, user, db, appId, manualSessions],
  );

  const syncToTraining = useCallback(
    (sessionId, newSessionAtt) => {
      const sess = calSessions.find((s) => s.id === sessionId);
      if (!sess?.trainingId) return;
      const training = trainings.find((t) => t.id === sess.trainingId);
      if (!training) return;

      const faltaNames = [];
      const retrasoNames = [];
      for (const member of members) {
        const code = newSessionAtt[member.id] || '';
        if (code === 'F') faltaNames.push(member.nombre);
        if (code === 'r' || code === 'R') retrasoNames.push(member.nombre);
      }

      const newCierre = {
        ...training.cierre,
        faltas: faltaNames.join(', '),
        retrasos: retrasoNames.join(', '),
      };

      if (
        newCierre.faltas !== (training.cierre?.faltas || '') ||
        newCierre.retrasos !== (training.cierre?.retrasos || '')
      ) {
        saveTraining({ ...training, cierre: newCierre }, teamId, { uid: user.uid, db, appId });
      }
    },
    [calSessions, trainings, members, teamId, user, db, appId],
  );

  function updateCell(sessionId, memberId, code) {
    if (!VALID_CODES.includes(code)) return;
    const updated = { ...attendance };
    if (!updated[sessionId]) updated[sessionId] = {};
    updated[sessionId] = { ...updated[sessionId], [memberId]: code };
    setAttendance(updated);
    triggerSave(updated, manualSessions);
    syncToTraining(sessionId, updated[sessionId]);
  }

  function handleCellInput(e, sessionId, memberId) {
    const raw = e.target.value;
    if (raw === 'L' || raw === 'l') {
      updateCell(sessionId, memberId, 'L');
    } else if (raw === 'L+' || raw === 'l+') {
      updateCell(sessionId, memberId, 'L+');
    } else {
      const last = raw.slice(-1);
      if (last === 'F' || last === 'f') updateCell(sessionId, memberId, 'F');
      else if (last === 'r') updateCell(sessionId, memberId, 'r');
      else if (last === 'R') updateCell(sessionId, memberId, 'R');
      else if (last === '-') updateCell(sessionId, memberId, '-');
      else if (raw === '') updateCell(sessionId, memberId, '');
    }
  }

  function addManualSession(monthKey) {
    const id = `manual-${Date.now()}`;
    const updated = { ...manualSessions };
    if (!updated[monthKey]) updated[monthKey] = [];
    updated[monthKey] = [...updated[monthKey], { id, label: '' }];
    setManualSessions(updated);
    triggerSave(attendance, updated);
  }

  function removeManualSession(monthKey) {
    const updated = { ...manualSessions };
    if (!updated[monthKey] || updated[monthKey].length === 0) return;
    const removed = updated[monthKey][updated[monthKey].length - 1];
    updated[monthKey] = updated[monthKey].slice(0, -1);
    const attUpdated = { ...attendance };
    delete attUpdated[removed.id];
    setManualSessions(updated);
    setAttendance(attUpdated);
    triggerSave(attUpdated, updated);
  }

  function updateManualLabel(monthKey, idx, label) {
    const updated = { ...manualSessions };
    updated[monthKey] = updated[monthKey].map((s, i) => (i === idx ? { ...s, label } : s));
    setManualSessions(updated);
    triggerSave(attendance, updated);
  }

  function confirmReset() {
    setShowResetConfirm(false);
    setAttendance({});
    setManualSessions({});
    triggerSave({}, {});
  }

  function getMonthSessions(monthKey) {
    const calMonth = calSessions
      .filter((s) => monthKeyFromDate(s.fecha) === monthKey)
      .map((s) => ({ id: s.id, label: sessionLabel(s.fecha), isCalendar: true }));
    const manual = (manualSessions[monthKey] || []).map((s) => ({ ...s, isCalendar: false }));
    return [...calMonth, ...manual];
  }

  function playerTotals(monthSessions, memberId) {
    let f = 0,
      r = 0,
      minus = 0;
    for (const sess of monthSessions) {
      const code = attendance[sess.id]?.[memberId] || '';
      if (code === 'F' || code === 'L+') f++;
      if (code === 'r' || code === 'R') r++;
      if (code === '-') minus++;
    }
    return { f, r, minus };
  }

  function dayTotal(sessionId) {
    let total = 0;
    for (const member of members) {
      const code = attendance[sessionId]?.[member.id] || '';
      if (code === 'F') total++;
    }
    return total;
  }

  const isResumen = activeMonth === 'resumen';
  const currentMonthMeta = MONTHS.find((m) => m.key === activeMonth);
  const monthSessions = isResumen ? [] : getMonthSessions(activeMonth);

  return {
    teamId,
    navigate,
    team,
    profile,
    members,
    attendance,
    calSessions,
    manualSessions,
    activeMonth,
    setActiveMonth,
    showExplicacion,
    setShowExplicacion,
    showResetConfirm,
    setShowResetConfirm,
    saveStatus,
    isResumen,
    currentMonthMeta,
    monthSessions,
    handleCellInput,
    addManualSession,
    removeManualSession,
    updateManualLabel,
    confirmReset,
    playerTotals,
    dayTotal,
  };
}
