import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import {
  saveCalendarSession,
  deleteCalendarSession,
  linkTrainingToSession,
  getSessionsByRecurrenceId,
  batchUpdateCalendarSessions,
  deleteSessionsByRecurrenceId,
} from '../services/calendarService';
import { saveTraining } from '../services/trainingsService';
import { deletePlanilla } from '../services/planillaService';
import { updatePlayoffMatchSchedule, toBracketDate } from '../services/bracketCalendarSyncService';
import { teamDisplayName } from '../utils/teamUtils';

export function useSessionEditor(teams, getTrainingNum) {
  const navigate = useNavigate();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const addToast = useToast();

  const [selectedSession, setSelectedSession] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [recurrenceAction, setRecurrenceAction] = useState(null);
  const [pendingEditData, setPendingEditData] = useState(null);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionErrors, setSessionErrors] = useState({});
  const [creatingTraining, setCreatingTraining] = useState(false);

  async function doSaveSession(sessionData, choice) {
    setSavingSession(true);
    try {
      if (sessionData.tipo === 'playoff' && sessionData.bracketId && sessionData.bracketMatchId) {
        await updatePlayoffMatchSchedule(
          sessionData.bracketId,
          sessionData.bracketMatchId,
          sessionData.gameIndex || 0,
          {
            fecha: toBracketDate(sessionData.fecha),
            horaInicio: sessionData.horaInicio || '',
            horaFin: sessionData.horaFin || '',
            lugar: sessionData.lugar || '',
          },
          { wsId: activeWsId, db, appId },
        );
        setEditingSession(null);
        setSelectedSession(null);
        setPendingEditData(null);
        return;
      }

      const isNew = !sessionData.id;
      const teamObj = teams.find((t) => t.id === sessionData.teamId);
      const sessionId = sessionData.id || crypto.randomUUID();
      const teamName = teamObj ? teamDisplayName(teamObj) : '';
      const sessionNumber = Number(sessionData.sessionNumber) || 1;

      const sessionToSave = {
        ...sessionData,
        id: sessionId,
        teamName,
        sessionNumber,
        ...(choice === 'single' && sessionData.recurrenceId ? { recurrenceDetached: true } : {}),
      };

      await saveCalendarSession(sessionToSave, { wsId: activeWsId, db, appId });

      if (choice === 'thisAndFuture' && sessionData.recurrenceId) {
        try {
          const futureSessions = await getSessionsByRecurrenceId(
            activeWsId,
            db,
            appId,
            sessionData.recurrenceId,
            sessionData.fecha,
          );
          const toUpdate = futureSessions.filter((s) => s.id !== sessionId && !s.recurrenceDetached);
          if (toUpdate.length > 0) {
            const bulkFields = {};
            if (sessionData.horaInicio !== undefined) bulkFields.horaInicio = sessionData.horaInicio;
            if (sessionData.horaFin !== undefined) bulkFields.horaFin = sessionData.horaFin;
            if (sessionData.lugar !== undefined) bulkFields.lugar = sessionData.lugar;
            if (sessionData.tipo !== undefined) bulkFields.tipo = sessionData.tipo;
            await batchUpdateCalendarSessions(toUpdate, bulkFields, { wsId: activeWsId, db, appId });
            addToast(`Actualizada esta sesión y ${toUpdate.length} más`, 'success');
          }
        } catch (err) {
          console.error('Error propagating changes to future sessions:', err);
          addToast('La sesión actual se guardó, pero hubo un error actualizando las siguientes', 'error');
        }
      }

      if (isNew && sessionData.tipo === 'entrenamiento' && !sessionData.trainingId) {
        const trainingId = crypto.randomUUID();
        await saveTraining(
          {
            id: trainingId,
            teamId: sessionData.teamId,
            meta: {
              numero: getTrainingNum(sessionData) || sessionNumber,
              fecha: sessionData.fecha,
              horaInicio: sessionData.horaInicio,
              horaFin: sessionData.horaFin,
              lugar: sessionData.lugar || '',
              dia: '',
              equipo: teamName,
            },
            objetivos: '',
            ejercicios: [],
            cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
          },
          sessionData.teamId,
          { wsId: activeWsId, db, appId },
        );
        await linkTrainingToSession(sessionId, trainingId, { wsId: activeWsId, db, appId });
      }
      setEditingSession(null);
      setSelectedSession(null);
      setPendingEditData(null);
    } finally {
      setSavingSession(false);
    }
  }

  async function handleSaveSession(e) {
    e.preventDefault();
    const errors = {};
    if (!editingSession.teamId) errors.teamId = 'Selecciona un equipo';
    if (!editingSession.fecha) errors.fecha = 'La fecha es obligatoria';
    if (editingSession.horaInicio && editingSession.horaFin && editingSession.horaInicio >= editingSession.horaFin)
      errors.horaFin = 'La hora fin debe ser posterior a la hora inicio';
    setSessionErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (editingSession.id && editingSession.recurrenceId && !editingSession.recurrenceDetached) {
      setPendingEditData(editingSession);
      setRecurrenceAction({ mode: 'edit', session: editingSession });
      return;
    }

    await doSaveSession(editingSession, 'single');
  }

  async function handleDelete(idOrSession) {
    if (typeof idOrSession === 'object' && idOrSession?.tipo === 'playoff') {
      const session = idOrSession;
      if (session.bracketId && session.bracketMatchId) {
        await updatePlayoffMatchSchedule(
          session.bracketId,
          session.bracketMatchId,
          session.gameIndex || 0,
          { fecha: '', horaInicio: '', horaFin: '', lugar: '' },
          { wsId: activeWsId, db, appId },
        );
      }
      setDeletingId(null);
      setSelectedSession(null);
      return;
    }
    const id = typeof idOrSession === 'string' ? idOrSession : idOrSession?.id;
    if (!id) return;
    await deleteCalendarSession(id, { wsId: activeWsId, db, appId });
    deletePlanilla(id, { wsId: activeWsId, db, appId }).catch(() => {});
    setDeletingId(null);
    setSelectedSession(null);
  }

  function handleDeleteRequest(session) {
    if (session.tipo === 'playoff') {
      setDeletingId(session);
    } else if (session.recurrenceId && !session.recurrenceDetached) {
      setRecurrenceAction({ mode: 'delete', session });
    } else {
      setDeletingId(session.id);
    }
  }

  async function handleRecurrenceChoice(choice) {
    const { mode, session } = recurrenceAction || {};
    setRecurrenceAction(null);

    if (!choice || !session) {
      setPendingEditData(null);
      return;
    }

    try {
      if (mode === 'edit' && pendingEditData) {
        await doSaveSession(pendingEditData, choice);
      } else if (mode === 'delete') {
        if (choice === 'single') {
          await handleDelete(session.id);
        } else if (choice === 'thisAndFuture') {
          const deleted = await deleteSessionsByRecurrenceId(
            activeWsId,
            db,
            appId,
            session.recurrenceId,
            session.fecha,
          );
          deleted.forEach((s) => deletePlanilla(s.id, { wsId: activeWsId, db, appId }).catch(() => {}));
          setSelectedSession(null);
          if (deleted.length > 0) {
            addToast(`${deleted.length} sesiones eliminadas`, 'success');
          }
        }
      }
    } catch (err) {
      console.error('Error handling recurrence action:', err);
      addToast('Error al procesar la acción', 'error');
    }
  }

  async function handleCreateTraining(session) {
    setCreatingTraining(true);
    try {
      const trainingId = crypto.randomUUID();
      await saveTraining(
        {
          id: trainingId,
          teamId: session.teamId,
          meta: {
            numero: getTrainingNum(session),
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
        { wsId: activeWsId, db, appId },
      );
      await linkTrainingToSession(session.id, trainingId, { wsId: activeWsId, db, appId });
      navigate(`/teams/${session.teamId}/trainings/${trainingId}`);
    } finally {
      setCreatingTraining(false);
    }
  }

  return {
    selectedSession,
    setSelectedSession,
    editingSession,
    setEditingSession,
    deletingId,
    setDeletingId,
    recurrenceAction,
    savingSession,
    sessionErrors,
    setSessionErrors,
    creatingTraining,
    handleSaveSession,
    handleDelete,
    handleDeleteRequest,
    handleRecurrenceChoice,
    handleCreateTraining,
  };
}
