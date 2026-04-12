import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  bulkImportCalendarSessions,
  linkTrainingToSession,
  getCalendarSessionsInRange,
  deleteCalendarSessionsByTeamAndRange,
} from '../services/calendarService';
import { saveTraining } from '../services/trainingsService';
import { callGeminiForCalendar } from '../services/aiService';
import { teamDisplayName } from '../utils/teamUtils';
import { toYMD, getSeasonDateRange } from '../utils/dateUtils';

function expandRecurring(patterns, startDate, endDate) {
  const sessions = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const countByTeam = {};
  for (const p of patterns) {
    if (!p._teamId) continue;
    const recurrenceId = crypto.randomUUID();
    const targetDow = p.diaSemana;
    const d = new Date(start);
    const curDow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() + ((targetDow - curDow + 7) % 7));
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
        recurrenceId,
      });
      d.setDate(d.getDate() + 7);
    }
  }
  return sessions;
}

export function useCalendarImport(teams, getTrainingNum) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const fileInputRef = useRef(null);

  const [importSetup, setImportSetup] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const { startDate, endDate } = importSetup || getSeasonDateRange();
    setImportSetup(null);
    setImporting(true);
    setImportError('');
    setImportPreview(null);
    setImportStatus('Leyendo el archivo Excel...');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const csvParts = wb.SheetNames.map(
        (name) => `--- HOJA: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`,
      );
      const teamList = teams.map((t) => ({ id: t.id, teamName: teamDisplayName(t) }));
      setImportStatus('La IA está analizando el cuadrante...');
      const result = await callGeminiForCalendar(csvParts.join('\n\n'), teamList, {
        onStatus: setImportStatus,
        onError: (msg) => setImportError(msg),
      });
      const recurring = (result?.recurring || []).map((p) => ({ ...p, _teamId: p.teamId || '' }));
      const specific = (result?.specific || []).map((s) => ({ ...s, _teamId: s.teamId || '' }));
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
    const specs = specific
      .filter((s) => s._teamId)
      .map((s) => {
        const teamObj = teams.find((t) => t.id === s._teamId);
        return {
          teamId: s._teamId,
          teamName: teamObj ? teamDisplayName(teamObj) : s.teamName,
          sessionNumber: 1,
          fecha: s.fecha,
          horaInicio: s.horaInicio || '',
          horaFin: s.horaFin || '',
          lugar: s.lugar || '',
          tipo: s.tipo || 'entrenamiento',
          rival: s.rival || '',
          esLocal: true,
          trainingId: null,
          importedFrom: 'excel-ai',
        };
      });
    return [...expanded, ...specs];
  }

  async function handleRequestImport() {
    const toImport = buildImportSessions();
    if (!toImport.length) return;
    const { startDate, endDate } = importPreview;
    const teamIds = [...new Set(toImport.map((s) => s.teamId).filter(Boolean))];
    const existing = await getCalendarSessionsInRange(user.uid, db, appId, startDate, endDate);
    const conflicts = existing.filter((s) => teamIds.includes(s.teamId));
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
      const sessionsWithIds = toImport.map((s) => ({ ...s, id: s.id || crypto.randomUUID() }));
      await bulkImportCalendarSessions(sessionsWithIds, { uid: user.uid, db, appId });
      const entrenamientos = sessionsWithIds.filter((s) => s.tipo === 'entrenamiento' && s.teamId);
      await Promise.all(
        entrenamientos.map(async (s) => {
          const trainingId = crypto.randomUUID();
          await saveTraining(
            {
              id: trainingId,
              teamId: s.teamId,
              meta: {
                numero: getTrainingNum(s) || s.sessionNumber || 1,
                fecha: s.fecha || '',
                horaInicio: s.horaInicio || '',
                horaFin: s.horaFin || '',
                lugar: s.lugar || '',
                dia: '',
                equipo: s.teamName || '',
              },
              objetivos: '',
              ejercicios: [],
              cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
            },
            s.teamId,
            { uid: user.uid, db, appId },
          );
          await linkTrainingToSession(s.id, trainingId, { uid: user.uid, db, appId });
        }),
      );
      setImportPreview(null);
      setImportError('');
      setDuplicateConflict(null);
    } finally {
      setBulkSaving(false);
    }
  }

  function openImportSetup() {
    setImportError('');
    setImportPreview(null);
    setImportSetup(getSeasonDateRange());
  }

  return {
    fileInputRef,
    importSetup,
    setImportSetup,
    importPreview,
    setImportPreview,
    importStatus,
    importError,
    setImportError,
    importing,
    bulkSaving,
    duplicateConflict,
    setDuplicateConflict,
    handleFileChange,
    handleRequestImport,
    doImport,
    openImportSetup,
    expandRecurring,
  };
}
