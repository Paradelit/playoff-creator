import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, Plus, Minus, ChevronDown, ChevronUp, Info, CalendarDays } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToMembers, subscribeToAsistencia, saveAsistencia } from '../../services/teamsService';
import { subscribeToTeamSessions } from '../../services/calendarService';
import { subscribeToTrainings, saveTraining } from '../../services/trainingsService';
import { teamDisplayName } from '../../utils/teamUtils';
import { useTeams } from '../../hooks/useTeams';
import { useProfile } from '../../hooks/useProfile';
import { getTemporada } from '../../utils/dateUtils';
import ConfirmDialog from '../../components/ConfirmDialog';

/* ─── Constantes ────────────────────────────────────────────────────────── */
const MONTHS = [
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

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const VALID_CODES = ['F', 'r', 'R', '-', 'L', 'L+', ''];

function codeColor(code) {
  switch (code) {
    case 'F':
      return 'bg-red-500 text-white';
    case 'r':
    case 'R':
      return 'bg-yellow-300 text-black';
    case '-':
      return 'bg-gray-900 text-white';
    case 'L+':
      return 'bg-blue-400 text-white';
    case 'L':
      return 'bg-transparent text-gray-700';
    default:
      return 'bg-transparent text-gray-700';
  }
}

/** Derive session label from a date string: "L-7" */
function sessionLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_LETTERS[d.getDay()]}-${d.getDate()}`;
}

/** Get month key from a date string */
function monthKeyFromDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth();
  return MONTHS.find((mo) => mo.num === m)?.key || null;
}

/* ─── Explicación ───────────────────────────────────────────────────────── */
function ExplicacionAsistencia({ open, onToggle }) {
  return (
    <div className="mb-4 print:mb-6">
      <button
        onClick={onToggle}
        className="print:hidden flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition mb-2"
      >
        <Info size={15} />
        Instrucciones
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <div className={`${open ? 'block' : 'hidden'} print:block`}>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-[12px] leading-relaxed text-gray-800 font-sans print:bg-transparent print:border-none print:p-0 print:text-[10px]">
          <p className="font-bold mb-2">Nomenclatura para cumplimentar las hojas:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs font-bold leading-6 bg-red-500 text-white">
                F
              </span>
              <span>Ha faltado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs font-bold leading-6 bg-yellow-300 text-black">
                r
              </span>
              <span>Un poco tarde (&le;10 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs font-bold leading-6 bg-yellow-300 text-black">
                R
              </span>
              <span>Muy tarde (&gt;10 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs font-bold leading-6 bg-gray-900 text-white">
                -
              </span>
              <span>Mala actitud</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs leading-6 text-gray-700">L</span>
              <span>Lesionado (no viene)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-7 h-6 rounded text-center text-xs font-bold leading-6 bg-blue-400 text-white">
                L+
              </span>
              <span>Lesionado (viene)</span>
            </div>
          </div>
          <p className="mb-1">
            <span className="font-bold">Totales por jugador:</span> Se suman automáticamente las F, las R (r+R) y los -
            de cada jugador.
          </p>
          <p className="mb-1">
            <span className="font-bold">Totales por día:</span> Se suman las faltas (F) del equipo en cada
            entrenamiento.
          </p>
          <p className="mb-1">
            <span className="font-bold">Sesiones:</span> Se cargan automáticamente del calendario de entrenamientos.
            También puedes añadir sesiones manualmente.
          </p>
          <p>
            <span className="font-bold">Sincronización:</span> Las faltas y retrasos se sincronizan con la ficha de cada
            entrenamiento (sección «Cierre»).
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Resumen ───────────────────────────────────────────────────────────── */
function ResumenView({ members, attendance, calSessions }) {
  const monthTotals = useMemo(() => {
    const result = {};
    for (const m of MONTHS) {
      result[m.key] = {};
      // Get sessions for this month
      const mSessions = calSessions.filter((s) => monthKeyFromDate(s.fecha) === m.key);
      for (const member of members) {
        let f = 0,
          r = 0,
          minus = 0;
        for (const sess of mSessions) {
          const code = attendance[sess.id]?.[member.id] || '';
          if (code === 'F' || code === 'L+') f++;
          if (code === 'r' || code === 'R') r++;
          if (code === '-') minus++;
        }
        result[m.key][member.id] = { f, r, minus };
      }
    }
    return result;
  }, [members, attendance, calSessions]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px] print:text-[9px]">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 p-1.5 w-[30px]" />
            <th className="border border-gray-300 bg-gray-100 p-1.5 text-left w-[140px]">Nombre</th>
            {MONTHS.map((m) => (
              <th key={m.key} className="border border-gray-300 bg-gray-100 p-1 text-center font-bold text-[10px]">
                {m.label}
              </th>
            ))}
            <th className="border border-gray-300 bg-blue-50 p-1 text-center font-bold text-[10px]">F</th>
            <th className="border border-gray-300 bg-blue-50 p-1 text-center font-bold text-[10px]">R</th>
            <th className="border border-gray-300 bg-blue-50 p-1 text-center font-bold text-[10px]">-</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, idx) => {
            let totalF = 0,
              totalR = 0,
              totalMinus = 0;
            return (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-1 text-center text-gray-500">{idx + 1}</td>
                <td className="border border-gray-300 p-1 font-medium truncate max-w-[140px]">{member.nombre}</td>
                {MONTHS.map((m) => {
                  const t = monthTotals[m.key]?.[member.id] || { f: 0, r: 0, minus: 0 };
                  totalF += t.f;
                  totalR += t.r;
                  totalMinus += t.minus;
                  const total = t.f + t.r + t.minus;
                  return (
                    <td key={m.key} className="border border-gray-300 p-1 text-center">
                      {total > 0 ? total : ''}
                    </td>
                  );
                })}
                <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">
                  {totalF > 0 ? totalF : 0}
                </td>
                <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">
                  {totalR > 0 ? totalR : 0}
                </td>
                <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">
                  {totalMinus > 0 ? totalMinus : 0}
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="font-bold bg-gray-100">
            <td className="border border-gray-300 p-1" />
            <td className="border border-gray-300 p-1">Totales equipo</td>
            {MONTHS.map((m) => {
              let total = 0;
              for (const member of members) {
                const t = monthTotals[m.key]?.[member.id] || { f: 0 };
                total += t.f;
              }
              return (
                <td key={m.key} className="border border-gray-300 p-1 text-center">
                  {total > 0 ? total : 0}
                </td>
              );
            })}
            <td className="border border-gray-300 p-1" />
            <td className="border border-gray-300 p-1" />
            <td className="border border-gray-300 p-1" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function AsistenciaScreen() {
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

  // Refs to hold latest values for cross-subscription sync
  const membersRef = useRef([]);
  const calSessionsRef = useRef([]);
  const trainingsRef = useRef([]);
  const attendanceLoadedRef = useRef(false);

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

  /* ─── Cargar miembros ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToMembers(teamId, user.uid, db, appId, (data) => {
      const jugadores = data.filter((m) => m.tipo === 'jugador');
      membersRef.current = jugadores;
      setMembers(jugadores);
    });
  }, [user, db, appId, teamId]);

  /* ─── Cargar sesiones de calendario (entrenamientos) ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeamSessions(user.uid, db, appId, teamId, 'entrenamiento', (data) => {
      calSessionsRef.current = data;
      setCalSessions(data);
    });
  }, [user, db, appId, teamId]);

  /* ─── Cargar entrenamientos ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTrainings(teamId, user.uid, db, appId, (data) => {
      trainingsRef.current = data;
      setTrainings(data);
    });
  }, [user, db, appId, teamId]);

  /* ─── Cargar datos de asistencia (con merge desde trainings) ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToAsistencia(teamId, user.uid, db, appId, (data) => {
      if (isFirstLoad.current) {
        const base = data.attendance || {};
        // Merge any existing training cierre data into attendance
        const merged = mergeFromTrainings(base, membersRef.current, calSessionsRef.current, trainingsRef.current);
        setAttendance(merged);
        setManualSessions(data.manualSessions || {});
        isFirstLoad.current = false;
        attendanceLoadedRef.current = true;
      }
    });
  }, [user, db, appId, teamId]);

  /* ─── Debounced save ─── */
  const triggerSave = useCallback(
    (newAttendance, newManual) => {
      setSaveStatus('unsaved');
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        await saveAsistencia(
          teamId,
          {
            attendance: newAttendance,
            manualSessions: newManual ?? manualSessions,
          },
          { uid: user.uid, db, appId },
        );
        setSaveStatus('saved');
      }, 1500);
    },
    [teamId, user, db, appId, manualSessions],
  );

  /* ─── Sync attendance → training cierre ─── */
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

      // Only update if changed
      if (
        newCierre.faltas !== (training.cierre?.faltas || '') ||
        newCierre.retrasos !== (training.cierre?.retrasos || '')
      ) {
        saveTraining({ ...training, cierre: newCierre }, teamId, { uid: user.uid, db, appId });
      }
    },
    [calSessions, trainings, members, teamId, user, db, appId],
  );

  /* ─── Update cell ─── */
  function updateCell(sessionId, memberId, code) {
    if (!VALID_CODES.includes(code)) return;
    const updated = { ...attendance };
    if (!updated[sessionId]) updated[sessionId] = {};
    updated[sessionId] = { ...updated[sessionId], [memberId]: code };
    setAttendance(updated);
    triggerSave(updated, manualSessions);
    syncToTraining(sessionId, updated[sessionId]);
  }

  /* ─── Handle cell input ─── */
  function handleCellInput(e, sessionId, memberId) {
    const raw = e.target.value;
    // Allow L+ specifically
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

  /* ─── Add manual session ─── */
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
    // Clean attendance for removed session
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

  /* ─── Reset ─── */
  function confirmReset() {
    setShowResetConfirm(false);
    setAttendance({});
    setManualSessions({});
    triggerSave({}, {});
  }

  /* ─── Sessions for a given month ─── */
  function getMonthSessions(monthKey) {
    const calMonth = calSessions
      .filter((s) => monthKeyFromDate(s.fecha) === monthKey)
      .map((s) => ({ id: s.id, label: sessionLabel(s.fecha), isCalendar: true }));
    const manual = (manualSessions[monthKey] || []).map((s) => ({ ...s, isCalendar: false }));
    return [...calMonth, ...manual];
  }

  /* ─── Totals for a player in current month ─── */
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

  /* ─── Day totals (faltas per session) ─── */
  function dayTotal(sessionId) {
    let total = 0;
    for (const member of members) {
      const code = attendance[sessionId]?.[member.id] || '';
      if (code === 'F') total++;
    }
    return total;
  }

  const temporada = getTemporada();
  const isResumen = activeMonth === 'resumen';
  const currentMonthMeta = MONTHS.find((m) => m.key === activeMonth);
  const monthSessions = isResumen ? [] : getMonthSessions(activeMonth);

  return (
    <div className="min-h-screen bg-gray-200 font-serif text-black print:bg-white print:p-0">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4 font-sans">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Cuaderno
        </button>
        {!isResumen && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => addManualSession(activeMonth)}
              className="flex items-center px-3 py-1 bg-white border border-gray-400 text-sm hover:bg-gray-50 transition shadow-sm rounded"
            >
              <Plus className="w-4 h-4 mr-1" /> Sesión
            </button>
            <button
              onClick={() => removeManualSession(activeMonth)}
              disabled={!manualSessions[activeMonth]?.length}
              className="flex items-center px-3 py-1 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded disabled:opacity-40"
            >
              <Minus className="w-4 h-4 mr-1" /> Sesión
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Limpiar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Tabs de meses */}
      <div className="print:hidden sticky top-[53px] z-10 bg-white border-b border-slate-200 px-4 py-1 flex items-center gap-1 overflow-x-auto font-sans">
        {MONTHS.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMonth(m.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-t transition whitespace-nowrap ${
              activeMonth === m.key
                ? 'bg-slate-800 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={() => setActiveMonth('resumen')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition whitespace-nowrap ${
            isResumen ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          Resumen
        </button>
      </div>

      {/* Documento A4 */}
      <div className="py-6 px-4 print:p-0">
        <div className="max-w-[1100px] mx-auto bg-white border border-gray-400 pt-8 pb-8 px-6 shadow-xl print:shadow-none print:border-none print:m-0 print:p-6 print:max-w-none">
          {/* Cabecera */}
          <div className="flex justify-between items-start mb-4">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-lg tracking-wider uppercase underline decoration-2 underline-offset-4">
                {isResumen ? 'Resumen Asistencia' : currentMonthMeta?.full || ''}
              </h1>
              {team && <p className="text-sm text-gray-600 mt-1 font-sans">{teamDisplayName(team)}</p>}
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
            </div>
          </div>

          {/* Explicación colapsable */}
          <ExplicacionAsistencia open={showExplicacion} onToggle={() => setShowExplicacion(!showExplicacion)} />

          {isResumen ? (
            <ResumenView members={members} attendance={attendance} calSessions={calSessions} />
          ) : (
            <>
              {/* Info de sincronización */}
              {monthSessions.some((s) => s.isCalendar) && (
                <div className="print:hidden flex items-center gap-2 text-[11px] text-emerald-600 font-sans mb-3">
                  <CalendarDays size={13} />
                  <span>{monthSessions.filter((s) => s.isCalendar).length} sesiones cargadas del calendario</span>
                </div>
              )}

              {/* Tabla de asistencia */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px] print:text-[9px]">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 p-1 w-[30px] text-center">#</th>
                      <th className="border border-gray-300 bg-gray-100 p-1.5 text-left w-[130px] print:w-[100px]">
                        Nombre
                      </th>
                      {monthSessions.map((sess) => {
                        const manualIdx = sess.isCalendar
                          ? -1
                          : (manualSessions[activeMonth] || []).findIndex((s) => s.id === sess.id);
                        return (
                          <th
                            key={sess.id}
                            className="border border-gray-300 bg-gray-100 p-1 text-center min-w-[36px] max-w-[50px]"
                          >
                            {sess.isCalendar ? (
                              <span className="text-[10px] font-bold">{sess.label}</span>
                            ) : (
                              <input
                                type="text"
                                value={sess.label}
                                onChange={(e) => updateManualLabel(activeMonth, manualIdx, e.target.value)}
                                placeholder="X-0"
                                className="w-full text-center text-[10px] font-bold bg-transparent focus:outline-none"
                              />
                            )}
                          </th>
                        );
                      })}
                      {/* Totales headers */}
                      <th className="border border-gray-300 bg-blue-50 p-1 text-center text-[10px] font-bold w-[32px]">
                        F
                      </th>
                      <th className="border border-gray-300 bg-blue-50 p-1 text-center text-[10px] font-bold w-[32px]">
                        R
                      </th>
                      <th className="border border-gray-300 bg-blue-50 p-1 text-center text-[10px] font-bold w-[32px]">
                        -
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, idx) => {
                      const totals = playerTotals(monthSessions, member.id);
                      return (
                        <tr key={member.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="border border-gray-300 p-1 text-center text-gray-500">{idx + 1}</td>
                          <td className="border border-gray-300 p-1 font-medium truncate max-w-[130px] text-[11px] print:text-[9px]">
                            {member.nombre}
                          </td>
                          {monthSessions.map((sess) => {
                            const code = attendance[sess.id]?.[member.id] || '';
                            return (
                              <td key={sess.id} className={`border border-gray-300 p-0 text-center ${codeColor(code)}`}>
                                <input
                                  type="text"
                                  value={code}
                                  onChange={(e) => handleCellInput(e, sess.id, member.id)}
                                  className={`w-full h-full text-center font-bold text-[12px] p-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset bg-transparent ${code === 'F' ? 'text-white' : code === '-' ? 'text-white' : code === 'L+' ? 'text-white' : ''}`}
                                  maxLength={2}
                                />
                              </td>
                            );
                          })}
                          <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">{totals.f}</td>
                          <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">{totals.r}</td>
                          <td className="border border-gray-300 bg-blue-50 p-1 text-center font-bold">
                            {totals.minus}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="font-bold bg-gray-100">
                      <td className="border border-gray-300 p-1" />
                      <td className="border border-gray-300 p-1">Totales</td>
                      {monthSessions.map((sess) => (
                        <td key={sess.id} className="border border-gray-300 p-1 text-center">
                          {dayTotal(sess.id)}
                        </td>
                      ))}
                      <td className="border border-gray-300 p-1" />
                      <td className="border border-gray-300 p-1" />
                      <td className="border border-gray-300 p-1" />
                    </tr>
                  </tbody>
                </table>
              </div>

              {monthSessions.length === 0 && (
                <div className="text-center text-gray-400 font-sans text-sm py-12">
                  <CalendarDays size={32} className="mx-auto mb-3 text-gray-300" />
                  <p>No hay sesiones de entrenamiento en {currentMonthMeta?.full}.</p>
                  <p className="text-xs mt-1">
                    Añade entrenamientos en el calendario o pulsa «+ Sesión» para añadir manualmente.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Limpiar asistencia"
        message="¿Estás seguro de que quieres limpiar todos los datos de asistencia? Esta acción no se puede deshacer."
        confirmLabel="Limpiar"
        destructive
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
