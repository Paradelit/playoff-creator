import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  X, ClipboardList, ArrowRight, Upload, Trophy, MapPin, Sparkles, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { saveTraining } from '../services/trainingsService';
import {
  subscribeToCalendarSessions, saveCalendarSession, deleteCalendarSession,
  bulkImportCalendarSessions, linkTrainingToSession,
  getCalendarSessionsInRange, deleteCalendarSessionsByTeamAndRange
} from '../services/calendarService';
import { callGeminiForCalendar } from '../services/aiService';
import { teamDisplayName } from './TeamsScreen';

const TEAM_COLORS = [
  'bg-blue-600 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-blue-400 text-white',
  'bg-pink-500 text-white',
  'bg-blue-800 text-white',
];

function teamColorIndex(teamId) {
  if (!teamId) return 0;
  return teamId.charCodeAt(0) % TEAM_COLORS.length;
}

export function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_NAMES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DAY_HEADERS = ['L','M','X','J','V','S','D'];
const DAY_NAMES_SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DAY_NAMES_FULL  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function getMonday(date) {
  const d = new Date(date);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeekDays(currentDate, sessions) {
  const monday = getMonday(currentDate);
  const sessionsByDate = {};
  sessions.forEach(s => {
    if (!sessionsByDate[s.fecha]) sessionsByDate[s.fecha] = [];
    sessionsByDate[s.fecha].push(s);
  });
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { date, sessions: sessionsByDate[toYMD(date)] || [] };
  });
}

function buildCalendarDays(currentMonth, sessions) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const sessionsByDate = {};
  sessions.forEach(s => {
    if (!sessionsByDate[s.fecha]) sessionsByDate[s.fecha] = [];
    sessionsByDate[s.fecha].push(s);
  });

  const days = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false, sessions: sessionsByDate[toYMD(d)] || [] });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, isCurrentMonth: true, sessions: sessionsByDate[toYMD(date)] || [] });
  }
  const total = days.length <= 35 ? 35 : 42;
  let nextDay = 1;
  while (days.length < total) {
    const date = new Date(year, month + 1, nextDay++);
    days.push({ date, isCurrentMonth: false, sessions: sessionsByDate[toYMD(date)] || [] });
  }
  return days;
}

const EMPTY_SESSION = (teams) => ({
  teamId: teams[0]?.id || '',
  sessionNumber: 1,
  fecha: toYMD(new Date()),
  horaInicio: '',
  horaFin: '',
  lugar: '',
  tipo: 'entrenamiento',
  rival: '',
  esLocal: true,
  trainingId: null,
  importedFrom: 'manual',
});

function defaultSeasonDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-06-30` };
}

const DAY_NAMES_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function expandRecurring(patterns, startDate, endDate) {
  const sessions = [];
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const countByTeam = {};
  for (const p of patterns) {
    if (!p._teamId) continue;
    const targetDow = p.diaSemana;
    const d = new Date(start);
    const curDow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() + (targetDow - curDow + 7) % 7);
    while (d <= end) {
      countByTeam[p._teamId] = (countByTeam[p._teamId] || 0) + 1;
      sessions.push({
        teamId: p._teamId,
        teamName: p.teamName,
        sessionNumber: countByTeam[p._teamId],
        fecha: toYMD(d),
        horaInicio: p.horaInicio || '',
        horaFin: p.horaFin || '',
        lugar: p.lugar || '',
        tipo: p.tipo || 'entrenamiento',
        rival: '',
        esLocal: true,
        trainingId: null,
        importedFrom: 'excel-ai',
      });
      d.setDate(d.getDate() + 7);
    }
  }
  return sessions;
}

export default function CalendarScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [filterTeamId, setFilterTeamId] = useState(
    () => new URLSearchParams(location.search).get('teamId') || null
  );
  const [viewMode, setViewMode] = useState('month');

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [savingSession, setSavingSession] = useState(false);
  const [creatingTraining, setCreatingTraining] = useState(false);

  const fileInputRef = useRef(null);
  const [importSetup, setImportSetup] = useState(null); // null | { startDate, endDate }
  const [importPreview, setImportPreview] = useState(null); // { recurring, specific, startDate, endDate }
  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState(null); // { count, teamIds, toImport }

  function getDateRange(date, mode) {
    if (mode === 'month') {
      const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const end   = new Date(date.getFullYear(), date.getMonth() + 2, 0);
      return [toYMD(start), toYMD(end)];
    }
    if (mode === 'week') {
      const monday = getMonday(date);
      const start = new Date(monday); start.setDate(monday.getDate() - 7);
      const end   = new Date(monday); end.setDate(monday.getDate() + 13);
      return [toYMD(start), toYMD(end)];
    }
    // day
    const start = new Date(date); start.setDate(date.getDate() - 1);
    const end   = new Date(date); end.setDate(date.getDate() + 1);
    return [toYMD(start), toYMD(end)];
  }

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, setTeams);
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    const [start, end] = getDateRange(currentDate, viewMode);
    setLoading(true);
    return subscribeToCalendarSessions(user.uid, db, appId, start, end, data => {
      setSessions(data);
      setLoading(false);
    });
  }, [user, db, appId, currentDate, viewMode]);

  function goBack() {
    setCurrentDate(d => {
      const n = new Date(d);
      if (viewMode === 'month') n.setMonth(d.getMonth() - 1);
      else if (viewMode === 'week') n.setDate(d.getDate() - 7);
      else n.setDate(d.getDate() - 1);
      return n;
    });
  }
  function goForward() {
    setCurrentDate(d => {
      const n = new Date(d);
      if (viewMode === 'month') n.setMonth(d.getMonth() + 1);
      else if (viewMode === 'week') n.setDate(d.getDate() + 7);
      else n.setDate(d.getDate() + 1);
      return n;
    });
  }

  async function handleSaveSession(e) {
    e.preventDefault();
    setSavingSession(true);
    try {
      const teamObj = teams.find(t => t.id === editingSession.teamId);
      await saveCalendarSession({
        ...editingSession,
        id: editingSession.id || crypto.randomUUID(),
        teamName: teamObj ? teamDisplayName(teamObj) : '',
        sessionNumber: Number(editingSession.sessionNumber) || 1,
      }, { uid: user.uid, db, appId });
      setEditingSession(null);
      setSelectedSession(null);
    } finally {
      setSavingSession(false);
    }
  }

  async function handleDelete(id) {
    await deleteCalendarSession(id, { uid: user.uid, db, appId });
    setDeletingId(null);
    setSelectedSession(null);
  }

  async function handleCreateTraining(session) {
    setCreatingTraining(true);
    try {
      const trainingId = crypto.randomUUID();
      await saveTraining({
        id: trainingId, teamId: session.teamId,
        meta: {
          numero: session.sessionNumber, fecha: session.fecha,
          horaInicio: session.horaInicio, horaFin: session.horaFin,
          lugar: session.lugar || '', dia: '',
          equipo: session.teamName || '',
        },
        objetivos: '', ejercicios: [],
        cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
      }, session.teamId, { uid: user.uid, db, appId });
      await linkTrainingToSession(session.id, trainingId, { uid: user.uid, db, appId });
      navigate(`/teams/${session.teamId}/trainings/${trainingId}`);
    } finally {
      setCreatingTraining(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const { startDate, endDate } = importSetup || defaultSeasonDates();
    setImportSetup(null);
    setImporting(true);
    setImportError('');
    setImportPreview(null);
    setImportStatus('Leyendo el archivo Excel...');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const csvParts = wb.SheetNames.map(name => `--- HOJA: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`);
      const teamList = teams.map(t => ({ id: t.id, teamName: teamDisplayName(t) }));
      setImportStatus('La IA está analizando el cuadrante...');
      const result = await callGeminiForCalendar(csvParts.join('\n\n'), teamList, {
        onStatus: setImportStatus,
        onError: msg => setImportError(msg),
      });
      const recurring = (result?.recurring || []).map(p => ({ ...p, _teamId: p.teamId || '' }));
      const specific  = (result?.specific  || []).map(s => ({ ...s, _teamId: s.teamId || '' }));
      if (!recurring.length && !specific.length) {
        setImportError('La IA no encontró sesiones en el archivo.');
        return;
      }
      setImportPreview({ recurring, specific, startDate, endDate });
    } catch {
      if (!importError) setImportError('Error al procesar el archivo. Inténtalo de nuevo.');
    } finally {
      setImporting(false);
      setImportStatus('');
    }
  }

  function buildImportSessions() {
    if (!importPreview) return [];
    const { recurring, specific, startDate, endDate } = importPreview;
    const expanded = expandRecurring(recurring, startDate, endDate);
    const specs = specific.filter(s => s._teamId).map(s => {
      const teamObj = teams.find(t => t.id === s._teamId);
      return {
        teamId: s._teamId,
        teamName: teamObj ? teamDisplayName(teamObj) : s.teamName,
        sessionNumber: 1,
        fecha: s.fecha, horaInicio: s.horaInicio || '',
        horaFin: s.horaFin || '', lugar: s.lugar || '',
        tipo: s.tipo || 'entrenamiento', rival: s.rival || '', esLocal: true,
        trainingId: null, importedFrom: 'excel-ai',
      };
    });
    return [...expanded, ...specs];
  }

  async function handleRequestImport() {
    const toImport = buildImportSessions();
    if (!toImport.length) return;
    const { startDate, endDate } = importPreview;
    const teamIds = [...new Set(toImport.map(s => s.teamId).filter(Boolean))];
    const existing = await getCalendarSessionsInRange(user.uid, db, appId, startDate, endDate);
    const conflicts = existing.filter(s => teamIds.includes(s.teamId));
    if (conflicts.length > 0) {
      setDuplicateConflict({ count: conflicts.length, teamIds, toImport });
    } else {
      await doImport(toImport, false, teamIds, startDate, endDate);
    }
  }

  async function doImport(toImport, replace, teamIds, startDate, endDate) {
    setBulkSaving(true);
    try {
      if (replace) {
        await deleteCalendarSessionsByTeamAndRange(teamIds, startDate, endDate, { uid: user.uid, db, appId });
      }
      await bulkImportCalendarSessions(toImport, { uid: user.uid, db, appId });
      setImportPreview(null);
      setImportError('');
      setDuplicateConflict(null);
    } finally {
      setBulkSaving(false);
    }
  }

  const filterTeam = filterTeamId ? teams.find(t => t.id === filterTeamId) || null : null;
  const visibleSessions = filterTeamId ? sessions.filter(s => s.teamId === filterTeamId) : sessions;
  const calendarDays   = viewMode === 'month' ? buildCalendarDays(currentDate, visibleSessions) : [];
  const weekDays       = viewMode === 'week'  ? buildWeekDays(currentDate, visibleSessions) : [];
  const daySessionList = viewMode === 'day'   ? visibleSessions.filter(s => s.fecha === toYMD(currentDate)) : [];
  const todayYMD = toYMD(today);

  function getNavLabel() {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      if (monday.getMonth() === sunday.getMonth()) {
        return `${monday.getDate()} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getFullYear()}`;
      }
      if (monday.getFullYear() === sunday.getFullYear()) {
        return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[sunday.getMonth()]} ${monday.getFullYear()}`;
      }
      return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getFullYear()} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }
    const dow = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
    return `${DAY_NAMES_FULL[dow]}, ${currentDate.getDate()} ${MONTH_NAMES_SHORT[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <CalendarDays className="text-amber-500" size={36} /> Calendario
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Entrenamientos y partidos de tus equipos.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { setImportError(''); setImportPreview(null); setImportSetup(defaultSeasonDates()); }}
              className="bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition text-sm"
            >
              <Sparkles size={16} /> Importar con IA
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => setEditingSession({ ...EMPTY_SESSION(teams), ...(filterTeamId ? { teamId: filterTeamId } : {}) })}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 text-sm"
            >
              <Plus size={18} /> Nueva sesión
            </button>
          </div>
        </div>

        {/* Barra de navegación y controles */}
        <div className="flex items-center justify-between gap-3 mb-4 bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex-wrap gap-y-2">
          {/* Izquierda: prev / label / next */}
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base font-bold text-slate-800 min-w-[170px] text-center">{getNavLabel()}</h2>
            <button onClick={goForward} className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronRight size={20} />
            </button>
          </div>
          {/* Derecha: filtro equipo + toggle vista */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterTeamId ?? ''}
              onChange={e => setFilterTeamId(e.target.value || null)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">Todos los equipos</option>
              {teams.map(t => <option key={t.id} value={t.id}>{teamDisplayName(t)}</option>)}
            </select>
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              {[['month','Mes'],['week','Semana'],['day','Día']].map(([mode, label], i) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 text-xs font-bold transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} ${i > 0 ? 'border-l border-slate-200' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vista mes */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAY_HEADERS.map(d => (
                <div key={d} className="text-center py-2 text-xs font-bold text-slate-500">{d}</div>
              ))}
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map(({ date, isCurrentMonth, sessions: daySessions }, idx) => {
                  const ymd = toYMD(date);
                  const isToday = ymd === todayYMD;
                  return (
                    <div key={idx} className={`min-h-[72px] sm:min-h-[88px] border-b border-r border-slate-100 p-1.5 ${!isCurrentMonth ? 'opacity-40 bg-slate-50' : ''}`}>
                      <div className="mb-1">
                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-400 text-white' : 'text-slate-600'}`}>
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {daySessions.map(s => {
                          const isPartido = s.tipo === 'partido';
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSession(s)}
                              className={`w-full text-left rounded px-1.5 py-0.5 text-xs font-semibold truncate transition-opacity hover:opacity-80 ${isPartido ? 'bg-rose-500 text-white' : TEAM_COLORS[teamColorIndex(s.teamId)]}`}
                              title={isPartido ? `${s.teamName} vs ${s.rival || 'Rival'}` : `${s.teamName} #${s.sessionNumber}`}
                            >
                              {isPartido ? `vs ${s.rival || 'Rival'}` : s.teamName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Vista semana */}
        {viewMode === 'week' && (
          <WeekView weekDays={weekDays} todayYMD={todayYMD} loading={loading} onSelectSession={setSelectedSession} />
        )}

        {/* Vista día */}
        {viewMode === 'day' && (
          <DayView sessions={daySessionList} loading={loading} onSelectSession={setSelectedSession} />
        )}
      </div>

      {/* Modal Detalle */}
      {selectedSession && !editingSession && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSession(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedSession.tipo === 'partido' ? 'bg-rose-100' : 'bg-blue-100'}`}>
                  {selectedSession.tipo === 'partido'
                    ? <Trophy size={18} className="text-rose-600" />
                    : <ClipboardList size={18} className="text-blue-600" />
                  }
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {selectedSession.tipo === 'partido' ? `vs ${selectedSession.rival || 'Rival'}` : `Entrenamiento #${selectedSession.sessionNumber}`}
                  </p>
                  <p className="text-xs text-slate-500">{selectedSession.teamName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              <DetailRow label="Fecha" value={formatDateDisplay(selectedSession.fecha)} />
              <DetailRow label="Horario" value={
                selectedSession.horaInicio && selectedSession.horaFin
                  ? `${selectedSession.horaInicio} – ${selectedSession.horaFin}`
                  : selectedSession.horaInicio || '—'
              } />
              {selectedSession.lugar && <DetailRow label="Lugar" value={selectedSession.lugar} />}
              {selectedSession.tipo === 'partido' && (
                <>
                  {selectedSession.rival && <DetailRow label="Rival" value={selectedSession.rival} />}
                  <DetailRow label="Campo" value={selectedSession.esLocal ? 'Local' : 'Visitante'} />
                </>
              )}
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              {selectedSession.tipo !== 'partido' && (
                selectedSession.trainingId ? (
                  <button
                    onClick={() => navigate(`/teams/${selectedSession.teamId}/trainings/${selectedSession.trainingId}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <ClipboardList size={16} /> Abrir entrenamiento <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleCreateTraining(selectedSession)}
                    disabled={creatingTraining || !selectedSession.teamId}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60"
                  >
                    <ClipboardList size={16} />
                    {creatingTraining ? 'Creando...' : 'Crear entrenamiento'}
                  </button>
                )
              )}
              <div className="flex gap-2">
                <button onClick={() => setEditingSession({ ...selectedSession })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setDeletingId(selectedSession.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition">
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingSession(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-lg font-bold text-slate-800">{editingSession.id ? 'Editar sesión' : 'Nueva sesión'}</h3>
              <button onClick={() => setEditingSession(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSession} className="px-5 py-4 flex flex-col gap-4">

              {/* Tipo */}
              <FormField label="Tipo de sesión">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingSession(s => ({ ...s, tipo: 'entrenamiento' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${editingSession.tipo === 'entrenamiento' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <ClipboardList size={15} /> Entrenamiento
                  </button>
                  <button type="button" onClick={() => setEditingSession(s => ({ ...s, tipo: 'partido' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${editingSession.tipo === 'partido' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Trophy size={15} /> Partido
                  </button>
                </div>
              </FormField>

              <FormField label="Equipo">
                {filterTeamId && filterTeam ? (
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 font-medium">
                    {teamDisplayName(filterTeam)}
                  </div>
                ) : (
                  <select value={editingSession.teamId} onChange={e => setEditingSession(s => ({ ...s, teamId: e.target.value }))} required
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">Selecciona un equipo</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{teamDisplayName(t)}</option>)}
                  </select>
                )}
              </FormField>

              {/* Partido: rival + campo */}
              {editingSession.tipo === 'partido' && (
                <>
                  <FormField label="Rival">
                    <input type="text" placeholder="Nombre del equipo rival..."
                      value={editingSession.rival || ''}
                      onChange={e => setEditingSession(s => ({ ...s, rival: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </FormField>
                  <FormField label="Campo">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingSession(s => ({ ...s, esLocal: true }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${editingSession.esLocal ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <MapPin size={14} /> Local
                      </button>
                      <button type="button" onClick={() => setEditingSession(s => ({ ...s, esLocal: false }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${!editingSession.esLocal ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <ArrowRight size={14} /> Visitante
                      </button>
                    </div>
                  </FormField>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fecha">
                  <input type="date" required value={editingSession.fecha}
                    onChange={e => setEditingSession(s => ({ ...s, fecha: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </FormField>
                {editingSession.tipo === 'entrenamiento' && (
                  <FormField label="Nº sesión">
                    <input type="number" min="1" value={editingSession.sessionNumber}
                      onChange={e => setEditingSession(s => ({ ...s, sessionNumber: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </FormField>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Hora inicio">
                  <input type="time" value={editingSession.horaInicio}
                    onChange={e => setEditingSession(s => ({ ...s, horaInicio: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </FormField>
                <FormField label="Hora fin">
                  <input type="time" value={editingSession.horaFin}
                    onChange={e => setEditingSession(s => ({ ...s, horaFin: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </FormField>
              </div>
              <FormField label="Lugar">
                <input type="text" placeholder="Pabellón, pista..." value={editingSession.lugar}
                  onChange={e => setEditingSession(s => ({ ...s, lugar: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </FormField>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingSession(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">Cancelar</button>
                <button type="submit" disabled={savingSession}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
                  {savingSession ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Borrado */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar sesión?</h3>
            <p className="text-slate-600 mb-6 text-sm">El entrenamiento vinculado no se borrará.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Setup — rango de fechas */}
      {importSetup && !importing && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setImportSetup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-300" /> Importar cuadrante con IA
                </h3>
                <button onClick={() => setImportSetup(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <p className="text-sm text-slate-500">La IA detectará los horarios de tus equipos en el Excel y generará todos los eventos del calendario automáticamente.</p>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Generar eventos desde</label>
                <input type="date" value={importSetup.startDate}
                  onChange={e => setImportSetup(s => ({ ...s, startDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
                <input type="date" value={importSetup.endDate}
                  onChange={e => setImportSetup(s => ({ ...s, endDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!importSetup.startDate || !importSetup.endDate}
                className="w-full bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition text-sm mt-1"
              >
                <Upload size={16} /> Seleccionar archivo Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Procesando / Preview */}
      {(importing || importPreview || importError) && !duplicateConflict && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => { if (!importing && !bulkSaving) { setImportPreview(null); setImportError(''); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Sparkles size={18} className="text-orange-300" /> Importar con IA
              </h3>
              {!importing && !bulkSaving && (
                <button onClick={() => { setImportPreview(null); setImportError(''); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {importing && (
                <div className="flex flex-col items-center gap-4 py-10">
                  <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-600 text-sm text-center">{importStatus || 'Procesando...'}</p>
                </div>
              )}
              {importError && !importing && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{importError}</div>
              )}
              {importPreview && !importing && (() => {
                const { recurring, specific, startDate, endDate } = importPreview;
                const expandedCount = expandRecurring(recurring, startDate, endDate).length;
                const totalCount = expandedCount + specific.filter(s => s._teamId).length;
                return (
                  <>
                    {/* Resumen */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 text-sm text-orange-800">
                      <span className="font-bold">{totalCount} eventos</span> a crear entre <span className="font-bold">{startDate.split('-').reverse().join('/')}</span> y <span className="font-bold">{endDate.split('-').reverse().join('/')}</span>
                    </div>

                    {/* Horarios recurrentes */}
                    {recurring.length > 0 && (
                      <div className="mb-5">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Horarios recurrentes ({recurring.length} patrones)</h4>
                        <div className="flex flex-col gap-2">
                          {recurring.map((p, i) => {
                            const weekCount = expandRecurring([p], startDate, endDate).length;
                            return (
                              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                                <div className="flex-1 min-w-0">
                                  <select value={p._teamId}
                                    onChange={e => setImportPreview(prev => ({ ...prev, recurring: prev.recurring.map((r, ri) => ri === i ? { ...r, _teamId: e.target.value } : r) }))}
                                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full max-w-[160px]">
                                    <option value="">Sin asignar</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{teamDisplayName(t)}</option>)}
                                  </select>
                                </div>
                                <span className="text-xs font-semibold text-slate-700 shrink-0">{DAY_NAMES_ES[p.diaSemana]}</span>
                                <span className="text-xs text-slate-500 shrink-0">{p.horaInicio}{p.horaFin ? `–${p.horaFin}` : ''}</span>
                                {p.lugar && <span className="text-xs text-slate-400 truncate max-w-[80px]">{p.lugar}</span>}
                                <span className="text-xs font-bold text-blue-600 shrink-0">×{weekCount}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fechas especiales */}
                    {specific.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fechas especiales ({specific.length})</h4>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left py-2 px-2 font-semibold text-slate-600">Equipo</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-600">Tipo</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-600">Fecha</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-600">Hora</th>
                            </tr>
                          </thead>
                          <tbody>
                            {specific.map((s, i) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-1.5 px-2">
                                  <select value={s._teamId}
                                    onChange={e => setImportPreview(prev => ({ ...prev, specific: prev.specific.map((r, ri) => ri === i ? { ...r, _teamId: e.target.value } : r) }))}
                                    className="border border-slate-300 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full max-w-[140px]">
                                    <option value="">Sin asignar</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{teamDisplayName(t)}</option>)}
                                  </select>
                                </td>
                                <td className="py-1.5 px-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${s.tipo === 'partido' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {s.tipo === 'partido' ? 'Partido' : 'Entreno'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-slate-700">{s.fecha ? s.fecha.split('-').reverse().join('/') : '—'}</td>
                                <td className="py-1.5 px-2 text-slate-700">{s.horaInicio && s.horaFin ? `${s.horaInicio}–${s.horaFin}` : s.horaInicio || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {importPreview && !importing && (
              <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3">
                <button onClick={() => { setImportPreview(null); setImportError(''); }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">Cancelar</button>
                <button onClick={handleRequestImport} disabled={bulkSaving}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm flex items-center justify-center gap-2">
                  {bulkSaving ? 'Creando eventos...' : <><Sparkles size={15} /> Generar eventos</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Duplicados */}
      {duplicateConflict && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Eventos existentes</h3>
                <p className="text-xs text-slate-500">Se encontraron {duplicateConflict.count} eventos para estos equipos en el mismo rango de fechas.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">¿Qué quieres hacer con los eventos existentes?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doImport(duplicateConflict.toImport, true, duplicateConflict.teamIds, importPreview.startDate, importPreview.endDate)}
                disabled={bulkSaving}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
              >
                {bulkSaving ? 'Procesando...' : `Reemplazar (eliminar ${duplicateConflict.count} eventos anteriores)`}
              </button>
              <button
                onClick={() => doImport(duplicateConflict.toImport, false, duplicateConflict.teamIds, importPreview.startDate, importPreview.endDate)}
                disabled={bulkSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
              >
                Añadir de todas formas
              </button>
              <button
                onClick={() => setDuplicateConflict(null)}
                disabled={bulkSaving}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekView({ weekDays, todayYMD, loading, onSelectSession }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7">
        {weekDays.map(({ date, sessions: daySessions }) => {
          const ymd = toYMD(date);
          const isToday = ymd === todayYMD;
          const dow = date.getDay() === 0 ? 6 : date.getDay() - 1;
          return (
            <div key={ymd} className="border-r border-slate-100 last:border-r-0 flex flex-col">
              <div className={`text-center py-2 border-b border-slate-200 ${isToday ? 'bg-amber-50' : ''}`}>
                <p className="text-xs font-semibold text-slate-500">{DAY_NAMES_SHORT[dow]}</p>
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5 ${isToday ? 'bg-amber-400 text-white' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-1 min-h-[120px]">
                {daySessions.map(s => {
                  const isPartido = s.tipo === 'partido';
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelectSession(s)}
                      className={`w-full text-left rounded px-1.5 py-1 text-xs font-semibold truncate transition-opacity hover:opacity-80 ${isPartido ? 'bg-rose-500 text-white' : TEAM_COLORS[teamColorIndex(s.teamId)]}`}
                      title={isPartido ? `${s.teamName} vs ${s.rival || 'Rival'}` : `${s.teamName} #${s.sessionNumber}`}
                    >
                      {isPartido ? `vs ${s.rival || 'Rival'}` : s.teamName}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ sessions, loading, onSelectSession }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
        <CalendarDays size={40} className="mb-3 text-slate-300" />
        <p className="text-sm font-medium">No hay sesiones este día</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden divide-y divide-slate-100">
      {sessions.map(s => {
        const isPartido = s.tipo === 'partido';
        const colorClass = TEAM_COLORS[teamColorIndex(s.teamId)].split(' ')[0];
        return (
          <button key={s.id} onClick={() => onSelectSession(s)}
            className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPartido ? 'bg-rose-100' : 'bg-blue-100'}`}>
              {isPartido
                ? <Trophy size={18} className="text-rose-600" />
                : <ClipboardList size={18} className="text-blue-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">
                {isPartido ? `vs ${s.rival || 'Rival'}` : `Entrenamiento #${s.sessionNumber}`}
              </p>
              <p className="text-xs text-slate-500">{s.teamName}</p>
              {s.horaInicio && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.horaInicio}{s.horaFin ? ` – ${s.horaFin}` : ''}{s.lugar ? ` · ${s.lugar}` : ''}
                </p>
              )}
            </div>
            <div className={`w-2 h-10 rounded-full shrink-0 ${colorClass}`} />
          </button>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-slate-700 text-right">{value}</span>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
